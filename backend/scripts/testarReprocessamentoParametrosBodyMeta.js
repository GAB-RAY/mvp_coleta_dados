require('dotenv').config({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo-jwt-falso-reprocessamento';
process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso-reprocessamento';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321';
process.env.META_GRAPH_API_VERSION = 'v99.0';
process.env.WHATSAPP_OPTOUT_BUTTON_ID = 'nao_quero_mais_receber';

const crypto = require('crypto');
const http = require('http');
const banco = require('../src/config/banco');
const aplicacao = require('../src/app');
const metaProvider = require('../src/modules/mensageria/metaCloudApiProvider');

let verificacoes = 0;
let chamadasMetaFake = 0;
const registrosEstruturais = [];

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
  verificacoes += 1;
}

async function criarCenario(sufixo, bairroContato) {
  const usuario = (await banco.query(
    "SELECT id FROM usuarios WHERE ativo=TRUE AND perfil='administrador' ORDER BY id LIMIT 1"
  )).rows[0];
  const origem = (await banco.query(
    'SELECT id FROM origens WHERE ativa=TRUE ORDER BY id LIMIT 1'
  )).rows[0];
  const componentes = [
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: 'Ola {{1}}, confirme sua participacao.' },
    { type: 'BUTTONS', buttons: [
      { type: 'QUICK_REPLY', text: 'Confirmar' },
      { type: 'QUICK_REPLY', text: 'SAIR' }
    ] }
  ];
  const origemParametro = bairroContato === null ? 'bairro' : 'nome_contato';
  const template = (await banco.query(`
    INSERT INTO modelos_mensagem (
      nome,categoria,texto,ativo,meta_nome,meta_idioma,meta_categoria,meta_status,
      meta_template_id,meta_status_oficial,meta_origem,meta_componentes,
      meta_configuracao_envio,criado_por_usuario_id,atualizado_por_usuario_id
    ) VALUES ($1,'QA','Mensagem externa QA',TRUE,$2,'pt_BR','MARKETING','aprovado',
      $3,'APPROVED','meta',$4::jsonb,$5::jsonb,$6,$6) RETURNING *
  `, [
    'Template retry QA ' + sufixo,
    'template_retry_qa_' + sufixo,
    '98' + sufixo,
    JSON.stringify(componentes),
    JSON.stringify({
      cabecalho: { tipo: 'imagem', origem: 'id', valor: 'media-id-retry-' + sufixo },
      corpo: [{ origem: origemParametro }],
      botoes: [{ indice: 1, subtipo: 'quick_reply', origem: 'opt_out' }]
    }),
    usuario.id
  ])).rows[0];
  const telefone = '2197' + sufixo.padStart(7, '0').slice(-7);
  const contato = (await banco.query(`
    INSERT INTO contatos (
      nome,telefone,telefone_normalizado,bairro,problema,consentimento_armazenamento,origem_id
    ) VALUES ($1,$2,$2,$3,'Saneamento basico',TRUE,$4) RETURNING id
  `, ['Contato retry QA ' + sufixo, telefone, bairroContato, origem.id])).rows[0];
  const campanha = (await banco.query(`
    INSERT INTO campanhas (
      nome,descricao,finalidade,modelo_id,filtros_snapshot,status,ativo,
      responsavel_usuario_id,criado_por_usuario_id,atualizado_por_usuario_id
    ) VALUES ($1,'QA','QA',$2,'{}','ativa',TRUE,$3,$3,$3) RETURNING id
  `, ['Campanha retry QA ' + sufixo, template.id, usuario.id])).rows[0];
  const lote = (await banco.query(`
    INSERT INTO campanha_lotes (
      campanha_id,tamanho_solicitado,tamanho_efetivo,ordem,chave_idempotencia,criado_por_usuario_id
    ) VALUES ($1,1,1,1,$2,$3) RETURNING id
  `, [campanha.id, crypto.randomUUID(), usuario.id])).rows[0];
  const participacao = (await banco.query(`
    INSERT INTO campanha_participacoes (
      campanha_id,contato_id,lote_original_id,status,reservado_em
    ) VALUES ($1,$2,$3,'falhou',CURRENT_TIMESTAMP) RETURNING id
  `, [campanha.id, contato.id, lote.id])).rows[0];
  const tentativa = (await banco.query(`
    INSERT INTO campanha_tentativas (
      participacao_id,numero_tentativa,status,codigo_erro_externo,
      descricao_erro,permite_nova_tentativa,finalizada_em
    ) VALUES ($1,1,'falhou','132000','Falha Meta sanitizada.',TRUE,CURRENT_TIMESTAMP)
    RETURNING id
  `, [participacao.id])).rows[0];
  return { template, tentativa };
}

function iniciarApi() {
  const servidor = http.createServer(aplicacao);
  return new Promise(function (resolver, rejeitar) {
    servidor.once('error', rejeitar);
    servidor.listen(0, '127.0.0.1', function () { resolver(servidor); });
  });
}

function requisitarApi(servidor, caminho, opcoes) {
  return fetch('http://127.0.0.1:' + servidor.address().port + caminho, opcoes);
}

async function autenticar(servidor) {
  const resposta = await requisitarApi(servidor, '/api/autenticacao/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'qa.campanhas@invalid.local', senha: 'SenhaQACampanhas123!' })
  });
  const corpo = await resposta.json();
  confirmar(resposta.status === 200 && Boolean(corpo.token), 'O login HTTP do teste falhou.');
  return corpo.token;
}

async function postar(servidor, caminho, token) {
  const resposta = await requisitarApi(servidor, caminho, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token }
  });
  return { status: resposta.status, corpo: await resposta.json() };
}

async function executar() {
  if (!String(process.env.DATABASE_URL || '').includes('acorda_rj_campanhas_qa_')) {
    throw new Error('O teste exige o PostgreSQL temporario isolado de campanhas.');
  }
  const servidor = await iniciarApi();
  metaProvider.definirRegistradorEstruturaParaTeste(function (registro) {
    registrosEstruturais.push(registro);
  });
  metaProvider.definirFetchParaTeste(async function (url, opcoes) {
    chamadasMetaFake += 1;
    confirmar(registrosEstruturais.length === chamadasMetaFake,
      'O log estrutural precisa existir antes do fetch fake.');
    const payload = JSON.parse(opcoes.body);
    const corpo = payload.template.components.find(function (item) { return item.type === 'body'; });
    confirmar(Boolean(corpo) && corpo.parameters.length === 1,
      'O caminho HTTP real nao entregou exatamente um parametro no BODY ao fetch fake.');
    return {
      ok: true,
      status: 200,
      json: async function () { return { messages: [{ id: 'wamid.retry.' + chamadasMetaFake }] }; }
    };
  });

  try {
    const token = await autenticar(servidor);
    const cenario = await criarCenario('9300001', 'Copacabana');
    const reprocessamento = await postar(
      servidor, '/api/admin/mensageria/tentativas/' + cenario.tentativa.id + '/reprocessar', token
    );
    confirmar(reprocessamento.status === 201 && reprocessamento.corpo.tentativa.status === 'pendente',
      'A rota real nao criou a nova tentativa pendente.');
    const novaTentativaId = reprocessamento.corpo.tentativa.id;
    const envio = await postar(
      servidor, '/api/admin/mensageria/tentativas/' + novaTentativaId + '/enviar', token
    );
    confirmar(envio.status === 200 && envio.corpo.tentativa.status === 'enviada',
      'A rota real de envio nao concluiu a tentativa reprocessada.');

    const registro = registrosEstruturais[0];
    confirmar(registro.componentesOficiais.length === 3 &&
      registro.componentesOficiais[0].tipo === 'HEADER' &&
      registro.componentesOficiais[1].tipo === 'BODY' &&
      registro.componentesOficiais[1].quantidadeVariaveis === 1 &&
      registro.componentesOficiais[2].quantidadeBotoes === 2,
    'O log nao refletiu os componentes oficiais carregados pela query real.');
    confirmar(JSON.stringify(registro.body) === JSON.stringify({
      variaveisEsperadas: [1], variaveisConfiguradas: [1], variaveisResolvidas: [1]
    }), 'O log nao comprovou a sequencia esperada/configurada/resolvida 1/1/1.');
    const corpoEstrutural = registro.componentesPayload.find(function (item) { return item.tipo === 'body'; });
    confirmar(corpoEstrutural && corpoEstrutural.quantidadeParametros === 1,
      'O log estrutural nao comprovou body.parameters.length igual a 1.');
    const logSerializado = JSON.stringify(registro);
    confirmar(!logSerializado.includes('Contato retry') &&
      !logSerializado.includes('2197') &&
      !logSerializado.includes('media-id') &&
      !logSerializado.includes('token-falso') &&
      !logSerializado.includes('https://'),
    'O log estrutural expôs dado pessoal, mídia ou credencial.');

    const semDado = await criarCenario('9300002', null);
    const retrySemDado = await postar(
      servidor, '/api/admin/mensageria/tentativas/' + semDado.tentativa.id + '/reprocessar', token
    );
    confirmar(retrySemDado.status === 201, 'O reprocessamento do cenário sem dado falhou antes da validação.');
    const chamadasAntes = chamadasMetaFake;
    const envioSemDado = await postar(
      servidor, '/api/admin/mensageria/tentativas/' + retrySemDado.corpo.tentativa.id + '/enviar', token
    );
    confirmar(envioSemDado.status === 409 && chamadasMetaFake === chamadasAntes,
      'Dado ausente nao foi bloqueado antes do fetch fake.');
    const falha = (await banco.query(
      'SELECT codigo_erro_externo FROM campanha_tentativas WHERE id=$1',
      [retrySemDado.corpo.tentativa.id]
    )).rows[0];
    confirmar(falha.codigo_erro_externo === 'CONFIGURACAO_ENVIO_INCOMPLETA',
      'A tentativa sem dado nao persistiu CONFIGURACAO_ENVIO_INCOMPLETA.');

    console.log('Retry HTTP Meta BODY: ' + verificacoes +
      ' verificacoes aprovadas; esperado/configurado/resolvido/enviado = 1/1/1/1.');
  } finally {
    metaProvider.definirFetchParaTeste();
    metaProvider.definirRegistradorEstruturaParaTeste();
    await new Promise(function (resolver) { servidor.close(resolver); });
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
