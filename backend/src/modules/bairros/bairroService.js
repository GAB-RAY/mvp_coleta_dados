const bairroModel = require('./bairroModel');
const criarAppError = require('../../utils/AppError');

function criarChaveBairro(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function encontrarNomeCanonico(valor, bairros) {
  const chaveProcurada = criarChaveBairro(valor);
  let indice;

  if (!chaveProcurada) {
    return null;
  }

  for (indice = 0; indice < bairros.length; indice += 1) {
    if (criarChaveBairro(bairros[indice]) === chaveProcurada) {
      return bairros[indice];
    }
  }

  return null;
}

async function listarNomesAtivos() {
  const registros = await bairroModel.listarAtivos();

  return registros.map(function (registro) {
    return registro.nome;
  });
}

async function validarBairroAtivo(valor) {
  const bairros = await listarNomesAtivos();
  const nomeCanonico = encontrarNomeCanonico(valor, bairros);

  if (!nomeCanonico) {
    throw criarAppError('Selecione um bairro válido do município do Rio de Janeiro.', 400);
  }

  return nomeCanonico;
}

module.exports = {
  encontrarNomeCanonico,
  listarNomesAtivos,
  validarBairroAtivo
};
