function tratarErro(erro, requisicao, resposta, proximo) {
  let statusHttp = erro.statusHttp || 500;

  if (erro.type === 'entity.too.large') {
    statusHttp = 413;
    erro.message = 'O corpo da solicitação excede o limite permitido.';
  } else if (erro instanceof SyntaxError && erro.status === 400 && erro.body !== undefined) {
    statusHttp = 400;
    erro.message = 'O JSON enviado é inválido.';
  } else if (erroTemporarioDeInfraestrutura(erro)) {
    statusHttp = 503;
    erro.message = 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.';
    resposta.setHeader('Retry-After', '3');
  }

  if (statusHttp >= 500) {
    console.error(JSON.stringify({
      nivel: 'erro',
      requisicaoId: requisicao.id || null,
      metodo: requisicao.method,
      caminho: requisicao.originalUrl,
      statusHttp,
      codigo: erro.code || null,
      mensagem: erro.message
    }));
  }

  return resposta.status(statusHttp).json({
    mensagem: statusHttp === 500 ? 'Erro interno do servidor.' : erro.message
  });
}

function erroTemporarioDeInfraestrutura(erro) {
  const codigos = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    '53300',
    '57P01',
    '57P02',
    '57P03'
  ];

  return codigos.includes(erro.code) ||
    (typeof erro.code === 'string' && erro.code.startsWith('08'));
}

module.exports = tratarErro;
