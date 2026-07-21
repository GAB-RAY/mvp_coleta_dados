const autenticacaoService = require('./autenticacaoService');

async function login(requisicao, resposta, proximo) {
  try {
    const autenticacao = await autenticacaoService.autenticarUsuario(requisicao.body);

    return resposta.status(200).json(autenticacao);
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  login
};
