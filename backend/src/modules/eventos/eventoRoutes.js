const express = require('express');
const eventoController = require('./eventoController');
const autorizarAdministrador = require('../../middlewares/autorizarAdministrador');

const roteador = express.Router();

roteador.get('/', eventoController.listar);
roteador.get('/:id/participantes', eventoController.listarParticipantes);
roteador.patch('/:id/participantes/:contatoId', eventoController.atualizarStatusInscricao);
roteador.post('/', autorizarAdministrador, eventoController.criar);
roteador.put('/:id', autorizarAdministrador, eventoController.editar);
roteador.delete('/:id', autorizarAdministrador, eventoController.excluir);
roteador.post('/:id/ativar', autorizarAdministrador, eventoController.ativar);
roteador.post('/:id/encerrar', autorizarAdministrador, eventoController.encerrar);

module.exports = roteador;
