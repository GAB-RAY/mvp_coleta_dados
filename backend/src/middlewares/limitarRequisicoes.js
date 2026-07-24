const pacoteLimitador = require('express-rate-limit');
const normalizarTelefone = require('../utils/normalizarTelefone');

const rateLimit = pacoteLimitador.rateLimit;
const ipKeyGenerator = pacoteLimitador.ipKeyGenerator;

function lerInteiro(nome, valorPadrao, minimo, maximo) {
  const valor = Number(process.env[nome] || valorPadrao);

  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new Error(nome + ' possui valor inválido.');
  }

  return valor;
}

function obterEnderecoIp(requisicao) {
  if (process.env.DIGITALOCEAN_CONFIAR_IP === 'true') {
    const enderecoDigitalOcean = requisicao.get('do-connecting-ip');

    if (enderecoDigitalOcean) {
      return ipKeyGenerator(enderecoDigitalOcean);
    }
  }

  return ipKeyGenerator(requisicao.ip || requisicao.socket.remoteAddress || 'desconhecido');
}

function ignorarRequisicaoGlobal(requisicao) {
  return requisicao.method === 'OPTIONS' ||
    requisicao.path === '/api/saude/vivo' ||
    requisicao.path === '/api/saude/pronto';
}

function responderLimite(requisicao, resposta) {
  return resposta.status(429).json({
    mensagem: 'Muitas solicitações foram recebidas. Aguarde alguns instantes e tente novamente.'
  });
}

function criarLimitadorGlobal() {
  return rateLimit({
    windowMs: lerInteiro('API_LIMITE_JANELA_MS', 60000, 1000, 3600000),
    limit: lerInteiro('API_LIMITE_MAXIMO', 1200, 10, 100000),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: obterEnderecoIp,
    skip: ignorarRequisicaoGlobal,
    handler: responderLimite
  });
}

function obterChaveCadastroPublico(requisicao) {
  const telefone = normalizarTelefone(requisicao.body && requisicao.body.telefone);
  return obterEnderecoIp(requisicao) + ':' + (telefone || 'telefone-ausente');
}

function criarLimitadorCadastroPublico() {
  return rateLimit({
    windowMs: lerInteiro('PUBLICO_LIMITE_JANELA_MS', 900000, 60000, 86400000),
    limit: lerInteiro('PUBLICO_LIMITE_MAXIMO', 5, 1, 100),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: obterChaveCadastroPublico,
    handler: responderLimite
  });
}

module.exports = {
  criarLimitadorCadastroPublico,
  criarLimitadorGlobal
};
