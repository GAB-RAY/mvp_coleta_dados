require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');
const usuarioModel = require('../src/modules/usuarios/usuarioModel');
const banco = require('../src/config/banco');

async function criarAdministrador(argumentos) {
  const nomeRecebido = argumentos[0];
  const emailRecebido = argumentos[1];
  const senha = argumentos[2];

  try {
    if (!nomeRecebido || !emailRecebido || !senha) {
      throw new Error(
        'Uso: npm run criar-admin -- "Nome" "email@exemplo.com" "senha"'
      );
    }

    const nome = nomeRecebido.trim();
    const email = emailRecebido.trim().toLowerCase();

    if (!nome || !email) {
      throw new Error('Nome e email são obrigatórios.');
    }

    if (senha.length < 8) {
      throw new Error('A senha deve ter pelo menos 8 caracteres.');
    }

    const usuarioExistente = await usuarioModel.buscarPorEmail(email);

    if (usuarioExistente) {
      throw new Error('Já existe um usuário com este email.');
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    let usuario;

    try {
      usuario = await usuarioModel.criar({ nome, email, senhaHash });
    } catch (erro) {
      if (erro.code === '23505') {
        throw new Error('Já existe um usuário com este email.');
      }

      throw erro;
    }

    console.log('Administrador criado com sucesso.');
    console.log('ID: ' + usuario.id);
    console.log('Nome: ' + usuario.nome);
    console.log('Email: ' + usuario.email);

    return usuario;
  } catch (erro) {
    console.error('Não foi possível criar o administrador: ' + erro.message);
    process.exitCode = 1;

    return null;
  } finally {
    await banco.end();
  }
}

if (require.main === module) {
  criarAdministrador(process.argv.slice(2));
}

module.exports = criarAdministrador;
