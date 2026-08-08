import requisitar from './api';

function listarCampanhas(){return requisitar('/api/admin/campanhas',{method:'GET',autenticado:true});}
function criarCampanha(dados){return requisitar('/api/admin/campanhas',{method:'POST',autenticado:true,body:JSON.stringify(dados)});}
function atualizarCampanha(id,dados){return requisitar('/api/admin/campanhas/'+id,{method:'PUT',autenticado:true,body:JSON.stringify(dados)});}
function alterarStatusCampanha(id,status){return requisitar('/api/admin/campanhas/'+id+'/status',{method:'POST',autenticado:true,body:JSON.stringify({status})});}
function visualizarPublicoCampanha(id,quantidade){return requisitar('/api/admin/campanhas/'+id+'/publico?quantidade='+encodeURIComponent(quantidade||250),{method:'GET',autenticado:true});}
function visualizarPreviaFiltros(filtros){return requisitar('/api/admin/campanhas/publico/previa',{method:'POST',autenticado:true,body:JSON.stringify({filtros,quantidade:20})});}
function listarLotesCampanha(id){return requisitar('/api/admin/campanhas/'+id+'/lotes',{method:'GET',autenticado:true});}
function listarContatosLote(id,loteId){return requisitar('/api/admin/campanhas/'+id+'/lotes/'+loteId+'/contatos',{method:'GET',autenticado:true});}
function listarFalhasCampanha(id){return requisitar('/api/admin/campanhas/'+id+'/falhas',{method:'GET',autenticado:true});}
function reprocessarTentativa(id){return requisitar('/api/admin/mensageria/tentativas/'+id+'/reprocessar',{method:'POST',autenticado:true});}
function criarLoteCampanha(id,tamanho,chaveIdempotencia){return requisitar('/api/admin/campanhas/'+id+'/lotes',{method:'POST',autenticado:true,body:JSON.stringify({tamanho,chaveIdempotencia})});}
function listarTemplates(){return requisitar('/api/admin/campanhas/templates',{method:'GET',autenticado:true});}
function criarTemplate(dados){return requisitar('/api/admin/campanhas/templates',{method:'POST',autenticado:true,body:JSON.stringify(dados)});}
function atualizarTemplate(id,dados){return requisitar('/api/admin/campanhas/templates/'+id,{method:'PUT',autenticado:true,body:JSON.stringify(dados)});}
function obterCapacidade(){return requisitar('/api/admin/campanhas/configuracao/limite',{method:'GET',autenticado:true});}
function atualizarLimite(valor,motivo){return requisitar('/api/admin/campanhas/configuracao/limite',{method:'PUT',autenticado:true,body:JSON.stringify({valor,motivo})});}

export {alterarStatusCampanha,atualizarCampanha,atualizarLimite,atualizarTemplate,criarCampanha,criarLoteCampanha,criarTemplate,listarCampanhas,listarContatosLote,listarFalhasCampanha,listarLotesCampanha,listarTemplates,obterCapacidade,reprocessarTentativa,visualizarPreviaFiltros,visualizarPublicoCampanha};
