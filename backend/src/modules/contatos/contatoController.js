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

async function listar(requisicao, resposta, proximo) {
  try {
    const resultado = await contatoService.listarContatos(requisicao.query);

    return resposta.status(200).json({
      mensagem: 'Contatos listados com sucesso.',
      contatos: resultado.contatos,
      paginacao: resultado.paginacao
    });
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  cadastrar,
  listar
};
