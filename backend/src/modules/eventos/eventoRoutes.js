const express = require('express');
const eventoController = require('./eventoController');
const autorizarAdministrador = require('../../middlewares/autorizarAdministrador');

const roteador = express.Router();

roteador.get('/', eventoController.listar);
roteador.post('/', autorizarAdministrador, eventoController.criar);
roteador.put('/:id', autorizarAdministrador, eventoController.editar);
roteador.post('/:id/ativar', autorizarAdministrador, eventoController.ativar);
roteador.post('/:id/encerrar', autorizarAdministrador, eventoController.encerrar);

module.exports = roteador;
