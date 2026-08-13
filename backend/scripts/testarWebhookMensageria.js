require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const controller = require('../src/modules/mensageria/webhookController');
const mensageriaService = require('../src/modules/mensageria/mensageriaService');
const banco = require('../src/config/banco');

let verificacoes=0;
function confirmar(condicao,mensagem){if(!condicao)throw new Error(mensagem);verificacoes+=1;}
function respostaFake(){return{codigo:0,corpo:null,status:function(codigo){this.codigo=codigo;return this;},type:function(){return this;},send:function(corpo){this.corpo=corpo;return this;},json:function(corpo){this.corpo=corpo;return this;}};}

async function executar(){
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN='token-fake-teste';
  process.env.META_APP_SECRET='segredo-fake-teste';
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID='987654321';
  process.env.WHATSAPP_PHONE_NUMBER_ID='123456789';
  process.env.WHATSAPP_ACCESS_TOKEN='token-fake-webhook-template';
  process.env.META_GRAPH_API_VERSION='v99.0';
  const ultimoLimiteId=(await banco.query('SELECT COALESCE(MAX(id),0)::bigint id FROM sincronizacoes_limite_meta')).rows[0].id;
  let resposta=respostaFake();
  controller.verificar({query:{'hub.mode':'subscribe','hub.verify_token':'token-fake-teste','hub.challenge':'12345'}},resposta);
  confirmar(resposta.codigo===200&&resposta.corpo==='12345','GET valido deve devolver challenge.');
  resposta=respostaFake();
  controller.verificar({query:{'hub.mode':'subscribe','hub.verify_token':'invalido','hub.challenge':'123'}},resposta);
  confirmar(resposta.codigo===403,'GET invalido deve devolver 403.');
  const identificador='webhook-fake-'+Date.now();
  const corpo=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{value:{messages:[{id:identificador,type:'text'}]}}]}]}));
  const assinatura='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(corpo).digest('hex');
  resposta=respostaFake();
  await controller.receber({body:corpo,get:function(){return assinatura;}},resposta,function(erro){throw erro;});
  confirmar(resposta.codigo===200&&resposta.corpo.recebido===true,'POST assinado deve ser aceito.');
  resposta=respostaFake();
  await controller.receber({body:corpo,get:function(){return assinatura;}},resposta,function(erro){throw erro;});
  const repeticoes=(await banco.query('SELECT COUNT(*)::int total FROM eventos_webhook_mensageria WHERE identificador_externo=$1',['recebida:'+identificador])).rows[0].total;
  confirmar(resposta.codigo===200&&repeticoes===1,'Evento repetido deve permanecer idempotente.');
  resposta=respostaFake();
  await controller.receber({body:corpo,get:function(){return 'sha256=invalida';}},resposta,function(erro){throw erro;});
  confirmar(resposta.codigo===403,'Assinatura invalida deve devolver 403.');
  resposta=respostaFake();
  const malformado=Buffer.from('{');
  const assinaturaMalformada='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(malformado).digest('hex');
  await controller.receber({body:malformado,get:function(){return assinaturaMalformada;}},resposta,function(erro){throw erro;});
  confirmar(resposta.codigo===400,'Payload malformado deve devolver 400.');
  const corpoLimite=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[{id:'987654321',changes:[{field:'business_capability_update',value:{max_daily_conversations_per_business:'TIER_2K'}}]}]}));
  const assinaturaLimite='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(corpoLimite).digest('hex');
  resposta=respostaFake();
  await controller.receber({body:corpoLimite,get:function(){return assinaturaLimite;}},resposta,function(erro){throw erro;});
  const limiteWebhook=(await banco.query("SELECT tier_novo,origem,status FROM sincronizacoes_limite_meta WHERE id>$1 ORDER BY id DESC LIMIT 1",[ultimoLimiteId])).rows[0];
  confirmar(resposta.codigo===200&&limiteWebhook&&limiteWebhook.tier_novo==='TIER_2K'&&limiteWebhook.origem==='webhook_meta'&&limiteWebhook.status==='sucesso','Webhook oficial deve aumentar o limite auditado automaticamente.');
  resposta=respostaFake();
  await controller.receber({body:corpoLimite,get:function(){return assinaturaLimite;}},resposta,function(erro){throw erro;});
  const repeticoesLimite=(await banco.query("SELECT COUNT(*)::int total FROM sincronizacoes_limite_meta WHERE id>$1 AND origem='webhook_meta' AND status='sucesso'",[ultimoLimiteId])).rows[0].total;
  confirmar(resposta.codigo===200&&repeticoesLimite===1,'Webhook de capacidade repetido deve ser idempotente.');
  const corpoReducao=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[{id:'987654321',changes:[{field:'business_capability_update',value:{max_daily_conversations_per_business:'TIER_50'}}]}]}));
  const assinaturaReducao='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(corpoReducao).digest('hex');
  resposta=respostaFake();
  await controller.receber({body:corpoReducao,get:function(){return assinaturaReducao;}},resposta,function(erro){throw erro;});
  const limiteReduzido=(await banco.query("SELECT tier_novo,origem,status FROM sincronizacoes_limite_meta WHERE id>$1 ORDER BY id DESC LIMIT 1",[ultimoLimiteId])).rows[0];
  confirmar(resposta.codigo===200&&limiteReduzido.tier_novo==='TIER_50'&&limiteReduzido.origem==='webhook_meta','Webhook oficial deve reduzir o limite automaticamente.');
  const corpoLimiteAusente=Buffer.from(JSON.stringify({object:'whatsapp_business_account',entry:[{id:'987654321',changes:[{field:'business_capability_update',value:{}}]}]}));
  const assinaturaLimiteAusente='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(corpoLimiteAusente).digest('hex');
  resposta=respostaFake();
  await controller.receber({body:corpoLimiteAusente,get:function(){return assinaturaLimiteAusente;}},resposta,function(erro){throw erro;});
  const sucessosAposAusente=(await banco.query("SELECT COUNT(*)::int total FROM sincronizacoes_limite_meta WHERE id>$1 AND origem='webhook_meta' AND status='sucesso'",[ultimoLimiteId])).rows[0].total;
  confirmar(resposta.codigo===200&&sucessosAposAusente===2,'Webhook sem campo oficial deve ser ignorado sem alterar o limite.');

  const sufixo=String(Date.now());
  const templateExistenteId=sufixo+'01';
  const templateNovoId=sufixo+'02';
  const nomeExistente='template_webhook_existente_'+sufixo;
  const nomeNovo='template_webhook_novo_'+sufixo;
  let consultasTemplateExistente=0;
  const administrador=(await banco.query("SELECT id FROM usuarios WHERE perfil='administrador' AND ativo=TRUE ORDER BY id LIMIT 1")).rows[0];
  if(!administrador)throw new Error('O teste de webhook requer um administrador ativo.');
  const modeloExistente=(await banco.query(`INSERT INTO modelos_mensagem
    (nome,categoria,texto,ativo,criado_por_usuario_id,atualizado_por_usuario_id,
     meta_nome,meta_idioma,meta_categoria,meta_status,meta_template_id,
     meta_componentes,meta_status_oficial,meta_origem)
    VALUES ($1,'QA','Mensagem QA',TRUE,$2,$2,$3,'pt_BR','MARKETING','em_analise',$4,
      '[{"type":"BODY","text":"Mensagem QA"}]'::jsonb,'PENDING','meta') RETURNING id`,
  ['Template webhook existente '+sufixo,administrador.id,nomeExistente,templateExistenteId])).rows[0];
  mensageriaService.definirProviderParaTeste(async function(url){
    if(url.includes('/'+templateExistenteId+'?')){consultasTemplateExistente+=1;return {ok:true,status:200,json:async function(){return {id:templateExistenteId,name:nomeExistente,language:'pt_BR',status:'APPROVED',category:'MARKETING',components:[{type:'BODY',text:'Mensagem QA'}]};}};}
    if(url.includes('/'+templateNovoId+'?'))return {ok:true,status:200,json:async function(){return {id:templateNovoId,name:nomeNovo,language:'pt_BR',status:'PENDING',category:'UTILITY',components:[{type:'BODY',text:'Novo template QA'}]};}};
    throw new Error('Consulta Meta inesperada no webhook: '+url);
  });
  const payloadTemplate=function(id,nome,evento){return {object:'whatsapp_business_account',entry:[{id:'987654321',time:Date.now(),changes:[{field:'message_template_status_update',value:{event:evento,message_template_id:id,message_template_name:nome,message_template_language:'pt_BR'}}]}]};};
  const corpoTemplate=Buffer.from(JSON.stringify(payloadTemplate(templateExistenteId,nomeExistente,'APPROVED')));
  const assinaturaTemplate='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(corpoTemplate).digest('hex');
  resposta=respostaFake();
  await controller.receber({body:corpoTemplate,get:function(){return assinaturaTemplate;}},resposta,function(erro){throw erro;});
  const aprovadoWebhook=(await banco.query('SELECT meta_status_oficial,meta_status FROM modelos_mensagem WHERE id=$1',[modeloExistente.id])).rows[0];
  confirmar(resposta.codigo===200&&aprovadoWebhook.meta_status_oficial==='APPROVED'&&aprovadoWebhook.meta_status==='aprovado','Webhook nao atualizou automaticamente o template aprovado.');
  resposta=respostaFake();
  await controller.receber({body:corpoTemplate,get:function(){return assinaturaTemplate;}},resposta,function(erro){throw erro;});
  const historicosRepetidos=(await banco.query("SELECT COUNT(*)::int total FROM historico_modelos_mensagem_meta WHERE modelo_id=$1 AND origem='webhook_meta'",[modeloExistente.id])).rows[0].total;
  confirmar(historicosRepetidos===1,'Webhook repetido duplicou o historico do template.');
  const corpoTemplateExcluido=Buffer.from(JSON.stringify(payloadTemplate(templateExistenteId,nomeExistente,'DELETED')));
  const assinaturaTemplateExcluido='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(corpoTemplateExcluido).digest('hex');
  resposta=respostaFake();
  await controller.receber({body:corpoTemplateExcluido,get:function(){return assinaturaTemplateExcluido;}},resposta,function(erro){throw erro;});
  const excluidoWebhook=(await banco.query('SELECT meta_status_oficial,meta_status FROM modelos_mensagem WHERE id=$1',[modeloExistente.id])).rows[0];
  confirmar(resposta.codigo===200&&excluidoWebhook.meta_status_oficial==='DELETED'&&excluidoWebhook.meta_status==='indisponivel','Webhook de exclusao deve indisponibilizar o template sem consulta complementar.');
  resposta=respostaFake();
  await controller.receber({body:corpoTemplateExcluido,get:function(){return assinaturaTemplateExcluido;}},resposta,function(erro){throw erro;});
  const historicosAposExclusao=(await banco.query("SELECT COUNT(*)::int total FROM historico_modelos_mensagem_meta WHERE modelo_id=$1 AND origem='webhook_meta'",[modeloExistente.id])).rows[0].total;
  confirmar(historicosAposExclusao===2&&consultasTemplateExistente===2,'Webhook de exclusao repetido deve ser idempotente e nao consultar um recurso removido.');
  const corpoTemplateNovo=Buffer.from(JSON.stringify(payloadTemplate(templateNovoId,nomeNovo,'PENDING')));
  const assinaturaTemplateNovo='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(corpoTemplateNovo).digest('hex');
  resposta=respostaFake();
  await controller.receber({body:corpoTemplateNovo,get:function(){return assinaturaTemplateNovo;}},resposta,function(erro){throw erro;});
  const importadoWebhook=(await banco.query('SELECT id,meta_status_oficial,meta_status,criado_por_usuario_id FROM modelos_mensagem WHERE meta_template_id=$1',[templateNovoId])).rows[0];
  confirmar(resposta.codigo===200&&importadoWebhook&&importadoWebhook.meta_status_oficial==='PENDING'&&importadoWebhook.meta_status==='em_analise'&&importadoWebhook.criado_por_usuario_id===null,'Webhook nao importou automaticamente o novo template em analise.');
  const corpoTemplateInvalido=Buffer.from(JSON.stringify(payloadTemplate('',nomeNovo,'DESCONHECIDO')));
  const assinaturaTemplateInvalido='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(corpoTemplateInvalido).digest('hex');
  resposta=respostaFake();
  await controller.receber({body:corpoTemplateInvalido,get:function(){return assinaturaTemplateInvalido;}},resposta,function(erro){throw erro;});
  confirmar(resposta.codigo===200,'Evento de template invalido deve ser ignorado com seguranca.');
  await banco.query('DELETE FROM historico_modelos_mensagem_meta WHERE modelo_id=ANY($1::bigint[])',[[modeloExistente.id,importadoWebhook.id]]);
  await banco.query('DELETE FROM modelos_mensagem WHERE id=ANY($1::bigint[])',[[modeloExistente.id,importadoWebhook.id]]);
  mensageriaService.definirProviderParaTeste();
  await banco.query('DELETE FROM eventos_webhook_mensageria WHERE identificador_externo=$1',['recebida:'+identificador]);
  await banco.query('DELETE FROM sincronizacoes_limite_meta WHERE id>$1',[ultimoLimiteId]);
  console.log('Webhook de mensageria: '+verificacoes+' verificacoes aprovadas.');
}

executar().catch(function(erro){console.error(erro.stack||erro.message);process.exitCode=1;}).finally(function(){return banco.end();});
