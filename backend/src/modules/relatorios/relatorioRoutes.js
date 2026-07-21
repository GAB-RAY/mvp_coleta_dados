const express = require('express');
const autenticarUsuario = require('../../middlewares/autenticarUsuario');
const relatorioController = require('./relatorioController');

const roteador = express.Router();

roteador.get('/resumo', autenticarUsuario, relatorioController.resumir);
roteador.get('/exportar.csv', autenticarUsuario, relatorioController.exportarCsv);

module.exports = roteador;
