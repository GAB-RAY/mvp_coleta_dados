const crypto = require('crypto');
const criarAppError = require('../../utils/AppError');
const contatoService = require('../contatos/contatoService');
const campanhaModel = require('./campanhaModel');

let obterAgora = function () { return new Date(); };

function validarId(valor, nome) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id < 1) throw criarAppError(nome + ' invalido.', 400);
  return id;
}

function validarTexto(valor, nome, maximo) {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (texto.length < 2 || texto.length > maximo) throw criarAppError(nome + ' invalido.', 400);
  return texto;
}

function prepararDados(dados) {
  const modeloId = validarId(dados.modeloId, 'Template');
  const filtros = contatoService.prepararFiltros(dados.filtros || {});
  return {
    nome: validarTexto(dados.nome, 'Nome', 150),
    finalidade: validarTexto(dados.finalidade, 'Finalidade', 2000),
    modeloId,
    filtros
  };
}

function validarQuantidadePrevia(valor, padrao) {
  const quantidade = valor === undefined || valor === null || valor === '' ? padrao : Number(valor);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 10000) {
    throw criarAppError('Quantidade da previa invalida.', 400);
  }
  return quantidade;
}

function apresentarContatos(contatos) {
  return contatos.map(function (contato) {
    return {
      nome: contato.nome || 'Nao informado',
      telefoneMascarado: contato.telefone_mascarado,
      bairro: contato.bairro || 'Nao informado',
      problema: contato.problema || 'Nao informado',
      status: contato.status || undefined
    };
  });
}

async function listar() {
  const capacidade = await campanhaModel.obterCapacidade(obterAgora());
  const campanhas = await campanhaModel.listar();
  return campanhas.map(function (campanha) {
    return Object.assign({}, campanha, {
      restante: Number(campanha.pendente || 0) + Number(campanha.enviando || 0),
      capacidadeDisponivel: capacidade.disponivel
    });
  });
}

async function criar(dados, usuario) {
  try {
    return await campanhaModel.criar(prepararDados(dados || {}), usuario.id);
  } catch (erro) {
    if (erro.codigo === 'TEMPLATE_INVALIDO' || erro.codigo === 'USUARIO_INVALIDO') {
      throw criarAppError(erro.message, 409);
    }

    if (erro.code === '23503') {
      throw criarAppError('O template ou o responsável selecionado não está mais disponível.', 409);
    }

    throw erro;
  }
}

async function atualizar(idRecebido, dados, usuario) {
  const id = validarId(idRecebido, 'Campanha');
  const campanha = await campanhaModel.atualizar(id, prepararDados(dados || {}), usuario.id);
  if (!campanha) throw criarAppError('Campanha nao encontrada ou segmentacao bloqueada por reservas existentes.', 409);
  return campanha;
}

async function alterarStatus(idRecebido, status, usuario) {
  const id = validarId(idRecebido, 'Campanha');
  const permitidos = ['pronta','ativa','pausada','concluida','cancelada'];
  if (!permitidos.includes(status)) throw criarAppError('Status de campanha invalido.', 400);
  const campanha = await campanhaModel.buscarPorId(id);
  if (!campanha) throw criarAppError('Campanha nao encontrada.', 404);
  const transicoes = {
    rascunho: ['pronta','cancelada'], pronta: ['ativa','cancelada'],
    ativa: ['pausada','concluida','cancelada'], pausada: ['ativa','concluida','cancelada'],
    concluida: [], cancelada: []
  };
  if (!transicoes[campanha.status].includes(status)) throw criarAppError('Transicao de campanha invalida.', 409);
  return campanhaModel.alterarStatus(id, status, usuario.id);
}

async function visualizarPublico(idRecebido, quantidadeRecebida) {
  const id = validarId(idRecebido, 'Campanha');
  const quantidade = validarQuantidadePrevia(quantidadeRecebida, 250);
  const campanha = await campanhaModel.buscarPorId(id);
  if (!campanha) throw criarAppError('Campanha nao encontrada.', 404);
  const resultados = await Promise.all([
    campanhaModel.contarPublico(campanha.filtros_snapshot, false),
    campanhaModel.contarPublico(campanha.filtros_snapshot, true),
    campanhaModel.obterCapacidade(obterAgora()),
    campanhaModel.contarDisponiveis(campanha.filtros_snapshot, id)
  ]);
  const quantidadeEfetiva = Math.min(quantidade, resultados[2].disponivel, resultados[3]);
  const limiteLista = Math.min(quantidadeEfetiva, 1000);
  const contatos = limiteLista > 0
    ? await campanhaModel.listarCandidatos(campanha.filtros_snapshot, id, limiteLista)
    : [];
  return {
    publicoEncontrado: resultados[0], publicoApto: resultados[1],
    publicoNaoApto: resultados[0] - resultados[1], capacidade: resultados[2],
    restantes: resultados[3], quantidadeSolicitada: quantidade,
    quantidadeEfetiva, contatos: apresentarContatos(contatos),
    listaLimitada: quantidadeEfetiva > limiteLista
  };
}

async function visualizarPreviaFiltros(dados) {
  const filtros = contatoService.prepararFiltros(dados && dados.filtros || {});
  const quantidade = validarQuantidadePrevia(dados && dados.quantidade, 20);
  const resultados = await Promise.all([
    campanhaModel.contarPublico(filtros, false),
    campanhaModel.contarPublico(filtros, true),
    campanhaModel.listarCandidatos(filtros, null, Math.min(quantidade, 100))
  ]);
  return {
    publicoEncontrado: resultados[0],
    publicoApto: resultados[1],
    publicoNaoApto: resultados[0] - resultados[1],
    contatos: apresentarContatos(resultados[2]),
    listaLimitada: resultados[1] > resultados[2].length
  };
}

async function criarLote(campanhaIdRecebido, dados, usuario) {
  const campanhaId = validarId(campanhaIdRecebido, 'Campanha');
  const tamanho = Number(dados.tamanho);
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > 10000) throw criarAppError('Tamanho do lote invalido.', 400);
  const chave = typeof dados.chaveIdempotencia === 'string' && dados.chaveIdempotencia.trim()
    ? dados.chaveIdempotencia.trim().slice(0, 100)
    : crypto.randomUUID();
  try {
    return await campanhaModel.criarLoteAtomico(campanhaId, tamanho, chave, usuario.id, obterAgora());
  } catch (erro) {
    if (erro.codigo === 'CAPACIDADE_INSUFICIENTE') {
      const appError = criarAppError('Capacidade insuficiente. Disponivel nas ultimas 24 horas: ' + erro.capacidade + '.', 409);
      appError.capacidade = erro.capacidade;
      appError.limite = erro.limite;
      appError.utilizado = erro.utilizado;
      throw appError;
    }
    if (erro.codigo === 'CAMPANHA_INDISPONIVEL' || erro.codigo === 'SEM_CONTATOS') throw criarAppError(erro.message, 409);
    throw erro;
  }
}

async function listarLotes(idRecebido) {
  return campanhaModel.listarLotes(validarId(idRecebido, 'Campanha'));
}

async function listarContatosLote(campanhaIdRecebido, loteIdRecebido) {
  const campanhaId = validarId(campanhaIdRecebido, 'Campanha');
  const loteId = validarId(loteIdRecebido, 'Lote');
  return apresentarContatos(await campanhaModel.listarContatosLote(campanhaId, loteId));
}

async function listarFalhas(idRecebido) {
  return campanhaModel.listarFalhas(validarId(idRecebido, 'Campanha'));
}

async function obterLimite() {
  return campanhaModel.obterCapacidade(obterAgora());
}

async function atualizarLimite(dados, usuario) {
  const valor = Number(dados.valor);
  const motivo = validarTexto(dados.motivo, 'Motivo', 1000);
  if (!Number.isInteger(valor) || valor < 1 || valor > 100000) throw criarAppError('Limite invalido.', 400);
  await campanhaModel.atualizarLimite(valor, motivo, usuario.id);
  return obterLimite();
}

async function listarTemplates() { return campanhaModel.listarTemplates(); }

async function salvarTemplate(idRecebido, dados, usuario) {
  const id = idRecebido ? validarId(idRecebido, 'Template') : null;
  const preparado = {
    nome: validarTexto(dados.nome, 'Nome', 150),
    categoria: validarTexto(dados.categoria, 'Categoria', 100),
    conteudo: validarTexto(dados.conteudo, 'Conteudo', 10000),
    ativo: dados.ativo !== false
  };
  const template = await campanhaModel.salvarTemplate(id, preparado, usuario.id);
  if (!template) throw criarAppError('Template nao encontrado.', 404);
  return template;
}

function definirRelogioParaTeste(funcao) {
  obterAgora = funcao || function () { return new Date(); };
}

module.exports = {
  alterarStatus, atualizar, atualizarLimite, criar, criarLote,
  definirRelogioParaTeste, listar, listarContatosLote, listarFalhas, listarLotes,
  listarTemplates, obterLimite, salvarTemplate, visualizarPreviaFiltros,
  visualizarPublico
};
