const express = require('express');
const testeRoutes = require('./modules/teste/testeRoutes');
const contatoRoutes = require('./modules/contatos/contatoRoutes');
const autenticacaoRoutes = require('./modules/autenticacao/autenticacaoRoutes');
const tratarErro = require('./middlewares/tratarErro');

const aplicacao = express();

aplicacao.use(express.json());
aplicacao.use('/api', testeRoutes);
aplicacao.use('/api/publico', contatoRoutes);
aplicacao.use('/api/autenticacao', autenticacaoRoutes);
aplicacao.use(tratarErro);

module.exports = aplicacao;
