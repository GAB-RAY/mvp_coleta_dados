const criarAppError = require('../utils/AppError');

function lerLimiteConcorrencia() {
  const limite = Number(process.env.API_REQUISICOES_CONCORRENTES || 100);

  if (!Number.isInteger(limite) || limite < 10 || limite > 1000) {
    throw new Error('API_REQUISICOES_CONCORRENTES possui valor inválido.');
  }

  return limite;
}

function criarLimitadorConcorrencia() {
  const limite = lerLimiteConcorrencia();
  let requisicoesAtivas = 0;

  return function limitarConcorrencia(requisicao, resposta, proximo) {
    if (requisicao.path === '/api/saude/vivo' || requisicao.path === '/api/saude/pronto') {
      return proximo();
    }

    if (requisicoesAtivas >= limite) {
      resposta.setHeader('Retry-After', '2');
      return proximo(criarAppError(
        'Servidor temporariamente ocupado. Aguarde alguns segundos e tente novamente.',
        503
      ));
    }

    requisicoesAtivas += 1;
    let liberada = false;

    function liberar() {
      if (!liberada) {
        liberada = true;
        requisicoesAtivas -= 1;
      }
    }

    resposta.once('finish', liberar);
    resposta.once('close', liberar);

    return proximo();
  };
}

module.exports = criarLimitadorConcorrencia;
