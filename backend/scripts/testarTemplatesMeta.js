require('dotenv').config({ quiet: true });

process.env.WHATSAPP_ACCESS_TOKEN='token-falso-template';
process.env.WHATSAPP_PHONE_NUMBER_ID='123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID='987654321';
process.env.META_APP_ID='1122334455';
process.env.META_GRAPH_API_VERSION='v99.0';
process.env.META_REQUISICAO_TIMEOUT_MS='30';
process.env.WHATSAPP_OPTOUT_BUTTON_ID='nao_quero_mais_receber';

const banco=require('../src/config/banco');
const campanhaModel=require('../src/modules/campanhas/campanhaModel');
const sincronizacaoAutomaticaTemplates=require('../src/modules/campanhas/sincronizacaoAutomaticaTemplates');
const templateService=require('../src/modules/campanhas/templateMetaService');
const provider=require('../src/modules/mensageria/metaCloudApiProvider');

let verificacoes=0;
function confirmar(condicao,mensagem){if(!condicao)throw new Error(mensagem);verificacoes+=1;}
async function rejeitar(promessa,trecho){try{await promessa;}catch(erro){confirmar(erro.message.toLowerCase().includes(trecho.toLowerCase()),'Erro inesperado: '+erro.message);return;}throw new Error('A operacao deveria falhar.');}

function dadosRascunho(sufixo){return {
  nome:'Template QA '+sufixo,categoria:'QA',metaNome:'template_qa_'+sufixo,
  metaIdioma:'pt_BR',metaCategoria:'MARKETING',ativo:true,
  componentes:[
    {type:'HEADER',format:'IMAGE',handleExemplo:'handle-falso-'+sufixo},
    {type:'BODY',text:'Olá {{1}}, confira nossa ação.',exemplos:['Maria']},
    {type:'FOOTER',text:'ACORDA RJ'},
    {type:'BUTTONS',buttons:[{type:'QUICK_REPLY',text:'Não quero mais receber'}]}
  ],
  configuracaoEnvio:{cabecalho:{tipo:'imagem',origem:'link',valor:'https://example.com/imagem.jpg'},corpo:[{origem:'nome_contato'}],botoes:[{indice:0,subtipo:'quick_reply',origem:'opt_out'}]}
};}

async function executar(){
  const usuario=(await banco.query("SELECT id FROM usuarios WHERE ativo=TRUE AND perfil='administrador' ORDER BY id LIMIT 1")).rows[0];
  if(!usuario)throw new Error('O teste requer um administrador local ativo.');
  const oficiaisPreexistentes=(await banco.query(`SELECT meta_template_id AS id,meta_nome AS name,
    meta_idioma AS language,meta_status_oficial AS status,meta_categoria AS category,
    COALESCE(meta_componentes,'[]'::jsonb) AS components FROM modelos_mensagem
    WHERE meta_template_id IS NOT NULL`)).rows;
  const ids=[];let posts=0;let pagina=0;
  try{
    const preparado=templateService.prepararRascunho(dadosRascunho('valido'));
    confirmar(preparado.componentes.length===4&&preparado.configuracaoEnvio.botoes[0].origem==='opt_out','Template com imagem, parametro e quick reply nao foi normalizado.');
    const imagemPng=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('imagem-falsa-qa')]);
    let etapaUpload=0;
    provider.definirFetchParaTeste(async function(url,opcoes){
      etapaUpload+=1;
      confirmar(opcoes.headers.Authorization==='Bearer token-falso-template','Token do upload nao ficou restrito ao backend.');
      if(etapaUpload===1){
        confirmar(url.includes('/v99.0/1122334455/uploads?')&&url.includes('file_type=image%2Fpng'),'Sessao oficial de upload foi montada incorretamente.');
        return {ok:true,status:200,json:async function(){return {id:'upload:sessao-falsa'};}};
      }
      confirmar(url.endsWith('/v99.0/upload:sessao-falsa')&&opcoes.headers.file_offset==='0'&&Buffer.isBuffer(opcoes.body),'Conteudo binario nao foi enviado para a sessao oficial.');
      return {ok:true,status:200,json:async function(){return {h:'4::handle-oficial-falso'};}};
    });
    const imagemPreparada=await templateService.prepararImagem({buffer:imagemPng,mimetype:'image/png'});
    confirmar(etapaUpload===2&&imagemPreparada.handle==='4::handle-oficial-falso','Upload oficial da imagem de exemplo nao retornou o handle esperado.');
    await rejeitar(templateService.prepararImagem({buffer:Buffer.from('nao-e-imagem'),mimetype:'image/png'}),'jpg ou png valido');
    let uploadEnvio=0;
    provider.definirFetchParaTeste(async function(url,opcoes){
      uploadEnvio+=1;
      confirmar(url.endsWith('/v99.0/123456789/media')&&opcoes.method==='POST','Endpoint oficial de upload da imagem de envio incorreto.');
      confirmar(opcoes.body instanceof FormData&&opcoes.body.get('messaging_product')==='whatsapp','Formulario oficial da imagem de envio incorreto.');
      const arquivo=opcoes.body.get('file');
      confirmar(arquivo&&arquivo.type==='image/png','Arquivo da imagem de envio nao foi preservado.');
      return {ok:true,status:200,json:async function(){return {id:'media-id-falso'};}};
    });
    const imagemEnvio=await templateService.prepararImagemEnvio({buffer:imagemPng,mimetype:'image/png',originalname:'campanha.png'});
    confirmar(uploadEnvio===1&&imagemEnvio.id==='media-id-falso','Media ID oficial nao permaneceu interno no backend.');
    await rejeitar(Promise.resolve().then(function(){return templateService.prepararRascunho(Object.assign({},dadosRascunho('invalido'),{componentes:[{type:'BODY',text:'Oi {{2}}',exemplos:['X']}]}));}),'sequenciais');
    await rejeitar(Promise.resolve().then(function(){const dados=dadosRascunho('botao_sem_configuracao');dados.configuracaoEnvio.botoes=[];return templateService.prepararRascunho(dados);}), 'configure todos os botoes');

    const rascunho=await templateService.salvarRascunho(null,dadosRascunho('submeter'),usuario);ids.push(rascunho.id);
    provider.definirFetchParaTeste(async function(url,opcoes){
      confirmar(opcoes.headers.Authorization==='Bearer token-falso-template','Token nao ficou restrito ao backend.');
      if(url.includes('name=template_qa_submeter'))return {ok:true,status:200,json:async function(){return {data:[]};}};
      if(opcoes.method==='POST'&&url.endsWith('/v99.0/987654321/message_templates')){
        posts+=1;const payload=JSON.parse(opcoes.body);
        confirmar(payload.components[0].format==='IMAGE'&&payload.components[3].buttons[0].type==='QUICK_REPLY','Payload oficial perdeu components.');
        return {ok:true,status:200,json:async function(){return {id:'900001',status:'PENDING',category:'MARKETING'};}};
      }
      throw new Error('Chamada Meta inesperada: '+url);
    });
    const concorrentes=await Promise.all([templateService.submeter(rascunho.id,usuario),templateService.submeter(rascunho.id,usuario)]);
    confirmar(posts===1&&concorrentes.some(function(item){return item.repetido;}),'Submissao concorrente criou template duplicado.');
    const persistido=await banco.query('SELECT meta_template_id,meta_status_oficial,meta_status FROM modelos_mensagem WHERE id=$1',[rascunho.id]);
    confirmar(persistido.rows[0].meta_template_id==='900001'&&persistido.rows[0].meta_status_oficial==='PENDING'&&persistido.rows[0].meta_status==='em_analise','ID ou PENDING nao foi persistido.');

    const antigo=(await banco.query(`INSERT INTO modelos_mensagem
      (nome,categoria,texto,ativo,meta_nome,meta_idioma,meta_categoria,meta_status,
       meta_template_id,meta_status_oficial,meta_origem,criado_por_usuario_id,atualizado_por_usuario_id)
      VALUES ('Template antigo QA','QA','Antigo',TRUE,'template_antigo_qa','pt_BR','MARKETING',
       'aprovado','900099','APPROVED','meta',$1,$1) RETURNING id`,[usuario.id])).rows[0];
    ids.push(antigo.id);

    provider.definirFetchParaTeste(async function(url){
      pagina+=1;
      if(!url.includes('after='))return {ok:true,status:200,json:async function(){return {data:[{id:'900001',name:'template_qa_submeter',language:'pt_BR',status:'APPROVED',category:'MARKETING',components:preparado.componentes}].concat(oficiaisPreexistentes),paging:{next:'oficial',cursors:{after:'cursor2'}}};}};
      return {ok:true,status:200,json:async function(){return {data:[{id:'900002',name:'template_externo',language:'pt_BR',status:'REJECTED',category:'UTILITY',components:[{type:'BODY',text:'Externo'}]}]};}};
    });
    const sync=await templateService.sincronizar(usuario);
    const externo=(await banco.query("SELECT id,meta_status FROM modelos_mensagem WHERE meta_template_id='900002'")).rows[0];ids.push(externo.id);
    confirmar(pagina===2&&sync.total===2+oficiaisPreexistentes.length&&externo.meta_status==='rejeitado','Paginacao ou importacao externa falhou.');
    const antigoIndisponivel=(await banco.query("SELECT meta_status_oficial,meta_status FROM modelos_mensagem WHERE id=$1",[antigo.id])).rows[0];
    confirmar(sync.indisponibilizados===1&&antigoIndisponivel.meta_status_oficial==='NOT_FOUND'&&antigoIndisponivel.meta_status==='indisponivel','Template ausente na conta oficial permaneceu aprovado.');
    const templatesOperacionais=await campanhaModel.listarTemplates();
    confirmar(!templatesOperacionais.some(function(item){return item.id===antigo.id;}),'Template ausente da WABA atual permaneceu visivel na lista operacional.');
    const aprovado=(await banco.query("SELECT meta_status_oficial,meta_status FROM modelos_mensagem WHERE meta_template_id='900001'")).rows[0];
    confirmar(aprovado.meta_status_oficial==='APPROVED'&&aprovado.meta_status==='aprovado','Mudanca PENDING para APPROVED falhou.');
    pagina=0;const repetido=await templateService.sincronizar(usuario);
    confirmar(repetido.criados===0&&repetido.inalterados===2+oficiaisPreexistentes.length,'Sincronizacao repetida nao foi idempotente: '+JSON.stringify(repetido));
    provider.definirFetchParaTeste(async function(){return {ok:true,status:200,json:async function(){return {data:[
      {id:'900001',name:'template_qa_submeter',language:'pt_BR',status:'DISABLED',category:'MARKETING',components:preparado.componentes},
      {id:'900002',name:'template_externo',language:'pt_BR',status:'REJECTED',category:'UTILITY',components:[{type:'BODY',text:'Externo'}]}
    ].concat(oficiaisPreexistentes)};}};});
    await templateService.sincronizar(usuario);
    const desabilitado=(await banco.query("SELECT meta_status_oficial,meta_status FROM modelos_mensagem WHERE meta_template_id='900001'")).rows[0];
    confirmar(desabilitado.meta_status_oficial==='DISABLED'&&desabilitado.meta_status==='indisponivel','Mudanca APPROVED para estado nao elegivel falhou.');
    provider.definirFetchParaTeste(async function(){return {ok:true,status:200,json:async function(){return {data:[
      {id:'900001',name:'template_qa_submeter',language:'pt_BR',status:'PENDING',category:'MARKETING',components:preparado.componentes},
      {id:'900002',name:'template_externo',language:'pt_BR',status:'REJECTED',category:'UTILITY',components:[{type:'BODY',text:'Externo'}]}
    ].concat(oficiaisPreexistentes)};}};});
    const sincronizacaoAutomatica=await sincronizacaoAutomaticaTemplates.executarAgora();
    const atualizadoAutomaticamente=(await banco.query("SELECT meta_status_oficial,meta_status FROM modelos_mensagem WHERE meta_template_id='900001'")).rows[0];
    const auditoriaAutomatica=(await banco.query("SELECT usuario_id FROM historico_modelos_mensagem_meta WHERE modelo_id=$1 AND origem='sincronizacao_meta' ORDER BY id DESC LIMIT 1",[rascunho.id])).rows[0];
    confirmar(sincronizacaoAutomatica.executado===true&&sincronizacaoAutomatica.resumo.atualizados===1&&atualizadoAutomaticamente.meta_status_oficial==='PENDING'&&atualizadoAutomaticamente.meta_status==='em_analise'&&auditoriaAutomatica.usuario_id===null,'Reconciliacao automatica nao atualizou o status sem inventar usuario humano.');

    const payload=provider.montarPayload({telefone:'5521999999999',nomeContato:'Maria',templateNome:'template_qa_submeter',templateIdioma:'pt_BR',templateComponentes:preparado.componentes,templateConfiguracaoEnvio:preparado.configuracaoEnvio});
    confirmar(payload.template.components[0].parameters[0].image.link==='https://example.com/imagem.jpg','HEADER IMAGE nao entrou no envio.');
    confirmar(payload.template.components[1].parameters[0].text==='Maria','Parametro do BODY nao foi resolvido.');
    confirmar(payload.template.components[2].parameters[0].payload==='nao_quero_mais_receber','Payload de opt-out foi alterado.');
    const duasVariaveis=templateService.prepararRascunho({nome:'Duas variaveis',categoria:'QA',metaNome:'duas_variaveis_qa',metaIdioma:'pt_BR',metaCategoria:'MARKETING',ativo:true,
      componentes:[{type:'BODY',text:'Ola {{1}}, o bairro {{2}} precisa de atencao.',exemplos:['Maria','Centro']}],
      configuracaoEnvio:{corpo:[{origem:'nome_contato'},{origem:'bairro'}],botoes:[]}});
    const payloadDuas=provider.montarPayload({telefone:'5521999999999',nomeContato:'Maria',bairroContato:'Centro',templateNome:'duas_variaveis_qa',templateIdioma:'pt_BR',templateComponentes:duasVariaveis.componentes,templateConfiguracaoEnvio:duasVariaveis.configuracaoEnvio});
    confirmar(payloadDuas.template.components[0].parameters[0].text==='Maria'&&payloadDuas.template.components[0].parameters[1].text==='Centro','Mapeamento visivel de {{1}} e {{2}} nao chegou ao payload.');
    await rejeitar(Promise.resolve().then(function(){return provider.montarPayload({telefone:'5521999999999',nomeContato:'Maria',bairroContato:null,templateNome:'duas_variaveis_qa',templateIdioma:'pt_BR',templateComponentes:duasVariaveis.componentes,templateConfiguracaoEnvio:duasVariaveis.configuracaoEnvio});}),'nao possui a informacao necessaria para preencher {{2}}');
    const semVariaveis=templateService.prepararRascunho({nome:'Sem variaveis',categoria:'QA',metaNome:'sem_variaveis_qa',metaIdioma:'pt_BR',metaCategoria:'UTILITY',ativo:true,componentes:[{type:'BODY',text:'Mensagem sem valores personalizados.'}],configuracaoEnvio:{corpo:[],botoes:[]}});
    confirmar(semVariaveis.configuracaoEnvio.corpo.length===0,'Template sem variaveis recebeu configuracao indevida.');
    const configuracaoImagemId=templateService.validarConfiguracaoEnvio(preparado.componentes,{cabecalho:{tipo:'imagem',origem:'id',valor:'media-id-falso'},corpo:[{origem:'nome_contato'}],botoes:[{indice:0,subtipo:'quick_reply',origem:'opt_out'}]});
    const payloadImagemId=provider.montarPayload({telefone:'5521999999999',nomeContato:'Maria',templateNome:'imagem_id_qa',templateIdioma:'pt_BR',templateComponentes:preparado.componentes,templateConfiguracaoEnvio:configuracaoImagemId});
    confirmar(payloadImagemId.template.components[0].parameters[0].image.id==='media-id-falso','Media ID nao foi usado no HEADER IMAGE.');

    const cta=templateService.prepararRascunho({nome:'CTA QA',categoria:'QA',metaNome:'cta_qa',metaIdioma:'pt_BR',metaCategoria:'UTILITY',ativo:true,
      componentes:[{type:'BODY',text:'Consulte seu cadastro'},{type:'BUTTONS',buttons:[{type:'URL',text:'Consultar',url:'https://example.com/{{1}}',exemplo:'codigo-teste'}]}],
      configuracaoEnvio:{corpo:[],botoes:[{indice:0,subtipo:'url',origem:'fixo',valor:'codigo'}]}});
    const payloadCta=provider.montarPayload({telefone:'5521999999999',templateNome:'cta_qa',templateIdioma:'pt_BR',templateComponentes:cta.componentes,templateConfiguracaoEnvio:cta.configuracaoEnvio});
    confirmar(payloadCta.template.components[0].sub_type==='url'&&payloadCta.template.components[0].parameters[0].text==='codigo','CTA URL dinamico nao foi montado.');
    await rejeitar(Promise.resolve().then(function(){return provider.montarPayload({telefone:'5521999999999',templateNome:'sem_configuracao',templateIdioma:'pt_BR',templateComponentes:[{type:'BODY',text:'Ola'},{type:'BUTTONS',buttons:[{type:'QUICK_REPLY',text:'Confirmar'}]}],templateConfiguracaoEnvio:{corpo:[],botoes:[]}});}), 'falta configurar os botões');
    await rejeitar(Promise.resolve().then(function(){return provider.montarPayload({telefone:'5521999999999',templateNome:'sem_imagem',templateIdioma:'pt_BR',templateComponentes:[{type:'HEADER',format:'IMAGE'},{type:'BODY',text:'Ola'}],templateConfiguracaoEnvio:{corpo:[]}});}), 'falta configurar a imagem');

    provider.definirFetchParaTeste(async function(){return {ok:false,status:401,json:async function(){return {error:{code:190,message:'segredo nao deve sair'}};}};});
    await rejeitar(provider.criarTemplateOficial({name:'qa',language:'pt_BR',category:'UTILITY',components:[]}), 'credencial');
    provider.definirFetchParaTeste(async function(){return {ok:true,status:200,json:async function(){return {resultado:'invalido'};}};});
    await rejeitar(provider.listarTemplatesOficiais(),'lista de templates invalida');

    provider.definirFetchParaTeste(function(url,opcoes){return new Promise(function(resolve,reject){opcoes.signal.addEventListener('abort',function(){const erro=new Error('abort');erro.name='AbortError';reject(erro);});});});
    await rejeitar(provider.listarTemplatesOficiais(),'tempo esperado');
    console.log('Templates oficiais da Meta: '+verificacoes+' verificacoes aprovadas.');
  }finally{
    provider.definirFetchParaTeste();
    if(ids.length){await banco.query('DELETE FROM historico_modelos_mensagem_meta WHERE modelo_id=ANY($1::bigint[])',[ids]);await banco.query('DELETE FROM modelos_mensagem WHERE id=ANY($1::bigint[])',[ids]);}
    await banco.end();
  }
}

executar().catch(function(erro){console.error(erro.stack||erro.message);process.exitCode=1;});
