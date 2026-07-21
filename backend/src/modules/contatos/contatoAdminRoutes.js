const express = require('express');
const contatoController = require('./contatoController');
const autenticarUsuario = require('../../middlewares/autenticarUsuario');

const roteador = express.Router();

roteador.get('/', autenticarUsuario, contatoController.listar);
roteador.post('/', autenticarUsuario, contatoController.cadastrarManual);
roteador.get('/:id', autenticarUsuario, contatoController.detalhar);

module.exports = roteador;
