const contatoService = require('./contatoService');

async function cadastrar(requisicao, resposta, proximo) {
  try {
    const contato = await contatoService.cadastrarContato(requisicao.body);

    return resposta.status(201).json({
      mensagem: 'Cadastro realizado com sucesso.',
      contato
    });
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  cadastrar
};
