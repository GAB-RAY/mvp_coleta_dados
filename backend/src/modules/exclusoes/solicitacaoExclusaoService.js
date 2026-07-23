const solicitacaoExclusaoModel = require('./solicitacaoExclusaoModel');
const criarAppError = require('../../utils/AppError');

function validarId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id < 1) {
    throw criarAppError('Identificador inválido.', 400);
  }
  return id;
}

function validarObservacoes(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  if (typeof valor !== 'string' || valor.trim().length > 1000) {
    throw criarAppError('Observações devem ter no máximo 1000 caracteres.', 400);
  }
  return valor.trim() || null;
}

function transformar(item) {
  return {
    id: item.id,
    contatoId: item.contato_id,
    contatoIdOriginal: item.contato_id_original,
    contatoNome: item.contato_nome,
    contatoTelefone: item.contato_telefone,
    status: item.status,
    observacoes: item.observacoes,
    solicitadaPor: item.solicitada_por,
    analisadaPor: item.analisada_por,
    solicitadaEm: item.solicitada_em,
    analisadaEm: item.analisada_em,
    executadaEm: item.executada_em
  };
}

async function solicitar(contatoIdRecebido, dadosRecebidos, usuario) {
  const resultado = await solicitacaoExclusaoModel.solicitar(
    validarId(contatoIdRecebido),
    usuario.id,
    validarObservacoes(dadosRecebidos && dadosRecebidos.observacoes)
  );
  if (!resultado) {
    throw criarAppError('Contato não encontrado.', 404);
  }
  return {
    id: resultado.id,
    alterado: resultado.alterado,
    solicitadaEm: resultado.solicitada_em,
    solicitadaPorUsuarioId: resultado.solicitada_por_usuario_id
  };
}

async function listar(status) {
  const estados = ['', 'pendente', 'aprovada', 'rejeitada'];
  const statusValidado = status || '';
  if (!estados.includes(statusValidado)) {
    throw criarAppError('Status da solicitação inválido.', 400);
  }
  const itens = await solicitacaoExclusaoModel.listar(statusValidado);
  return itens.map(transformar);
}

async function analisar(idRecebido, decisao, dadosRecebidos, usuario) {
  const id = validarId(idRecebido);
  const observacoes = validarObservacoes(dadosRecebidos && dadosRecebidos.observacoes);
  let resultado;

  try {
    resultado = decisao === 'aprovar'
      ? await solicitacaoExclusaoModel.aprovar(id, usuario.id, observacoes)
      : await solicitacaoExclusaoModel.rejeitar(id, usuario.id, observacoes);
  } catch (erro) {
    if (erro.codigoAplicacao === 'SOLICITACAO_ANALISADA') {
      throw criarAppError(erro.message, 409);
    }
    if (erro.codigoAplicacao === 'CONTATO_AUSENTE') {
      throw criarAppError(erro.message, 409);
    }
    throw erro;
  }

  if (!resultado) {
    throw criarAppError('Solicitação de exclusão não encontrada.', 404);
  }
  return resultado;
}

module.exports = { analisar, listar, solicitar };
