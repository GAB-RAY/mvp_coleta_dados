const crypto = require('crypto');

function identificarRequisicao(requisicao, resposta, proximo) {
  const identificadorRecebido = requisicao.get('x-request-id');
  const identificadorValido = typeof identificadorRecebido === 'string' &&
    /^[a-zA-Z0-9._:-]{1,100}$/.test(identificadorRecebido);
  const identificador = identificadorValido
    ? identificadorRecebido
    : crypto.randomUUID();

  requisicao.id = identificador;
  resposta.setHeader('X-Request-Id', identificador);

  return proximo();
}

module.exports = identificarRequisicao;
