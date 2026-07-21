const autenticacaoService = require('./autenticacaoService');

async function login(requisicao, resposta, proximo) {
  try {
    const autenticacao = await autenticacaoService.realizarLogin(requisicao.body);

    return resposta.status(200).json({
      mensagem: 'Login realizado com sucesso.',
      token: autenticacao.token,
      usuario: autenticacao.usuario
    });
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  login
};
