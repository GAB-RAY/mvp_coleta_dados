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
  await banco.query('DELETE FROM eventos_webhook_mensageria WHERE identificador_externo=$1',['recebida:'+identificador]);
  console.log('Webhook de mensageria: '+verificacoes+' verificacoes aprovadas.');
}

executar().catch(function(erro){console.error(erro.stack||erro.message);process.exitCode=1;}).finally(function(){return banco.end();});
