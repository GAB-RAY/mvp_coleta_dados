const express = require('express');
const contatoController = require('./contatoController');

const roteador = express.Router();

roteador.get('/', contatoController.listar);
roteador.post('/', contatoController.cadastrarManual);
roteador.post(
  '/:id/revogar-consentimentos',
  contatoController.revogarConsentimentos
);
roteador.post(
  '/:id/solicitacao-exclusao',
  contatoController.solicitarExclusao
);
roteador.get('/:id', contatoController.detalhar);

module.exports = roteador;
