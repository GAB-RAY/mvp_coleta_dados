const express = require('express');
const multer = require('multer');
const autenticarUsuario = require('../../middlewares/autenticarUsuario');
const criarAppError = require('../../utils/AppError');
const importacaoController = require('./importacaoController');

const roteador = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

function receberArquivo(requisicao, resposta, proximo) {
  upload.single('arquivo')(requisicao, resposta, function (erro) {
    if (erro) {
      return proximo(criarAppError('Arquivo inválido ou maior que 5 MB.', 400));
    }

    return proximo();
  });
}

roteador.post(
  '/pre-visualizar',
  autenticarUsuario,
  receberArquivo,
  importacaoController.preVisualizar
);
roteador.post('/:id/confirmar', autenticarUsuario, importacaoController.confirmar);

module.exports = roteador;
