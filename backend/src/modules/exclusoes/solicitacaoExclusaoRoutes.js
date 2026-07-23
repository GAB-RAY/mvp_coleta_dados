const express = require('express');
const controlador = require('./solicitacaoExclusaoController');
const autorizarAdministrador = require('../../middlewares/autorizarAdministrador');

const roteador = express.Router();

roteador.use(autorizarAdministrador);
roteador.get('/', controlador.listar);
roteador.post('/:id/aprovar', controlador.aprovar);
roteador.post('/:id/rejeitar', controlador.rejeitar);

module.exports = roteador;
