const express = require('express');
const relatorioController = require('./relatorioController');
const autorizarAdministrador = require('../../middlewares/autorizarAdministrador');

const roteador = express.Router();

roteador.get('/resumo', relatorioController.resumir);
roteador.get('/exportar.csv', autorizarAdministrador, relatorioController.exportarCsv);
roteador.get('/exportar.xlsx', autorizarAdministrador, relatorioController.exportarExcel);

module.exports = roteador;
