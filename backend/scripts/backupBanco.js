require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

function lerConfiguracao() {
  if (process.env.DATABASE_URL) {
    const endereco = new URL(process.env.DATABASE_URL);
    return {
      host: endereco.hostname,
      porta: endereco.port || '5432',
      usuario: decodeURIComponent(endereco.username),
      senha: decodeURIComponent(endereco.password),
      banco: endereco.pathname.replace(/^\//, '')
    };
  }

  return {
    host: process.env.BANCO_HOST,
    porta: process.env.BANCO_PORTA || '5432',
    usuario: process.env.BANCO_USUARIO,
    senha: process.env.BANCO_SENHA,
    banco: process.env.BANCO_NOME
  };
}

function executar() {
  const diretorio = process.argv[2];
  const configuracao = lerConfiguracao();
  const caminhoPgDump = process.env.PG_DUMP_CAMINHO || 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';

  if (!diretorio || !path.isAbsolute(diretorio)) {
    throw new Error('Informe o diretório absoluto do backup.');
  }
  if (configuracao.banco !== 'criar_banco') {
    throw new Error('Backup recusado: o banco conectado não é criar_banco.');
  }

  fs.mkdirSync(diretorio, { recursive: true });
  const arquivoBackup = path.join(diretorio, 'criar_banco.backup');
  const resultado = childProcess.spawnSync(caminhoPgDump, [
    '--format=custom',
    '--blobs',
    '--verbose',
    '--host=' + configuracao.host,
    '--port=' + configuracao.porta,
    '--username=' + configuracao.usuario,
    '--file=' + arquivoBackup,
    configuracao.banco
  ], {
    env: Object.assign({}, process.env, { PGPASSWORD: configuracao.senha }),
    encoding: 'utf8'
  });

  if (resultado.status !== 0) {
    throw new Error('pg_dump falhou: ' + (resultado.stderr || 'erro desconhecido'));
  }

  const hash = crypto.createHash('sha256').update(fs.readFileSync(arquivoBackup)).digest('hex').toUpperCase();
  const manifesto = {
    banco: configuracao.banco,
    criadoEm: new Date().toISOString(),
    formato: 'PostgreSQL custom',
    arquivo: path.basename(arquivoBackup),
    bytes: fs.statSync(arquivoBackup).size,
    sha256: hash
  };
  fs.writeFileSync(
    path.join(diretorio, 'manifesto.json'),
    JSON.stringify(manifesto, null, 2) + '\n',
    'utf8'
  );
  console.log('Backup completo criado: ' + arquivoBackup);
  console.log('SHA-256: ' + hash);
}

try {
  executar();
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
}
