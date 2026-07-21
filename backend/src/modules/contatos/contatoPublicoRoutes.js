const express = require('express');
const contatoController = require('./contatoController');

const roteador = express.Router();

roteador.get('/opcoes', contatoController.listarOpcoes);
roteador.post('/', contatoController.cadastrar);

module.exports = roteador;
