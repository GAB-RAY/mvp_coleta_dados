require('dotenv').config({ quiet: true });

const childProcess = require('child_process');
const path = require('path');
const pg = require('pg');

function criarConfiguracao(nomeBanco) {
  if (process.env.DATABASE_URL) {
    const endereco = new URL(process.env.DATABASE_URL);
    endereco.pathname = '/' + nomeBanco;
    return { connectionString: endereco.toString() };
  }
  return {
    host: process.env.BANCO_HOST,
    port: Number(process.env.BANCO_PORTA) || 5432,
    user: process.env.BANCO_USUARIO,
    password: process.env.BANCO_SENHA,
    database: nomeBanco,
    ssl: process.env.BANCO_SSL === 'true'
  };
}

function lerAcesso() {
  if (process.env.DATABASE_URL) {
    const endereco = new URL(process.env.DATABASE_URL);
    return {
      host: endereco.hostname,
      porta: endereco.port || '5432',
      usuario: decodeURIComponent(endereco.username),
      senha: decodeURIComponent(endereco.password)
    };
  }
  return {
    host: process.env.BANCO_HOST,
    porta: process.env.BANCO_PORTA || '5432',
    usuario: process.env.BANCO_USUARIO,
    senha: process.env.BANCO_SENHA
  };
}

async function executar() {
  const arquivo = process.argv[2];
  const nomeBanco = process.argv[3];
  const acesso = lerAcesso();
  const caminhoPgRestore = process.env.PG_RESTORE_CAMINHO || 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe';

  if (!arquivo || !path.isAbsolute(arquivo) || !/^[a-z0-9_]+$/.test(nomeBanco || '')) {
    throw new Error('Informe o backup absoluto e o nome do banco de restauração.');
  }

  const administracao = new pg.Client(criarConfiguracao('postgres'));
  await administracao.connect();
  const existente = await administracao.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco]);
  if (existente.rows[0]) {
    throw new Error('O banco de restauração já existe: ' + nomeBanco);
  }
  await administracao.query('CREATE DATABASE "' + nomeBanco + '"');
  await administracao.end();

  const resultado = childProcess.spawnSync(caminhoPgRestore, [
    '--exit-on-error',
    '--no-owner',
    '--host=' + acesso.host,
    '--port=' + acesso.porta,
    '--username=' + acesso.usuario,
    '--dbname=' + nomeBanco,
    arquivo
  ], {
    env: Object.assign({}, process.env, { PGPASSWORD: acesso.senha }),
    encoding: 'utf8'
  });
  if (resultado.status !== 0) {
    throw new Error('pg_restore falhou: ' + (resultado.stderr || 'erro desconhecido'));
  }

  const restaurado = new pg.Client(criarConfiguracao(nomeBanco));
  await restaurado.connect();
  const resumo = await restaurado.query(
    `SELECT
      (SELECT COUNT(*)::integer FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tabelas,
      (SELECT COUNT(*)::integer FROM usuarios) AS usuarios,
      (SELECT COUNT(*)::integer FROM contatos) AS contatos,
      (SELECT COUNT(*)::integer FROM consentimentos) AS consentimentos`
  );
  await restaurado.end();
  console.log('Restauração validada em ' + nomeBanco + ': ' + JSON.stringify(resumo.rows[0]));
}

executar().catch(function (erro) {
  console.error(erro.message);
  process.exitCode = 1;
});
