const express = require('express');
const controller = require('./comunicacaoController');
const autorizarAdministrador = require('../../middlewares/autorizarAdministrador');

const roteador = express.Router();

roteador.get('/numeros', controller.listarNumeros);
roteador.post('/numeros', autorizarAdministrador, controller.criarNumero);
roteador.put('/numeros/:id', autorizarAdministrador, controller.editarNumero);
roteador.delete('/numeros/:id', autorizarAdministrador, controller.excluirNumero);
roteador.get('/modelos', controller.listarModelos);
roteador.post('/modelos', autorizarAdministrador, controller.criarModelo);
roteador.put('/modelos/:id', autorizarAdministrador, controller.editarModelo);
roteador.get('/campanhas', controller.listarCampanhas);
roteador.post('/campanhas', autorizarAdministrador, controller.criarCampanha);
roteador.put('/campanhas/:id', autorizarAdministrador, controller.editarCampanha);
roteador.get('/operadores', controller.listarOperadores);
roteador.get('/contatos', controller.listarContatos);
roteador.get('/:id/historico', controller.listarHistorico);
roteador.post('/preparadas/confirmar-envio', controller.confirmarPreparadas);
roteador.post('/desfazer-confirmacoes', controller.desfazerConfirmacoes);
roteador.post('/:id/desfazer-confirmacao', controller.desfazerConfirmacao);
roteador.post('/:id/confirmar-envio', controller.confirmarEnvio);
roteador.delete('/preparadas', controller.cancelarPreparadas);
roteador.delete('/:id', controller.cancelarPreparada);
roteador.get('/', controller.listar);
roteador.post('/preparar', controller.preparar);
roteador.patch('/:id', controller.atualizar);

module.exports = roteador;
