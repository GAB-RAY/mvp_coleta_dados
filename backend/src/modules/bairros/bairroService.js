const bairroModel = require('./bairroModel');
const criarAppError = require('../../utils/AppError');

let bairrosEmCache = null;
let cacheValidoAte = 0;
let carregamentoEmAndamento = null;

function obterDuracaoCache() {
  const duracao = Number(process.env.BAIRROS_CACHE_MS || 300000);

  if (!Number.isInteger(duracao) || duracao < 10000 || duracao > 86400000) {
    throw new Error('BAIRROS_CACHE_MS possui valor inválido.');
  }

  return duracao;
}

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
  if (bairrosEmCache && Date.now() < cacheValidoAte) {
    return bairrosEmCache.slice();
  }

  if (!carregamentoEmAndamento) {
    carregamentoEmAndamento = bairroModel.listarAtivos()
      .then(function (registros) {
        bairrosEmCache = registros.map(function (registro) {
          return registro.nome;
        });
        cacheValidoAte = Date.now() + obterDuracaoCache();
        return bairrosEmCache;
      })
      .finally(function () {
        carregamentoEmAndamento = null;
      });
  }

  const bairros = await carregamentoEmAndamento;

  return bairros.slice();
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
