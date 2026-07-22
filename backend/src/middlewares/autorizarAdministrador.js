const criarAppError = require('../utils/AppError');

function autorizarAdministrador(requisicao, resposta, proximo) {
  if (!requisicao.usuario || requisicao.usuario.perfil !== 'administrador') {
    return proximo(criarAppError('Acesso permitido somente para administradores.', 403));
  }

  return proximo();
}

module.exports = autorizarAdministrador;
