const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const testeRoutes = require('./modules/teste/testeRoutes');
const contatoPublicoRoutes = require('./modules/contatos/contatoPublicoRoutes');
const contatoAdminRoutes = require('./modules/contatos/contatoAdminRoutes');
const autenticacaoRoutes = require('./modules/autenticacao/autenticacaoRoutes');
const origemRoutes = require('./modules/origens/origemRoutes');
const importacaoRoutes = require('./modules/importacoes/importacaoRoutes');
const relatorioRoutes = require('./modules/relatorios/relatorioRoutes');
const usuarioRoutes = require('./modules/usuarios/usuarioRoutes');
const autenticarUsuario = require('./middlewares/autenticarUsuario');
const rotaNaoEncontrada = require('./middlewares/rotaNaoEncontrada');
const tratarErro = require('./middlewares/tratarErro');

const aplicacao = express();

const saltosProxy = Number(process.env.TRUST_PROXY_HOPS || 0);

if (Number.isInteger(saltosProxy) && saltosProxy > 0) {
  aplicacao.set('trust proxy', saltosProxy);
}

aplicacao.use(helmet());
aplicacao.use(cors({ origin: process.env.FRONTEND_URL }));
aplicacao.use(express.json());
aplicacao.use('/api', testeRoutes);
aplicacao.use('/api/publico/contatos', contatoPublicoRoutes);
aplicacao.use('/api/autenticacao', autenticacaoRoutes);
aplicacao.use('/api/admin', autenticarUsuario);
aplicacao.use('/api/admin/contatos', contatoAdminRoutes);
aplicacao.use('/api/admin/origens', origemRoutes);
aplicacao.use('/api/admin/importacoes', importacaoRoutes);
aplicacao.use('/api/admin/relatorios', relatorioRoutes);
aplicacao.use('/api/admin/usuarios', usuarioRoutes);
aplicacao.use(rotaNaoEncontrada);
aplicacao.use(tratarErro);

module.exports = aplicacao;
