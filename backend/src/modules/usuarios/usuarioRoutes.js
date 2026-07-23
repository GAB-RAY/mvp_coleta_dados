const express = require('express');
const autorizarAdministrador = require('../../middlewares/autorizarAdministrador');
const usuarioController = require('./usuarioController');

const roteador = express.Router();

roteador.get('/', autorizarAdministrador, usuarioController.listar);
roteador.post('/', autorizarAdministrador, usuarioController.criar);
roteador.patch(
  '/meu-perfil',
  autorizarAdministrador,
  usuarioController.atualizarProprioNome
);
roteador.patch(
  '/:id/senha',
  autorizarAdministrador,
  usuarioController.redefinirSenha
);

module.exports = roteador;
