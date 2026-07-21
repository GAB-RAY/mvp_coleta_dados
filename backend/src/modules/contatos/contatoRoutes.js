const express = require('express');
const contatoController = require('./contatoController');

const roteador = express.Router();

roteador.post('/contatos', contatoController.cadastrarContato);

module.exports = roteador;
