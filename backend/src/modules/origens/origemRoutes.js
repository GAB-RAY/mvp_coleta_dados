const express = require('express');
const autenticarUsuario = require('../../middlewares/autenticarUsuario');
const origemController = require('./origemController');

const roteador = express.Router();

roteador.get('/', autenticarUsuario, origemController.listar);

module.exports = roteador;
