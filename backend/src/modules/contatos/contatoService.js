const contatoModel = require('./contatoModel');
const criarAppError = require('../../utils/AppError');
const normalizarTelefone = require('../../utils/normalizarTelefone');

function validarTexto(valor, nomeCampo, tamanhoMinimo, tamanhoMaximo) {
  if (typeof valor !== 'string') {
    throw criarAppError('O campo ' + nomeCampo + ' é obrigatório.', 400);
  }

  const texto = valor.trim();

  if (texto.length < tamanhoMinimo || texto.length > tamanhoMaximo) {
    throw criarAppError(
      'O campo ' + nomeCampo + ' deve ter entre ' + tamanhoMinimo +
        ' e ' + tamanhoMaximo + ' caracteres.',
      400
    );
  }

  return texto;
}

function validarDadosContato(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('Os dados do contato são obrigatórios.', 400);
  }

  const nome = validarTexto(dadosRecebidos.nome, 'nome', 2, 150);
  const telefone = validarTexto(dadosRecebidos.telefone, 'telefone', 8, 30);
  const bairro = validarTexto(dadosRecebidos.bairro, 'bairro', 2, 150);
  const problema = validarTexto(dadosRecebidos.problema, 'problema', 3, 500);
  const telefoneNormalizado = normalizarTelefone(telefone);

  if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 15) {
    throw criarAppError('O telefone deve conter entre 10 e 15 números.', 400);
  }

  if (dadosRecebidos.consentimentoArmazenamento !== true) {
    throw criarAppError(
      'O consentimento para armazenamento deve ser aceito.',
      400
    );
  }

  if (typeof dadosRecebidos.consentimentoMensagens !== 'boolean') {
    throw criarAppError(
      'O campo consentimentoMensagens deve ser verdadeiro ou falso.',
      400
    );
  }

  return {
    nome,
    telefone,
    telefoneNormalizado,
    bairro,
    problema,
    consentimentoArmazenamento: true,
    consentimentoMensagens: dadosRecebidos.consentimentoMensagens
  };
}

async function cadastrarContato(dadosRecebidos) {
  const dadosContato = validarDadosContato(dadosRecebidos);
  const contatoExistente = await contatoModel.buscarPorTelefoneNormalizado(
    dadosContato.telefoneNormalizado
  );

  if (contatoExistente) {
    throw criarAppError('Já existe um contato com este telefone.', 409);
  }

  try {
    return await contatoModel.criarContato(dadosContato);
  } catch (erro) {
    if (erro.code === '23505') {
      throw criarAppError('Já existe um contato com este telefone.', 409);
    }

    throw erro;
  }
}

module.exports = {
  cadastrarContato
};
