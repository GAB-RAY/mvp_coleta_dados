const jwt = require('jsonwebtoken');

function autenticarUsuario(requisicao, resposta, proximo) {
  const cabecalhoAutorizacao = requisicao.headers.authorization;

  if (!cabecalhoAutorizacao || !cabecalhoAutorizacao.startsWith('Bearer ')) {
    return resposta.status(401).json({
      mensagem: 'Token de autenticação não informado.'
    });
  }

  const token = cabecalhoAutorizacao.slice(7).trim();

  if (!token) {
    return resposta.status(401).json({
      mensagem: 'Token de autenticação não informado.'
    });
  }

  if (!process.env.JWT_SEGREDO) {
    console.error('JWT_SEGREDO não está configurado.');

    return resposta.status(500).json({
      mensagem: 'Erro interno do servidor.'
    });
  }

  try {
    const dadosToken = jwt.verify(token, process.env.JWT_SEGREDO);

    requisicao.usuario = {
      id: dadosToken.sub,
      nome: dadosToken.nome,
      email: dadosToken.email
    };

    return proximo();
  } catch (erro) {
    return resposta.status(401).json({
      mensagem: 'Token inválido ou expirado.'
    });
  }
}

module.exports = autenticarUsuario;
