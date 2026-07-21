const pg = require('pg');

let configuracaoBanco;

if (process.env.DATABASE_URL) {
  configuracaoBanco = {
    connectionString: process.env.DATABASE_URL
  };
} else {
  configuracaoBanco = {
    host: process.env.BANCO_HOST,
    port: Number(process.env.BANCO_PORTA) || 5432,
    user: process.env.BANCO_USUARIO,
    password: process.env.BANCO_SENHA,
    database: process.env.BANCO_NOME
  };
}

const banco = new pg.Pool(configuracaoBanco);

module.exports = banco;
