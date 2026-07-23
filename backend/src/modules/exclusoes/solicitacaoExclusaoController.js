const solicitacaoExclusaoService = require('./solicitacaoExclusaoService');

async function listar(requisicao, resposta, proximo) {
  try {
    return resposta.status(200).json({
      mensagem: 'Solicitações de exclusão listadas com sucesso.',
      solicitacoes: await solicitacaoExclusaoService.listar(requisicao.query.status)
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function aprovar(requisicao, resposta, proximo) {
  try {
    const resultado = await solicitacaoExclusaoService.analisar(
      requisicao.params.id,
      'aprovar',
      requisicao.body,
      requisicao.usuario
    );
    return resposta.status(200).json({
      mensagem: 'Solicitação aprovada e contato excluído definitivamente.',
      resultado
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function rejeitar(requisicao, resposta, proximo) {
  try {
    const resultado = await solicitacaoExclusaoService.analisar(
      requisicao.params.id,
      'rejeitar',
      requisicao.body,
      requisicao.usuario
    );
    return resposta.status(200).json({
      mensagem: 'Solicitação de exclusão rejeitada.',
      resultado
    });
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = { aprovar, listar, rejeitar };
