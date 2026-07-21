const { Pool } = require('pg');

const banco = new Pool({
  host: process.env.BANCO_HOST,
  port: Number(process.env.BANCO_PORTA) || 5432,
  user: process.env.BANCO_USUARIO,
  password: process.env.BANCO_SENHA,
  database: process.env.BANCO_NOME
});

module.exports = banco;
