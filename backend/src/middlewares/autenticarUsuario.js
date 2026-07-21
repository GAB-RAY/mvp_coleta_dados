const jwt = require('jsonwebtoken');
const criarAppError = require('../utils/AppError');

function autenticarUsuario(requisicao, resposta, proximo) {
  const authorization = requisicao.headers.authorization;

  if (!authorization) {
    return proximo(criarAppError('Token não fornecido.', 401));
  }

  const partesDoAuthorization = authorization.split(' ');
  const palavraBearer = partesDoAuthorization[0];
  const token = partesDoAuthorization[1];

  if (!token) {
    return proximo(criarAppError('Token não fornecido.', 401));
  }

  if (partesDoAuthorization.length !== 2 || palavraBearer !== 'Bearer') {
    return proximo(criarAppError('Token inválido.', 401));
  }

  const segredoJwt = process.env.JWT_SECRET || process.env.JWT_SEGREDO;

  if (!segredoJwt) {
    return proximo(new Error('JWT_SECRET não está configurado.'));
  }

  try {
    const dadosDoToken = jwt.verify(token, segredoJwt);

    requisicao.usuario = {
      id: dadosDoToken.id,
      email: dadosDoToken.email
    };

    return proximo();
  } catch (erro) {
    return proximo(criarAppError('Token inválido.', 401));
  }
}

module.exports = autenticarUsuario;
