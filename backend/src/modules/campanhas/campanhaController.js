const service = require('./campanhaService');

async function responder(next, acao) { try { return await acao(); } catch (erro) { return next(erro); } }
function listar(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Campanhas listadas com sucesso.',campanhas:await service.listar()});});}
function criar(req,res,next){return responder(next,async function(){return res.status(201).json({mensagem:'Campanha criada com sucesso.',campanha:await service.criar(req.body,req.usuario)});});}
function atualizar(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Campanha atualizada com sucesso.',campanha:await service.atualizar(req.params.id,req.body,req.usuario)});});}
function alterarStatus(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Status da campanha atualizado com sucesso.',campanha:await service.alterarStatus(req.params.id,req.body.status,req.usuario)});});}
function visualizarPublico(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Publico calculado com sucesso.',publico:await service.visualizarPublico(req.params.id,req.query.quantidade)});});}
function visualizarPreviaFiltros(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Previa calculada com sucesso.',publico:await service.visualizarPreviaFiltros(req.body)});});}
function criarLote(req,res,next){return responder(next,async function(){const resultado=await service.criarLote(req.params.id,req.body,req.usuario);return res.status(resultado.repetido?200:201).json({mensagem:resultado.repetido?'Lote ja criado para esta solicitacao.':'Lote criado com sucesso.',resultado});});}
function listarLotes(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Lotes listados com sucesso.',lotes:await service.listarLotes(req.params.id)});});}
function listarContatosLote(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Contatos do lote listados com sucesso.',contatos:await service.listarContatosLote(req.params.id,req.params.loteId)});});}
function listarFalhas(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Falhas listadas com sucesso.',falhas:await service.listarFalhas(req.params.id)});});}
function obterLimite(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Capacidade consultada com sucesso.',capacidade:await service.obterLimite()});});}
function atualizarLimite(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Limite atualizado com sucesso.',capacidade:await service.atualizarLimite(req.body,req.usuario)});});}
function sincronizarLimiteMeta(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Limite oficial sincronizado com sucesso.',capacidade:await service.sincronizarLimiteMeta(req.usuario)});});}
function listarTemplates(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Templates listados com sucesso.',templates:await service.listarTemplates()});});}
function criarTemplate(req,res,next){return responder(next,async function(){return res.status(201).json({mensagem:'Template criado com sucesso.',template:await service.salvarTemplate(null,req.body,req.usuario)});});}
function atualizarTemplate(req,res,next){return responder(next,async function(){return res.status(200).json({mensagem:'Template atualizado com sucesso.',template:await service.salvarTemplate(req.params.id,req.body,req.usuario)});});}

module.exports={alterarStatus,atualizar,atualizarLimite,atualizarTemplate,criar,criarLote,criarTemplate,listar,listarContatosLote,listarFalhas,listarLotes,listarTemplates,obterLimite,sincronizarLimiteMeta,visualizarPreviaFiltros,visualizarPublico};
