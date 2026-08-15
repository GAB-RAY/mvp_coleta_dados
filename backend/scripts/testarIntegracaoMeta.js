require('dotenv').config({ quiet: true });

process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso-nao-real';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321';
process.env.META_GRAPH_API_VERSION = 'v99.0';
process.env.META_REQUISICAO_TIMEOUT_MS = '30';

const crypto = require('crypto');
const banco = require('../src/config/banco');
const mensageriaService = require('../src/modules/mensageria/mensageriaService');
const metaProvider = require('../src/modules/mensageria/metaCloudApiProvider');

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

async function criarCenario(sufixo, metaStatus, reservadoEm) {
  const usuario = (await banco.query("SELECT id FROM usuarios WHERE ativo=TRUE ORDER BY id LIMIT 1")).rows[0];
  const origem = (await banco.query("SELECT id FROM origens WHERE ativa=TRUE ORDER BY id LIMIT 1")).rows[0];
  const template = (await banco.query(`INSERT INTO modelos_mensagem
    (nome,categoria,texto,ativo,meta_nome,meta_idioma,meta_categoria,meta_status,
      meta_template_id,meta_status_oficial,meta_componentes,criado_por_usuario_id,atualizado_por_usuario_id)
    VALUES ($1,'Teste','Mensagem de teste',TRUE,'template_teste','pt_BR','MARKETING',$2,$4,$5,'[{"type":"BODY","text":"Mensagem de teste"}]',$3,$3) RETURNING id`,
  ['Teste Meta ' + sufixo, metaStatus, usuario.id,'meta-'+sufixo,metaStatus==='aprovado'?'APPROVED':'PENDING'])).rows[0];
  const contato = (await banco.query(`INSERT INTO contatos
    (nome,telefone,telefone_normalizado,bairro,problema,consentimento_armazenamento,origem_id)
    VALUES ($1,$2,$2,'Centro','Teste',TRUE,$3) RETURNING id`, ['Contato Meta ' + sufixo, '2199' + sufixo.padStart(7,'0').slice(-7), origem.id])).rows[0];
  const campanha = (await banco.query(`INSERT INTO campanhas
    (nome,descricao,finalidade,modelo_id,filtros_snapshot,status,ativo,responsavel_usuario_id,criado_por_usuario_id,atualizado_por_usuario_id)
    VALUES ($1,'Teste','Teste',$2,'{}','ativa',TRUE,$3,$3,$3) RETURNING id`, ['Campanha Meta ' + sufixo, template.id, usuario.id])).rows[0];
  const lote = (await banco.query(`INSERT INTO campanha_lotes
    (campanha_id,tamanho_solicitado,tamanho_efetivo,ordem,chave_idempotencia,criado_por_usuario_id)
    VALUES ($1,1,1,1,$2,$3) RETURNING id`, [campanha.id, crypto.randomUUID(), usuario.id])).rows[0];
  const participacao = (await banco.query(`INSERT INTO campanha_participacoes
    (campanha_id,contato_id,lote_original_id,status,reservado_em) VALUES ($1,$2,$3,'pendente',$4) RETURNING id`,
  [campanha.id, contato.id, lote.id, reservadoEm || new Date()])).rows[0];
  const tentativa = (await banco.query(`INSERT INTO campanha_tentativas
    (participacao_id,numero_tentativa,status) VALUES ($1,1,'pendente') RETURNING id`, [participacao.id])).rows[0];
  return { campanha, contato, lote, participacao, template, tentativa };
}

async function limpar(cenarios) {
  const campanhas = cenarios.map(function (item) { return item.campanha.id; });
  const contatos = cenarios.map(function (item) { return item.contato.id; });
  const templates = cenarios.map(function (item) { return item.template.id; });
  if (campanhas.length) {
    await banco.query('DELETE FROM historico_status_mensageria WHERE participacao_id IN (SELECT id FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[]))', [campanhas]);
    await banco.query('DELETE FROM campanha_tentativas WHERE participacao_id IN (SELECT id FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[]))', [campanhas]);
    await banco.query('DELETE FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[])', [campanhas]);
    await banco.query('DELETE FROM campanha_lotes WHERE campanha_id=ANY($1::bigint[])', [campanhas]);
    await banco.query('DELETE FROM campanhas WHERE id=ANY($1::bigint[])', [campanhas]);
  }
  if (contatos.length) {
    await banco.query('DELETE FROM historico_contatos WHERE contato_id=ANY($1::bigint[])', [contatos]);
    await banco.query('DELETE FROM consentimentos WHERE contato_id=ANY($1::bigint[])', [contatos]);
    await banco.query('DELETE FROM contatos WHERE id=ANY($1::bigint[])', [contatos]);
  }
  if (templates.length) {
    await banco.query('DELETE FROM historico_modelos_mensagem_meta WHERE modelo_id=ANY($1::bigint[])', [templates]);
    await banco.query('DELETE FROM modelos_mensagem WHERE id=ANY($1::bigint[])', [templates]);
  }
  await banco.query("DELETE FROM eventos_webhook_mensageria WHERE identificador_externo LIKE 'recebida:wamid.optout.%'");
}

async function executar() {
  const cenarios = [];
  let chamadas = 0;
  const limiteOriginal=(await banco.query("SELECT valor_inteiro FROM configuracoes_sistema WHERE chave='limite_mensagens_24h'")).rows[0].valor_inteiro;
  try {
    const aprovado = await criarCenario('8100001', 'aprovado'); cenarios.push(aprovado);
    mensageriaService.definirProviderParaTeste(async function (url, opcoes) {
      chamadas += 1;
      confirmar(url.endsWith('/v99.0/123456789/messages'), 'Endpoint oficial incorreto.');
      const payload = JSON.parse(opcoes.body);
      confirmar(payload.type === 'template' && payload.template.name === 'template_teste', 'Comando oficial incorreto.');
      confirmar(opcoes.headers.Authorization === 'Bearer token-falso-nao-real', 'Token nao enviado ao provider.');
      return { ok: true, status: 200, json: async function () { return { messages: [{ id: 'wamid.mock.1' }] }; } };
    });
    const resultado = await mensageriaService.enviar(aprovado.tentativa.id);
    confirmar(resultado.identificadorExterno === 'wamid.mock.1', 'ID externo nao salvo.');
    const persistida = (await banco.query('SELECT status,identificador_externo FROM campanha_tentativas WHERE id=$1',[aprovado.tentativa.id])).rows[0];
    confirmar(persistida.status === 'enviada' && persistida.identificador_externo === 'wamid.mock.1','Sucesso nao persistido.');
    const repetida = await Promise.allSettled([mensageriaService.enviar(aprovado.tentativa.id),mensageriaService.enviar(aprovado.tentativa.id)]);
    confirmar(repetida.every(function(item){return item.status==='rejected';}) && chamadas===1,'Envio duplicado nao foi bloqueado.');

    metaProvider.definirFetchParaTeste(function(url,opcoes){
      return new Promise(function(resolve,reject){opcoes.signal.addEventListener('abort',function(){const erro=new Error('abortado');erro.name='AbortError';reject(erro);});});
    });
    await confirmarRejeicao(metaProvider.enviarTemplate({telefone:'5521999999999',templateNome:'template_teste',templateIdioma:'pt_BR',templateOrigem:'meta',templateStatusOficial:'APPROVED'}),'tempo esperado');

    const concorrente = await criarCenario('8100005', 'aprovado'); cenarios.push(concorrente);
    const chamadasAntes = chamadas;
    mensageriaService.definirProviderParaTeste(async function(){chamadas+=1;await new Promise(function(resolve){setTimeout(resolve,15);});return {ok:true,status:200,json:async function(){return {messages:[{id:'wamid.mock.concorrente'}]};}};});
    const concorrencia=await Promise.allSettled([mensageriaService.enviar(concorrente.tentativa.id),mensageriaService.enviar(concorrente.tentativa.id)]);
    confirmar(concorrencia.filter(function(item){return item.status==='fulfilled';}).length===1 && chamadas===chamadasAntes+1,'Concorrencia produziu envio duplicado.');

    const rascunho = await criarCenario('8100002', 'rascunho'); cenarios.push(rascunho);
    const chamadasAntesRascunho = chamadas;
    await confirmarRejeicao(mensageriaService.enviar(rascunho.tentativa.id),'template precisa estar aprovado');
    confirmar(chamadas===chamadasAntesRascunho,'Template nao aprovado chegou ao provider.');

    const recusado = await criarCenario('8100007', 'aprovado'); cenarios.push(recusado);
    await banco.query(`INSERT INTO consentimentos
      (contato_id,contato_id_original,tipo,resposta,texto_apresentado,versao_texto,canal,origem_registro,ativo,estado,origem_id)
      VALUES ($1,$1,'mensagens',FALSE,'Texto teste','v1','cadastro_manual','resposta_expressa',TRUE,'recusado',(SELECT origem_id FROM contatos WHERE id=$1))`,[recusado.contato.id]);
    const chamadasAntesRecusa = chamadas;
    await confirmarRejeicao(mensageriaService.enviar(recusado.tentativa.id),'recusou');
    confirmar(chamadas===chamadasAntesRecusa,'Contato com recusa expressa chegou ao provider.');

    const usadosAgora=(await banco.query("SELECT COUNT(*)::integer total FROM campanha_participacoes WHERE reservado_em>=CURRENT_TIMESTAMP-INTERVAL '24 hours'")).rows[0].total;
    await banco.query("UPDATE configuracoes_sistema SET valor_inteiro=$1 WHERE chave='limite_mensagens_24h'",[Math.max(1,usadosAgora)]);
    const semCapacidade=await criarCenario('8100006','aprovado',new Date(Date.now()-90000000));cenarios.push(semCapacidade);
    const chamadasAntesCapacidade=chamadas;
    await confirmarRejeicao(mensageriaService.enviar(semCapacidade.tentativa.id),'capacidade');
    confirmar(chamadas===chamadasAntesCapacidade,'Capacidade foi validada depois do provider.');
    await banco.query("UPDATE configuracoes_sistema SET valor_inteiro=$1 WHERE chave='limite_mensagens_24h'",[limiteOriginal]);

    const falha = await criarCenario('8100003', 'aprovado'); cenarios.push(falha);
    mensageriaService.definirProviderParaTeste(async function(){chamadas+=1;return {ok:false,status:401,json:async function(){return {error:{code:190,message:'token-falso-nao-real segredo'}};}};});
    await confirmarRejeicao(mensageriaService.enviar(falha.tentativa.id),'credencial da Meta');
    const erroSalvo=(await banco.query('SELECT codigo_erro_externo,descricao_erro FROM campanha_tentativas WHERE id=$1',[falha.tentativa.id])).rows[0];
    confirmar(erroSalvo.codigo_erro_externo==='190' && !erroSalvo.descricao_erro.includes('token-falso'),'Erro Meta nao foi sanitizado.');

    const optout = await criarCenario('8100004', 'aprovado'); cenarios.push(optout);
    await banco.query(`INSERT INTO consentimentos
      (contato_id,contato_id_original,tipo,resposta,texto_apresentado,versao_texto,canal,origem_registro,ativo,estado,origem_id)
      VALUES ($1,$1,'mensagens',TRUE,'Texto teste','v1','formulario_publico','resposta_expressa',TRUE,'autorizado',(SELECT origem_id FROM contatos WHERE id=$1))`,[optout.contato.id]);
    const identificadorOptout='wamid.optout.'+crypto.randomUUID();
    const respostaOptout=await mensageriaService.processarWebhook({entry:[{changes:[{value:{messages:[{
      id:identificadorOptout,from:'55'+('2199'+'8100004'.padStart(7,'0').slice(-7)),type:'button',button:{payload:'nao_quero_mais_receber',text:'Nao quero mais receber'}
    }]}}]}]});
    confirmar(respostaOptout[0].processado===true,'Opt-out nao processado.');
    const bloqueado=(await banco.query('SELECT bloqueado_para_mensagens FROM contatos WHERE id=$1',[optout.contato.id])).rows[0];
    confirmar(bloqueado.bloqueado_para_mensagens===true,'Bloqueio global nao persistido.');
    await confirmarRejeicao(mensageriaService.enviar(optout.tentativa.id),'bloqueou mensagens');
    const repeticao=await mensageriaService.processarWebhook({entry:[{changes:[{value:{messages:[{id:identificadorOptout,from:'5521998100004',type:'button',button:{payload:'nao_quero_mais_receber'}}]}}]}]});
    confirmar(repeticao[0].motivo==='evento_repetido','Opt-out repetido nao foi idempotente.');

    console.log('Integracao Meta com mocks: 16 verificacoes aprovadas.');
  } finally {
    mensageriaService.definirProviderParaTeste();
    await banco.query("UPDATE configuracoes_sistema SET valor_inteiro=$1 WHERE chave='limite_mensagens_24h'",[limiteOriginal]);
    await limpar(cenarios);
    await banco.end();
  }
}

async function confirmarRejeicao(promessa, trecho) {
  try { await promessa; }
  catch (erro) { confirmar(erro.message.toLowerCase().includes(trecho.toLowerCase()), 'Erro inesperado: '+erro.message); return; }
  throw new Error('A operacao deveria ter sido bloqueada.');
}

executar().catch(function(erro){console.error(erro.stack||erro.message);process.exitCode=1;});
