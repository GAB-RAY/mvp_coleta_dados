const contatoService = require('./contatoService');

async function cadastrarContato(requisicao, resposta, proximo) {
  try {
    const contato = await contatoService.cadastrarContato(requisicao.body);

    return resposta.status(201).json({
      mensagem: 'Contato cadastrado com sucesso.',
      contato
    });
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  cadastrarContato
};
