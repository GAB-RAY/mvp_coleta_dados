const express = require('express');
const multer = require('multer');
const criarAppError = require('../../utils/AppError');
const configuracaoImportacao = require('../../config/importacao');
const autorizarAdministrador = require('../../middlewares/autorizarAdministrador');
const importacaoController = require('./importacaoController');

const roteador = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: configuracaoImportacao.LIMITE_ARQUIVO_BYTES }
});

roteador.get('/', importacaoController.listar);

function receberArquivo(requisicao, resposta, proximo) {
  upload.single('arquivo')(requisicao, resposta, function (erro) {
    if (erro) {
      return proximo(criarAppError(
        'Arquivo inválido ou maior que ' +
          configuracaoImportacao.LIMITE_ARQUIVO_MEGABYTES +
          ' MB.',
        400
      ));
    }

    return proximo();
  });
}

roteador.post(
  '/pre-visualizar',
  receberArquivo,
  importacaoController.preVisualizar
);
roteador.post('/:id/confirmar', importacaoController.confirmar);
roteador.delete('/:id', autorizarAdministrador, importacaoController.excluir);

module.exports = roteador;
