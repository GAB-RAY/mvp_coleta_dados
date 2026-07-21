function criarAppError(mensagem, statusHttp) {
  const erro = new Error(mensagem);
  erro.statusHttp = statusHttp;

  return erro;
}

module.exports = criarAppError;
