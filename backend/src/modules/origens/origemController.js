const origemService = require('./origemService');

async function listar(requisicao, resposta, proximo) {
  try {
    const origens = await origemService.listarOrigens();

    return resposta.status(200).json({ origens });
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  listar
};
