const pg = require('pg');

let configuracaoBanco;

function lerInteiro(nome, valorPadrao, minimo, maximo) {
  const valor = Number(process.env[nome] || valorPadrao);

  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new Error(nome + ' possui valor inválido.');
  }

  return valor;
}

function criarConfiguracaoSsl() {
  if (process.env.BANCO_SSL !== 'true') {
    return false;
  }

  const configuracaoSsl = {
    rejectUnauthorized: process.env.BANCO_SSL_REJEITAR_NAO_AUTORIZADO !== 'false'
  };

  if (process.env.BANCO_SSL_CA_BASE64) {
    configuracaoSsl.ca = Buffer.from(process.env.BANCO_SSL_CA_BASE64, 'base64').toString('utf8');
  }

  return configuracaoSsl;
}

const configuracaoPool = {
  max: lerInteiro('BANCO_POOL_MAX', 5, 1, 10),
  idleTimeoutMillis: lerInteiro('BANCO_POOL_OCIOSO_MS', 30000, 1000, 600000),
  connectionTimeoutMillis: lerInteiro('BANCO_CONEXAO_TEMPO_LIMITE_MS', 5000, 500, 60000),
  maxLifetimeSeconds: lerInteiro('BANCO_CONEXAO_TEMPO_MAXIMO_SEGUNDOS', 300, 30, 3600),
  statement_timeout: lerInteiro('BANCO_COMANDO_TEMPO_LIMITE_MS', 15000, 1000, 300000),
  query_timeout: lerInteiro('BANCO_CONSULTA_TEMPO_LIMITE_MS', 20000, 1000, 300000),
  lock_timeout: lerInteiro('BANCO_BLOQUEIO_TEMPO_LIMITE_MS', 5000, 500, 60000),
  idle_in_transaction_session_timeout: lerInteiro(
    'BANCO_TRANSACAO_OCIOSA_TEMPO_LIMITE_MS',
    15000,
    1000,
    300000
  ),
  keepAlive: true,
  application_name: 'acorda-vk-api'
};

if (process.env.DATABASE_URL) {
  configuracaoBanco = Object.assign({}, configuracaoPool, {
    connectionString: process.env.DATABASE_URL
  });

  if (process.env.BANCO_SSL === 'true') {
    configuracaoBanco.ssl = criarConfiguracaoSsl();
  }
} else {
  configuracaoBanco = Object.assign({}, configuracaoPool, {
    host: process.env.BANCO_HOST,
    port: Number(process.env.BANCO_PORTA) || 5432,
    user: process.env.BANCO_USUARIO,
    password: process.env.BANCO_SENHA,
    database: process.env.BANCO_NOME,
    ssl: criarConfiguracaoSsl()
  });
}

const banco = new pg.Pool(configuracaoBanco);

banco.on('error', function (erro) {
  console.error('Falha inesperada em conexão ociosa do PostgreSQL:', erro.message);
});

module.exports = banco;
