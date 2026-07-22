const usuarioService = require('./usuarioService');

async function listar(requisicao, resposta, proximo) {
  try {
    const usuarios = await usuarioService.listarUsuarios();

    return resposta.status(200).json({
      mensagem: 'Usuários listados com sucesso.',
      usuarios
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function criar(requisicao, resposta, proximo) {
  try {
    const usuario = await usuarioService.criarUsuario(requisicao.body);

    return resposta.status(201).json({
      mensagem: 'Usuário criado com sucesso.',
      usuario
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function redefinirSenha(requisicao, resposta, proximo) {
  try {
    const usuario = await usuarioService.redefinirSenha(
      requisicao.params.id,
      requisicao.body,
      requisicao.usuario
    );

    return resposta.status(200).json({
      mensagem: 'Senha redefinida com sucesso.',
      usuario
    });
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  criar,
  listar,
  redefinirSenha
};
