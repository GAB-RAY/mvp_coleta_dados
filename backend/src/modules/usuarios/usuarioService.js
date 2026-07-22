const bcrypt = require('bcrypt');
const usuarioModel = require('./usuarioModel');
const criarAppError = require('../../utils/AppError');

const PERFIS_VALIDOS = ['administrador', 'operador'];

function validarTexto(valor, nomeCampo, tamanhoMinimo, tamanhoMaximo) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw criarAppError(nomeCampo + ' é obrigatório.', 400);
  }

  const texto = valor.trim();

  if (texto.length < tamanhoMinimo || texto.length > tamanhoMaximo) {
    throw criarAppError(
      nomeCampo + ' deve ter entre ' + tamanhoMinimo + ' e ' + tamanhoMaximo + ' caracteres.',
      400
    );
  }

  return texto;
}

function validarEmail(valor) {
  const email = validarTexto(valor, 'Email', 5, 200).toLowerCase();
  const formatoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!formatoValido) {
    throw criarAppError('Informe um email válido.', 400);
  }

  return email;
}

function validarSenha(valor) {
  if (typeof valor !== 'string' || valor.length < 12) {
    throw criarAppError('A senha deve ter pelo menos 12 caracteres.', 400);
  }

  if (Buffer.byteLength(valor, 'utf8') > 72) {
    throw criarAppError('A senha deve ter no máximo 72 bytes.', 400);
  }

  return valor;
}

function validarPerfil(valor) {
  if (typeof valor !== 'string' || !PERFIS_VALIDOS.includes(valor)) {
    throw criarAppError('Perfil deve ser administrador ou operador.', 400);
  }

  return valor;
}

function transformarUsuario(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    ativo: usuario.ativo,
    criadoEm: usuario.criado_em,
    atualizadoEm: usuario.atualizado_em
  };
}

async function listarUsuarios() {
  const usuarios = await usuarioModel.listar();

  return usuarios.map(transformarUsuario);
}

async function criarUsuario(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('Os dados do usuário são obrigatórios.', 400);
  }

  const nome = validarTexto(dadosRecebidos.nome, 'Nome', 2, 150);
  const email = validarEmail(dadosRecebidos.email);
  const senha = validarSenha(dadosRecebidos.senha);
  const perfil = validarPerfil(dadosRecebidos.perfil);
  const usuarioExistente = await usuarioModel.buscarPorEmail(email);

  if (usuarioExistente) {
    throw criarAppError('Já existe um usuário com este email.', 409);
  }

  const senhaHash = await bcrypt.hash(senha, 12);

  try {
    const usuario = await usuarioModel.criar({ nome, email, senhaHash, perfil });
    return transformarUsuario(usuario);
  } catch (erro) {
    if (erro.code === '23505') {
      throw criarAppError('Já existe um usuário com este email.', 409);
    }

    throw erro;
  }
}

function validarIdentificadorUsuario(valor) {
  const identificador = Number(valor);

  if (!Number.isInteger(identificador) || identificador < 1) {
    throw criarAppError('Identificador do usuário inválido.', 400);
  }

  return identificador;
}

async function redefinirSenha(idRecebido, dadosRecebidos, usuarioResponsavel) {
  if (!usuarioResponsavel || usuarioResponsavel.perfil !== 'administrador') {
    throw criarAppError('Acesso permitido somente para administradores.', 403);
  }

  const usuarioId = validarIdentificadorUsuario(idRecebido);

  if (usuarioId === Number(usuarioResponsavel.id)) {
    throw criarAppError(
      'Use outro administrador para redefinir a senha desta conta.',
      400
    );
  }

  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('A nova senha é obrigatória.', 400);
  }

  const novaSenha = validarSenha(dadosRecebidos.novaSenha);
  const usuarioExistente = await usuarioModel.buscarPorId(usuarioId);

  if (!usuarioExistente) {
    throw criarAppError('Usuário não encontrado.', 404);
  }

  const senhaHash = await bcrypt.hash(novaSenha, 12);
  const usuario = await usuarioModel.redefinirSenha(usuarioId, senhaHash);

  if (!usuario) {
    throw criarAppError('Usuário não encontrado.', 404);
  }

  return transformarUsuario(usuario);
}

module.exports = {
  criarUsuario,
  listarUsuarios,
  redefinirSenha
};
