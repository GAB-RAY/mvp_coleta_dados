const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usuarioModel = require('../usuarios/usuarioModel');
const criarAppError = require('../../utils/AppError');

function normalizarEmail(email) {
  return email.trim().toLowerCase();
}

async function realizarLogin(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('Email e senha são obrigatórios.', 400);
  }

  if (typeof dadosRecebidos.email !== 'string' || dadosRecebidos.email.trim() === '') {
    throw criarAppError('Email é obrigatório.', 400);
  }

  if (typeof dadosRecebidos.senha !== 'string' || dadosRecebidos.senha === '') {
    throw criarAppError('Senha é obrigatória.', 400);
  }

  const email = normalizarEmail(dadosRecebidos.email);
  const usuario = await usuarioModel.buscarPorEmail(email);

  if (!usuario) {
    throw criarAppError('Email ou senha inválidos.', 401);
  }

  if (usuario.ativo !== true) {
    throw criarAppError('Usuário inativo.', 403);
  }

  const senhaCorreta = await bcrypt.compare(dadosRecebidos.senha, usuario.senha_hash);

  if (!senhaCorreta) {
    throw criarAppError('Email ou senha inválidos.', 401);
  }

  const segredoJwt = process.env.JWT_SECRET || process.env.JWT_SEGREDO;
  const tempoExpiracao = process.env.JWT_TEMPO_EXPIRACAO || process.env.JWT_EXPIRACAO;

  if (!segredoJwt) {
    throw new Error('JWT_SECRET não está configurado.');
  }

  if (!tempoExpiracao) {
    throw new Error('JWT_TEMPO_EXPIRACAO não está configurado.');
  }

  const token = jwt.sign(
    {
      id: usuario.id,
      email: usuario.email
    },
    segredoJwt,
    {
      expiresIn: tempoExpiracao
    }
  );

  return {
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email
    }
  };
}

module.exports = {
  realizarLogin
};
