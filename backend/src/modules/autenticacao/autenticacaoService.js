const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usuarioModel = require('../usuarios/usuarioModel');
const criarAppError = require('../../utils/AppError');

function normalizarEmail(email) {
  return email.trim().toLowerCase();
}

function validarNome(nome) {
  if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 150) {
    throw criarAppError('O nome deve ter entre 2 e 150 caracteres.', 400);
  }

  return nome.trim();
}

function validarEmail(email) {
  if (typeof email !== 'string') {
    throw criarAppError('O email é obrigatório.', 400);
  }

  const emailNormalizado = normalizarEmail(email);
  const formatoEmailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    emailNormalizado.length < 5 ||
    emailNormalizado.length > 200 ||
    !formatoEmailValido.test(emailNormalizado)
  ) {
    throw criarAppError('Informe um email válido.', 400);
  }

  return emailNormalizado;
}

function validarSenhaNova(senha) {
  if (typeof senha !== 'string' || senha.length < 8) {
    throw criarAppError('A senha deve ter pelo menos 8 caracteres.', 400);
  }

  if (Buffer.byteLength(senha, 'utf8') > 72) {
    throw criarAppError('A senha deve ter no máximo 72 bytes.', 400);
  }

  return senha;
}

function obterRodadasBcrypt() {
  const rodadasConfiguradas = Number(process.env.BCRYPT_RODADAS) || 12;

  if (rodadasConfiguradas < 10 || rodadasConfiguradas > 15) {
    throw new Error('BCRYPT_RODADAS deve estar entre 10 e 15.');
  }

  return rodadasConfiguradas;
}

async function criarUsuario(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('Nome, email e senha são obrigatórios.', 400);
  }

  const nome = validarNome(dadosRecebidos.nome);
  const email = validarEmail(dadosRecebidos.email);
  const senha = validarSenhaNova(dadosRecebidos.senha);
  const usuarioExistente = await usuarioModel.buscarPorEmail(email);

  if (usuarioExistente) {
    throw criarAppError('Já existe um usuário com este email.', 409);
  }

  const senhaHash = await bcrypt.hash(senha, obterRodadasBcrypt());

  try {
    return await usuarioModel.criarUsuario({ nome, email, senhaHash });
  } catch (erro) {
    if (erro.code === '23505') {
      throw criarAppError('Já existe um usuário com este email.', 409);
    }

    throw erro;
  }
}

async function autenticarUsuario(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('Email e senha são obrigatórios.', 400);
  }

  const email = validarEmail(dadosRecebidos.email);

  if (typeof dadosRecebidos.senha !== 'string' || dadosRecebidos.senha.length === 0) {
    throw criarAppError('A senha é obrigatória.', 400);
  }

  const usuario = await usuarioModel.buscarPorEmail(email);

  if (!usuario || !usuario.ativo) {
    throw criarAppError('Email ou senha inválidos.', 401);
  }

  const senhaCorreta = await bcrypt.compare(dadosRecebidos.senha, usuario.senha_hash);

  if (!senhaCorreta) {
    throw criarAppError('Email ou senha inválidos.', 401);
  }

  const segredoJwt = process.env.JWT_SEGREDO;

  if (!segredoJwt) {
    throw new Error('JWT_SEGREDO não está configurado.');
  }

  const token = jwt.sign(
    {
      nome: usuario.nome,
      email: usuario.email
    },
    segredoJwt,
    {
      subject: String(usuario.id),
      expiresIn: process.env.JWT_EXPIRACAO || '8h'
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
  criarUsuario,
  autenticarUsuario
};
