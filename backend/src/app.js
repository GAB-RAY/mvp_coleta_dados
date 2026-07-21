const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const testeRoutes = require('./modules/teste/testeRoutes');
const contatoPublicoRoutes = require('./modules/contatos/contatoPublicoRoutes');
const contatoAdminRoutes = require('./modules/contatos/contatoAdminRoutes');
const autenticacaoRoutes = require('./modules/autenticacao/autenticacaoRoutes');
const rotaNaoEncontrada = require('./middlewares/rotaNaoEncontrada');
const tratarErro = require('./middlewares/tratarErro');

const aplicacao = express();

aplicacao.use(helmet());
aplicacao.use(cors({ origin: process.env.FRONTEND_URL }));
aplicacao.use(express.json());
aplicacao.use('/api', testeRoutes);
aplicacao.use('/api/publico/contatos', contatoPublicoRoutes);
aplicacao.use('/api/admin/contatos', contatoAdminRoutes);
aplicacao.use('/api/autenticacao', autenticacaoRoutes);
aplicacao.use(rotaNaoEncontrada);
aplicacao.use(tratarErro);

module.exports = aplicacao;
