require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const controller = require('../src/modules/mensageria/webhookController');
const banco = require('../src/config/banco');

let verificacoes=0;
function confirmar(condicao,mensagem){if(!condicao)throw new Error(mensagem);verificacoes+=1;}
function respostaFake(){return{codigo:0,corpo:null,status:function(codigo){this.codigo=codigo;return this;},type:function(){return this;},send:function(corpo){this.corpo=corpo;return this;},json:function(corpo){this.corpo=corpo;return this;}};}

async function executar(){
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN='token-fake-teste';
  process.env.META_APP_SECRET='segredo-fake-teste';
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID='987654321';
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
  await banco.query('DELETE FROM eventos_webhook_mensageria WHERE identificador_externo=$1',['recebida:'+identificador]);
  await banco.query('DELETE FROM sincronizacoes_limite_meta WHERE id>$1',[ultimoLimiteId]);
  console.log('Webhook de mensageria: '+verificacoes+' verificacoes aprovadas.');
}

executar().catch(function(erro){console.error(erro.stack||erro.message);process.exitCode=1;}).finally(function(){return banco.end();});
