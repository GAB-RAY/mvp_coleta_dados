const express = require('express');
const autenticacaoController = require('./autenticacaoController');

const roteador = express.Router();

roteador.post('/login', autenticacaoController.login);

module.exports = roteador;
