const express = require('express');
const contatoController = require('./contatoController');

const roteador = express.Router();

roteador.post('/', contatoController.cadastrar);

module.exports = roteador;
