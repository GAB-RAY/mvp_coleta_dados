function tratarErro(erro, requisicao, resposta, proximo) {
  const statusHttp = erro.statusHttp || 500;

  if (statusHttp === 500) {
    console.error('Erro interno do servidor:', erro.message);
  }

  return resposta.status(statusHttp).json({
    mensagem: statusHttp === 500 ? 'Erro interno do servidor.' : erro.message
  });
}

module.exports = tratarErro;
