const express = require('express');
const controller = require('./mensageriaController');
const roteador = express.Router();

roteador.post('/tentativas/:id/reprocessar', controller.reprocessar);

module.exports = roteador;
