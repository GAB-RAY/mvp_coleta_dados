const express = require('express');
const relatorioController = require('./relatorioController');

const roteador = express.Router();

roteador.get('/resumo', relatorioController.resumir);
roteador.get('/exportar.csv', relatorioController.exportarCsv);

module.exports = roteador;
