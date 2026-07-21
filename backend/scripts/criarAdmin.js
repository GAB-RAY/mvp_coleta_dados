require('dotenv').config({ quiet: true });

const autenticacaoService = require('../src/modules/autenticacao/autenticacaoService');
const banco = require('../src/config/banco');

async function executar() {
  const argumentos = process.argv.slice(2);
  const nome = argumentos[0];
  const email = argumentos[1];
  const senha = argumentos[2];

  try {
    if (!nome || !email || !senha) {
      throw new Error(
        'Uso: npm run criar-admin -- "Nome" "email@exemplo.com" "senha"'
      );
    }

    const usuario = await autenticacaoService.criarUsuario({ nome, email, senha });

    console.log('Administrador criado com sucesso.');
    console.log('ID: ' + usuario.id);
    console.log('Nome: ' + usuario.nome);
    console.log('Email: ' + usuario.email);
  } catch (erro) {
    console.error('Não foi possível criar o administrador: ' + erro.message);
    process.exitCode = 1;
  } finally {
    await banco.end();
  }
}

executar();
