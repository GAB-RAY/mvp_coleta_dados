const autenticacaoService = require('./autenticacaoService');

function obterEnderecoIp(requisicao) {
  if (process.env.DIGITALOCEAN_CONFIAR_IP === 'true') {
    const enderecoDigitalOcean = requisicao.get('do-connecting-ip');

    if (enderecoDigitalOcean) {
      return enderecoDigitalOcean;
    }
  }

  return requisicao.ip || requisicao.socket.remoteAddress;
}

async function login(requisicao, resposta, proximo) {
  try {
    const autenticacao = await autenticacaoService.realizarLogin(requisicao.body, {
      enderecoIp: obterEnderecoIp(requisicao),
      agenteUsuario: requisicao.get('user-agent')
    });

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
