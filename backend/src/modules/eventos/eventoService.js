const eventoModel = require('./eventoModel');
const criarAppError = require('../../utils/AppError');

function validarTexto(valor, nome, limite) {
  if (typeof valor !== 'string' || valor.trim().length < 2) {
    throw criarAppError(nome + ' é obrigatório.', 400);
  }

  if (valor.trim().length > limite) {
    throw criarAppError(nome + ' deve ter no máximo ' + limite + ' caracteres.', 400);
  }

  return valor.trim();
}

function validarData(valor, nome) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw criarAppError(nome + ' é inválida.', 400);
  }

  const data = new Date(valor + 'T00:00:00Z');
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) {
    throw criarAppError(nome + ' é inválida.', 400);
  }

  return valor;
}

function validarDados(dadosRecebidos) {
  const dados = dadosRecebidos || {};
  const dataInicial = validarData(dados.dataInicial, 'Data inicial');
  const dataFinal = validarData(dados.dataFinal, 'Data final');

  if (dataFinal < dataInicial) {
    throw criarAppError('A data final não pode ser anterior à data inicial.', 400);
  }

  return {
    nome: validarTexto(dados.nome, 'Nome', 150),
    motivo: validarTexto(dados.motivo, 'Motivo', 2000),
    dataInicial,
    dataFinal
  };
}

function transformar(evento) {
  return {
    id: evento.id,
    nome: evento.nome,
    motivo: evento.motivo,
    dataInicial: evento.data_inicial,
    dataFinal: evento.data_final,
    status: evento.status,
    totalCadastros: evento.total_cadastros,
    criadoPor: evento.criado_por,
    atualizadoPor: evento.atualizado_por,
    criadoEm: evento.criado_em,
    atualizadoEm: evento.atualizado_em
  };
}

async function listar() {
  const eventos = await eventoModel.listar();
  return eventos.map(transformar);
}

async function criar(dadosRecebidos, usuario) {
  return transformar(await eventoModel.criar(validarDados(dadosRecebidos), usuario.id));
}

async function editar(idRecebido, dadosRecebidos, usuario) {
  const id = Number(idRecebido);
  if (!Number.isInteger(id) || id < 1) {
    throw criarAppError('Identificador do evento inválido.', 400);
  }

  const evento = await eventoModel.editar(id, validarDados(dadosRecebidos), usuario.id);
  if (!evento) {
    throw criarAppError('Evento não encontrado.', 404);
  }
  return transformar(evento);
}

async function alterarStatus(idRecebido, status, usuario) {
  const id = Number(idRecebido);
  if (!Number.isInteger(id) || id < 1) {
    throw criarAppError('Identificador do evento inválido.', 400);
  }

  try {
    const evento = await eventoModel.alterarStatus(id, status, usuario.id);
    if (!evento) {
      throw criarAppError('Evento não encontrado.', 404);
    }
    return transformar(evento);
  } catch (erro) {
    if (erro.codigoAplicacao === 'EVENTO_FORA_PERIODO') {
      throw criarAppError(erro.message, 409);
    }
    throw erro;
  }
}

module.exports = { alterarStatus, criar, editar, listar };
