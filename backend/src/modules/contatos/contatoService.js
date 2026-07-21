const contatoModel = require('./contatoModel');
const criarAppError = require('../../utils/AppError');
const normalizarTelefone = require('../../utils/normalizarTelefone');

function validarCampoTexto(valor, nomeCampo, tamanhoMinimo, tamanhoMaximo) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw criarAppError(nomeCampo + ' é obrigatório.', 400);
  }

  const textoTratado = valor.trim();

  if (textoTratado.length < tamanhoMinimo) {
    throw criarAppError(
      nomeCampo + ' deve ter pelo menos ' + tamanhoMinimo + ' caracteres.',
      400
    );
  }

  if (textoTratado.length > tamanhoMaximo) {
    throw criarAppError(
      nomeCampo + ' deve ter no máximo ' + tamanhoMaximo + ' caracteres.',
      400
    );
  }

  return textoTratado;
}

function validarDadosDoContato(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('Os dados do contato são obrigatórios.', 400);
  }

  const nome = validarCampoTexto(dadosRecebidos.nome, 'Nome', 2, 150);
  const telefone = validarCampoTexto(dadosRecebidos.telefone, 'Telefone', 1, 30);
  const bairro = validarCampoTexto(dadosRecebidos.bairro, 'Bairro', 2, 150);
  const problema = validarCampoTexto(dadosRecebidos.problema, 'Problema', 3, 500);

  if (typeof dadosRecebidos.consentimentoArmazenamento !== 'boolean') {
    throw criarAppError('O consentimento para armazenamento é obrigatório.', 400);
  }

  if (typeof dadosRecebidos.consentimentoMensagens !== 'boolean') {
    throw criarAppError(
      'O consentimento para mensagens deve ser verdadeiro ou falso.',
      400
    );
  }

  if (dadosRecebidos.consentimentoArmazenamento !== true) {
    throw criarAppError('O consentimento para armazenamento é obrigatório.', 400);
  }

  const telefoneNormalizado = normalizarTelefone(telefone);

  if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 15) {
    throw criarAppError('O telefone informado é inválido.', 400);
  }

  return {
    nome,
    telefone,
    telefoneNormalizado,
    bairro,
    problema,
    consentimentoArmazenamento: dadosRecebidos.consentimentoArmazenamento,
    consentimentoMensagens: dadosRecebidos.consentimentoMensagens
  };
}

function transformarContatoParaResposta(contatoCriado) {
  return {
    id: contatoCriado.id,
    nome: contatoCriado.nome,
    telefone: contatoCriado.telefone,
    bairro: contatoCriado.bairro,
    problema: contatoCriado.problema,
    consentimentoArmazenamento: contatoCriado.consentimento_armazenamento,
    consentimentoMensagens: contatoCriado.consentimento_mensagens,
    criadoEm: contatoCriado.criado_em
  };
}

async function cadastrarContato(dadosRecebidos) {
  const dadosDoContato = validarDadosDoContato(dadosRecebidos);
  const contatoExistente = await contatoModel.buscarPorTelefoneNormalizado(
    dadosDoContato.telefoneNormalizado
  );

  if (contatoExistente) {
    throw criarAppError('Já existe um cadastro com este telefone.', 409);
  }

  try {
    const contatoCriado = await contatoModel.criar(dadosDoContato);

    return transformarContatoParaResposta(contatoCriado);
  } catch (erro) {
    if (erro.code === '23505') {
      throw criarAppError('Já existe um cadastro com este telefone.', 409);
    }

    throw erro;
  }
}

module.exports = {
  cadastrarContato
};
