const express = require('express');
const origemController = require('./origemController');

const roteador = express.Router();

roteador.get('/', origemController.listar);

module.exports = roteador;
