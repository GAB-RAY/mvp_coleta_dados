const express = require('express');
const controller = require('./webhookController');
const roteador = express.Router();

roteador.get('/', controller.verificar);
roteador.post('/', express.raw({ type: 'application/json', limit: '256kb' }), controller.receber);

module.exports = roteador;
