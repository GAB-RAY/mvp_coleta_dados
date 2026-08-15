require('dotenv').config({ quiet: true });

process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso-parametros-nomeados';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321';
process.env.META_GRAPH_API_VERSION = 'v99.0';

const banco = require('../src/config/banco');
const analisador = require('../src/modules/mensageria/analisadorRequisitosTemplate');
const provider = require('../src/modules/mensageria/metaCloudApiProvider');
const templateService = require('../src/modules/campanhas/templateMetaService');

const META_TEMPLATE_ID = '1044472861462711';
const META_TEMPLATE_NOME = 'convite_pesquisa_acorda_rj';
let verificacoes = 0;
let chamadasEnvio = 0;
let payloadEnviado;

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
  verificacoes += 1;
}

function respostaJson(corpo) {
  return {
    ok: true,
    status: 200,
    json: async function () { return corpo; }
  };
}

function templateOficialNomeado() {
  return {
    id: META_TEMPLATE_ID,
    name: META_TEMPLATE_NOME,
    language: 'pt_BR',
    status: 'APPROVED',
    category: 'MARKETING',
    parameter_format: 'NAMED',
    components: [
      { type: 'HEADER', format: 'IMAGE' },
      {
        type: 'BODY',
        text: 'Ola {{nome}}, temos um convite para voce.',
        example: {
          body_text_named_params: [{ param_name: 'nome', example: 'Maria' }]
        }
      },
      { type: 'FOOTER', text: 'Acorda RJ' },
      { type: 'BUTTONS', buttons: [
        { type: 'URL', text: 'Participar', url: 'https://example.com/participar' },
        { type: 'QUICK_REPLY', text: 'Nao quero receber' }
      ] }
    ]
  };
}

function comandoDoTemplate(template, nomeContato) {
  return {
    telefone: '5521999999999',
    nomeContato,
    bairroContato: 'Centro',
    problemaContato: 'Saude',
    templateNome: template.meta_nome,
    templateIdioma: template.meta_idioma,
    templateOrigem: template.meta_origem,
    templateStatusOficial: template.meta_status_oficial,
    templateComponentes: template.meta_componentes,
    templateConfiguracaoEnvio: template.meta_configuracao_envio
  };
}

async function buscarTemplate() {
  return (await banco.query(
    'SELECT * FROM modelos_mensagem WHERE meta_template_id=$1',
    [META_TEMPLATE_ID]
  )).rows[0];
}

async function executar() {
  const usuario = (await banco.query(
    "SELECT id FROM usuarios WHERE ativo=TRUE AND perfil='administrador' ORDER BY id LIMIT 1"
  )).rows[0];
  confirmar(Boolean(usuario), 'O teste precisa de um administrador artificial.');

  provider.definirFetchParaTeste(async function (url, opcoes) {
    if (url.includes('/message_templates?')) {
      confirmar(url.includes('parameter_format'),
        'A consulta oficial nao solicitou parameter_format.');
      return respostaJson({ data: [templateOficialNomeado()] });
    }
    if (url.endsWith('/messages')) {
      chamadasEnvio += 1;
      payloadEnviado = JSON.parse(opcoes.body);
      return respostaJson({ messages: [{ id: 'wamid.parametro.nomeado.qa' }] });
    }
    throw new Error('Endpoint Meta fake inesperado: ' + url);
  });

  try {
    const resumo = await templateService.sincronizar(usuario);
    confirmar(resumo.criados === 1, 'O template NAMED nao foi importado.');

    let template = await buscarTemplate();
    confirmar(Boolean(template), 'O template sincronizado nao foi persistido.');
    const corpo = template.meta_componentes.find(function (item) {
      return String(item.type || '').toUpperCase() === 'BODY';
    });
    confirmar(corpo.parameter_format === 'NAMED',
      'O formato NAMED se perdeu entre Meta, service e PostgreSQL.');
    confirmar(corpo.text.includes('{{nome}}'),
      'O marcador oficial nomeado se perdeu na persistencia.');

    const descritores = analisador.obterDescritoresVariaveis(corpo);
    confirmar(descritores.length === 1 && descritores[0].nome === 'nome' &&
      descritores[0].posicao === 1,
    'O analisador nao reconheceu o marcador nomeado persistido.');

    const analisePendente = analisador.analisarRequisitosDeEnvio({
      origem: template.meta_origem,
      statusOficial: template.meta_status_oficial,
      nome: template.meta_nome,
      idioma: template.meta_idioma,
      componentes: template.meta_componentes
    }, template.meta_configuracao_envio, {});
    confirmar(!analisePendente.validoParaEnvio && analisePendente.pendencias.some(function (item) {
      return item.tipo === 'valor_personalizado' && item.nomeParametro === 'nome';
    }), 'O sistema deveria exigir o mapeamento operacional de {{nome}}.');
    confirmar(chamadasEnvio === 0, 'A ausencia do mapeamento chegou ao endpoint de envio.');

    await templateService.configurarEnvio(template.id, {
      configuracaoEnvio: {
        cabecalho: { tipo: 'imagem', origem: 'id', valor: 'media-id-nomeado-qa' },
        corpo: [{ origem: 'nome_contato' }],
        botoes: []
      }
    }, usuario);

    await templateService.sincronizar(usuario);
    template = await buscarTemplate();
    confirmar(template.meta_componentes.find(function (item) {
      return item.type === 'BODY';
    }).parameter_format === 'NAMED', 'A ressincronizacao removeu o formato NAMED.');
    confirmar(template.meta_configuracao_envio.corpo[0].origem === 'nome_contato',
      'A ressincronizacao removeu o mapeamento local configurado.');

    const comando = comandoDoTemplate(template, 'Maria da Silva');
    const analiseValida = analisador.analisarRequisitosDeEnvio({
      origem: comando.templateOrigem,
      statusOficial: comando.templateStatusOficial,
      nome: comando.templateNome,
      idioma: comando.templateIdioma,
      componentes: comando.templateComponentes
    }, comando.templateConfiguracaoEnvio, {});
    confirmar(analiseValida.validoParaEnvio, 'O template configurado permaneceu invalido.');

    await provider.enviarTemplate(comando);
    confirmar(chamadasEnvio === 1, 'O provider fake deveria receber exatamente um envio.');
    const componentesPayload = payloadEnviado.template.components;
    const corpoPayload = componentesPayload.find(function (item) { return item.type === 'body'; });
    confirmar(Boolean(corpoPayload) && corpoPayload.parameters.length === 1,
      'O BODY nomeado nao recebeu exatamente um parametro.');
    confirmar(corpoPayload.parameters[0].parameter_name === 'nome',
      'O payload nao preservou o parameter_name oficial.');
    confirmar(corpoPayload.parameters[0].text === 'Maria da Silva',
      'O parametro nomeado nao recebeu o valor do mapeamento operacional.');
    confirmar(componentesPayload.some(function (item) {
      return item.type === 'header' && item.parameters[0].image.id === 'media-id-nomeado-qa';
    }), 'O HEADER IMAGE foi alterado pela correcao do BODY.');
    confirmar(!componentesPayload.some(function (item) { return item.type === 'button'; }),
      'Os botoes oficiais estaticos receberam parametros inventados.');

    let erroDadoAusente;
    try { provider.montarPayload(comandoDoTemplate(template, null)); }
    catch (erro) { erroDadoAusente = erro; }
    confirmar(erroDadoAusente &&
      erroDadoAusente.codigoIntegracao === 'CONFIGURACAO_ENVIO_INCOMPLETA',
    'Dado ausente deveria bloquear o template nomeado antes da Meta.');
    confirmar(chamadasEnvio === 1, 'O bloqueio local chamou o provider indevidamente.');

    console.log('Parametros nomeados da Meta: ' + verificacoes +
      ' verificacoes aprovadas; Meta fake -> PostgreSQL -> payload NAMED validado.');
  } finally {
    provider.definirFetchParaTeste();
    await banco.query(
      'DELETE FROM modelos_mensagem WHERE meta_template_id=$1',
      [META_TEMPLATE_ID]
    ).catch(function () {});
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
