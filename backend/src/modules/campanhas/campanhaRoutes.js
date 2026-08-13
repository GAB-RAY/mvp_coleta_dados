const express = require('express');
const controller = require('./campanhaController');
const autorizarAdministrador = require('../../middlewares/autorizarAdministrador');
const roteador = express.Router();

roteador.get('/templates', controller.listarTemplates);
roteador.post('/templates/sincronizar-meta', autorizarAdministrador, controller.sincronizarTemplatesMeta);
roteador.post('/templates', autorizarAdministrador, controller.criarTemplate);
roteador.post('/templates/:id/submeter-meta', autorizarAdministrador, controller.submeterTemplate);
roteador.put('/templates/:id/configuracao-envio', autorizarAdministrador, controller.configurarEnvioTemplate);
roteador.put('/templates/:id', autorizarAdministrador, controller.atualizarTemplate);
roteador.get('/configuracao/limite', controller.obterLimite);
roteador.put('/configuracao/limite', autorizarAdministrador, controller.atualizarLimite);
roteador.post('/configuracao/limite/sincronizar-meta', autorizarAdministrador, controller.sincronizarLimiteMeta);
roteador.post('/publico/previa', autorizarAdministrador, controller.visualizarPreviaFiltros);
roteador.get('/', controller.listar);
roteador.post('/', autorizarAdministrador, controller.criar);
roteador.put('/:id', autorizarAdministrador, controller.atualizar);
roteador.post('/:id/status', autorizarAdministrador, controller.alterarStatus);
roteador.get('/:id/publico', controller.visualizarPublico);
roteador.get('/:id/lotes', controller.listarLotes);
roteador.post('/:id/lotes', controller.criarLote);
roteador.get('/:id/lotes/:loteId/contatos', controller.listarContatosLote);
roteador.get('/:id/falhas', controller.listarFalhas);

module.exports = roteador;
