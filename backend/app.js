const express = require('express');
const rotasTeste = require('./rotas/testeRotas');

const aplicacao = express();

aplicacao.use(express.json());
aplicacao.use('/api', rotasTeste);

module.exports = aplicacao;
