require('dotenv').config({ quiet: true });

process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso-template-externo';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321';
process.env.META_GRAPH_API_VERSION = 'v99.0';

const crypto = require('crypto');
const banco = require('../src/config/banco');
const mensageriaService = require('../src/modules/mensageria/mensageriaService');
const templateService = require('../src/modules/campanhas/templateMetaService');

let verificacoes = 0;

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
  verificacoes += 1;
}

async function criarCenario(dados) {
  const usuario = (await banco.query(
    "SELECT id FROM usuarios WHERE ativo=TRUE AND perfil='administrador' ORDER BY id LIMIT 1"
  )).rows[0];
  const origem = (await banco.query(
    'SELECT id FROM origens WHERE ativa=TRUE ORDER BY id LIMIT 1'
  )).rows[0];
  const sufixo = dados.sufixo;
  let template = dados.template;
  if (!template) template = (await banco.query(`
    INSERT INTO modelos_mensagem (
      nome,categoria,texto,ativo,meta_nome,meta_idioma,meta_categoria,meta_status,
      meta_template_id,meta_status_oficial,meta_origem,meta_componentes,
      meta_configuracao_envio,criado_por_usuario_id,atualizado_por_usuario_id
    ) VALUES ($1,'QA','Mensagem externa QA',TRUE,$2,'pt_BR','MARKETING','aprovado',
      $3,'APPROVED',$4,$5::jsonb,$6::jsonb,$7,$7) RETURNING *
  `, [
    'Template externo QA ' + sufixo, 'template_externo_qa_' + sufixo,
    '99' + sufixo, dados.metaOrigem, JSON.stringify(dados.componentes),
    JSON.stringify(dados.configuracaoEnvio || {}), usuario.id
  ])).rows[0];
  const telefone = '2198' + sufixo.padStart(7, '0').slice(-7);
  const contato = (await banco.query(`
    INSERT INTO contatos (
      nome,telefone,telefone_normalizado,bairro,problema,consentimento_armazenamento,origem_id
    ) VALUES ($1,$2,$2,'Copacabana','Saneamento basico',TRUE,$3) RETURNING id
  `, ['Contato template externo ' + sufixo, telefone, origem.id])).rows[0];
  const campanha = (await banco.query(`
    INSERT INTO campanhas (
      nome,descricao,finalidade,modelo_id,filtros_snapshot,status,ativo,
      responsavel_usuario_id,criado_por_usuario_id,atualizado_por_usuario_id
    ) VALUES ($1,'QA','QA',$2,'{}','ativa',TRUE,$3,$3,$3) RETURNING id
  `, ['Campanha template externo ' + sufixo, template.id, usuario.id])).rows[0];
  const lote = (await banco.query(`
    INSERT INTO campanha_lotes (
      campanha_id,tamanho_solicitado,tamanho_efetivo,ordem,chave_idempotencia,criado_por_usuario_id
    ) VALUES ($1,1,1,1,$2,$3) RETURNING id
  `, [campanha.id, crypto.randomUUID(), usuario.id])).rows[0];
  const participacao = (await banco.query(`
    INSERT INTO campanha_participacoes (
      campanha_id,contato_id,lote_original_id,status,reservado_em
    ) VALUES ($1,$2,$3,'pendente',CURRENT_TIMESTAMP) RETURNING id
  `, [campanha.id, contato.id, lote.id])).rows[0];
  const tentativa = (await banco.query(`
    INSERT INTO campanha_tentativas (participacao_id,numero_tentativa,status)
    VALUES ($1,1,'pendente') RETURNING id
  `, [participacao.id])).rows[0];
  return { usuario, template, contato, campanha, lote, participacao, tentativa };
}

async function esperarFalha(promessa, trecho) {
  try { await promessa; }
  catch (erro) {
    confirmar(erro.message.toLowerCase().includes(trecho.toLowerCase()),
      'Erro inesperado: ' + erro.message);
    return erro;
  }
  throw new Error('O envio deveria ter sido bloqueado.');
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
}

async function executar() {
  const cenarios = [];
  let chamadasProvider = 0;
  let payloadImagem;
  try {
    const usuario = (await banco.query(
      "SELECT id FROM usuarios WHERE ativo=TRUE AND perfil='administrador' ORDER BY id LIMIT 1"
    )).rows[0];
    const componentesTexto = [{ type: 'BODY', text: 'Mensagem externa aprovada.' }];
    const componentesImagem = [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Mensagem externa com imagem.' }
    ];
    mensageriaService.definirProviderParaTeste(async function (url) {
      confirmar(url.includes('/message_templates'),
        'A sincronizacao nao consultou os modelos oficiais.');
      return { ok: true, status: 200, json: async function () { return { data: [
        { id: '999200001', name: 'template_externo_texto_qa', language: 'pt_BR',
          status: 'APPROVED', category: 'MARKETING', components: componentesTexto },
        { id: '999200002', name: 'template_externo_imagem_qa', language: 'pt_BR',
          status: 'APPROVED', category: 'MARKETING', components: componentesImagem }
      ] }; } };
    });
    const resumoSincronizacao = await templateService.sincronizar(usuario);
    confirmar(resumoSincronizacao.criados === 2,
      'Os dois modelos externos nao foram importados pelo sincronizador.');
    const sincronizados = (await banco.query(`
      SELECT * FROM modelos_mensagem WHERE meta_template_id=ANY($1::varchar[])
      ORDER BY meta_template_id
    `, [['999200001', '999200002']])).rows;
    confirmar(sincronizados.length === 2 && sincronizados.every(function (item) {
      return item.meta_origem === 'meta' && item.meta_status === 'aprovado' &&
        item.meta_status_oficial === 'APPROVED' && item.meta_submetido_em === null;
    }), 'A sincronizacao nao preservou origem externa e aprovacao oficial.');
    confirmar(sincronizados.every(function (item) {
      return Object.keys(item.meta_configuracao_envio || {}).length === 0;
    }), 'O sincronizador inventou uma configuracao de envio para o modelo externo.');

    const textoExterno = await criarCenario({
      sufixo: '9200001', template: sincronizados[0]
    });
    cenarios.push(textoExterno);
    mensageriaService.definirProviderParaTeste(async function (url, opcoes) {
      chamadasProvider += 1;
      const payload = JSON.parse(opcoes.body);
      confirmar(payload.template.name === textoExterno.template.meta_nome,
        'Template externo de texto nao chegou ao provider fake.');
      confirmar(!payload.template.components,
        'Template de texto sem parametros recebeu componentes inventados.');
      return { ok: true, status: 200, json: async function () {
        return { messages: [{ id: 'wamid.externo.texto' }] };
      } };
    });
    await mensageriaService.enviar(textoExterno.tentativa.id);
    confirmar(chamadasProvider === 1, 'Template externo APPROVED deveria chamar o provider uma vez.');

    const imagemExterna = await criarCenario({
      sufixo: '9200002', template: sincronizados[1]
    });
    cenarios.push(imagemExterna);
    const chamadasAntesImagem = chamadasProvider;
    mensageriaService.definirProviderParaTeste(async function () {
      chamadasProvider += 1;
      throw new Error('O provider nao deveria ser chamado sem midia.');
    });
    await esperarFalha(
      mensageriaService.enviar(imagemExterna.tentativa.id),
      'falta configurar a imagem'
    );
    confirmar(chamadasProvider === chamadasAntesImagem,
      'A ausencia de midia deveria ser bloqueada antes do provider.');
    const falhaImagem = (await banco.query(`
      SELECT status,codigo_erro_externo,titulo_erro,descricao_erro,categoria_erro,
        permite_nova_tentativa
      FROM campanha_tentativas WHERE id=$1
    `, [imagemExterna.tentativa.id])).rows[0];
    confirmar(falhaImagem.status === 'falhou' &&
      falhaImagem.codigo_erro_externo === 'MIDIA_TEMPLATE_NAO_CONFIGURADA',
    'A falta de midia recebeu um codigo incorreto.');
    confirmar(falhaImagem.titulo_erro === 'Configuração necessária para o envio' &&
      !falhaImagem.titulo_erro.includes('Meta'),
    'O erro local foi apresentado como falha da Meta.');
    confirmar(falhaImagem.categoria_erro === 'configuracao_template' &&
      falhaImagem.permite_nova_tentativa === true,
    'A falha local nao foi classificada como configuracao reprocessavel.');
    const externoPersistido = (await banco.query(`
      SELECT meta_status,meta_status_oficial,meta_origem,meta_submetido_em
      FROM modelos_mensagem WHERE id=$1
    `, [imagemExterna.template.id])).rows[0];
    confirmar(externoPersistido.meta_status === 'aprovado' &&
      externoPersistido.meta_status_oficial === 'APPROVED' &&
      externoPersistido.meta_origem === 'meta' && externoPersistido.meta_submetido_em === null,
    'O template externo perdeu sua aprovacao ou passou a depender de submissao interna.');

    const imagemInterna = await criarCenario({
      sufixo: '9200003', metaOrigem: 'interno', componentes: componentesImagem
    });
    cenarios.push(imagemInterna);
    const chamadasAntesInterno = chamadasProvider;
    await esperarFalha(
      mensageriaService.enviar(imagemInterna.tentativa.id),
      'falta configurar a imagem'
    );
    confirmar(chamadasProvider === chamadasAntesInterno,
      'Template interno incompleto chegou ao provider.');
    const falhaInterna = (await banco.query(
      'SELECT codigo_erro_externo FROM campanha_tentativas WHERE id=$1',
      [imagemInterna.tentativa.id]
    )).rows[0];
    confirmar(falhaInterna.codigo_erro_externo === 'MIDIA_TEMPLATE_NAO_CONFIGURADA',
      'A validacao operacional do template interno foi removida.');

    const configurado = await templateService.configurarEnvio(
      imagemExterna.template.id,
      { configuracaoEnvio: {
        cabecalho: { tipo: 'imagem', origem: 'link', valor: 'https://example.com/imagem-oficial.jpg' },
        corpo: [], botoes: []
      } },
      imagemExterna.usuario
    );
    confirmar(configurado.meta_status_oficial === 'APPROVED' && configurado.meta_origem === 'meta',
      'Configurar a midia alterou a origem ou aprovacao oficial.');
    const novaTentativa = await mensageriaService.reprocessar(imagemExterna.tentativa.id);
    mensageriaService.definirProviderParaTeste(async function (url, opcoes) {
      chamadasProvider += 1;
      payloadImagem = JSON.parse(opcoes.body);
      return { ok: true, status: 200, json: async function () {
        return { messages: [{ id: 'wamid.externo.imagem' }] };
      } };
    });
    await mensageriaService.enviar(novaTentativa.id);
    confirmar(payloadImagem.template.components[0].type === 'header' &&
      payloadImagem.template.components[0].parameters[0].image.link ===
        'https://example.com/imagem-oficial.jpg',
    'O HEADER IMAGE externo nao chegou corretamente ao provider fake.');
    const estadoTentativas = (await banco.query(`
      SELECT numero_tentativa,status,codigo_erro_externo
      FROM campanha_tentativas WHERE participacao_id=$1 ORDER BY numero_tentativa
    `, [imagemExterna.participacao.id])).rows;
    confirmar(estadoTentativas.length === 2 && estadoTentativas[0].status === 'falhou' &&
      estadoTentativas[0].codigo_erro_externo === 'MIDIA_TEMPLATE_NAO_CONFIGURADA' &&
      estadoTentativas[1].status === 'enviada',
    'O reprocessamento nao preservou a tentativa antiga e a nova tentativa valida.');
    const duplicidades = (await banco.query(`
      SELECT
        (SELECT COUNT(*)::integer FROM campanha_participacoes WHERE campanha_id=$1) AS participacoes,
        (SELECT COUNT(*)::integer FROM campanha_lotes WHERE campanha_id=$1) AS lotes
    `, [imagemExterna.campanha.id])).rows[0];
    confirmar(duplicidades.participacoes === 1 && duplicidades.lotes === 1,
      'O reprocessamento duplicou participante ou lote.');

    await templateService.configurarEnvio(
      imagemExterna.template.id,
      { configuracaoEnvio: {
        cabecalho: { tipo: 'imagem', origem: 'id', valor: 'media-id-externo-qa' },
        corpo: [], botoes: []
      } },
      imagemExterna.usuario
    );
    const imagemComId = await criarCenario({
      sufixo: '9200004', template: imagemExterna.template
    });
    cenarios.push(imagemComId);
    let payloadImagemId;
    mensageriaService.definirProviderParaTeste(async function (url, opcoes) {
      chamadasProvider += 1;
      payloadImagemId = JSON.parse(opcoes.body);
      return { ok: true, status: 200, json: async function () {
        return { messages: [{ id: 'wamid.externo.imagem.id' }] };
      } };
    });
    await mensageriaService.enviar(imagemComId.tentativa.id);
    confirmar(payloadImagemId.template.components[0].parameters[0].image.id ===
      'media-id-externo-qa',
    'A campanha nao reutilizou o image.id persistido no provider fake.');

    console.log('Templates externos da Meta: ' + verificacoes + ' verificacoes aprovadas.');
  } finally {
    mensageriaService.definirProviderParaTeste();
    await limpar(cenarios);
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
