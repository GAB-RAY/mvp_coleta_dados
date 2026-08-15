require('dotenv').config({ quiet: true });

process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso-regressao-body';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321';
process.env.META_GRAPH_API_VERSION = 'v99.0';
process.env.WHATSAPP_OPTOUT_BUTTON_ID = 'nao_quero_mais_receber';

const provider = require('../src/modules/mensageria/metaCloudApiProvider');

let verificacoes = 0;
let chamadasMetaFake = 0;
let payloadFinal;

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
  verificacoes += 1;
}

function criarComando(componentes, configuracao, dadosContato) {
  return Object.assign({
    telefone: '5521999999999',
    nomeContato: 'Maria da Silva',
    bairroContato: 'Centro',
    problemaContato: 'Saneamento basico',
    templateNome: 'template_externo_body_qa',
    templateIdioma: 'pt_BR',
    templateOrigem: 'meta',
    templateStatusOficial: 'APPROVED',
    templateComponentes: componentes,
    templateConfiguracaoEnvio: configuracao
  }, dadosContato || {});
}

function buscarCorpo(payload) {
  const componentes = payload && payload.template && Array.isArray(payload.template.components)
    ? payload.template.components : [];
  return componentes.find(function (item) { return item.type === 'body'; });
}

async function enviar(comando) {
  payloadFinal = null;
  await provider.enviarTemplate(comando);
  return payloadFinal;
}

async function executar() {
  provider.definirFetchParaTeste(async function (url, opcoes) {
    chamadasMetaFake += 1;
    confirmar(url.endsWith('/123456789/messages'), 'O endpoint fake de envio foi alterado.');
    payloadFinal = JSON.parse(opcoes.body);
    return {
      ok: true,
      status: 200,
      json: async function () {
        return { messages: [{ id: 'wamid.body.' + chamadasMetaFake }] };
      }
    };
  });

  try {
    const componentesEquivalentes = [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'body', text: 'Ola {{1}}, confirme sua participacao.' },
      { type: 'BUTTONS', buttons: [
        { type: 'QUICK_REPLY', text: 'Confirmar' },
        { type: 'QUICK_REPLY', text: 'SAIR' }
      ] }
    ];
    const payloadUm = await enviar(criarComando(componentesEquivalentes, {
      cabecalho: { tipo: 'imagem', origem: 'id', valor: 'media-id-body-qa' },
      corpo: [{ origem: 'nome_contato' }],
      botoes: [{ indice: 1, subtipo: 'quick_reply', origem: 'opt_out' }]
    }));
    const corpoUm = buscarCorpo(payloadUm);
    confirmar(Boolean(corpoUm), 'O componente BODY sincronizado em minusculas desapareceu do payload.');
    confirmar(corpoUm.parameters.length === 1, 'O BODY com {{1}} nao enviou exatamente um parametro.');
    confirmar(corpoUm.parameters[0].text === 'Maria da Silva', 'O BODY nao usou o nome real configurado para {{1}}.');
    confirmar(payloadUm.template.components.some(function (item) {
      return item.type === 'header' && item.parameters[0].image.id === 'media-id-body-qa';
    }), 'O HEADER IMAGE foi alterado pela correcao do BODY.');
    confirmar(payloadUm.template.components.some(function (item) {
      return item.type === 'button' && item.index === '1' &&
        item.parameters[0].payload === 'nao_quero_mais_receber';
    }), 'O botao SAIR foi alterado pela correcao do BODY.');

    const payloadDois = await enviar(criarComando([
      { type: 'body', text: 'Ola {{1}}, temos uma atualizacao para o bairro {{2}}.' }
    ], {
      corpo: [{ origem: 'nome_contato' }, { origem: 'bairro' }]
    }));
    const corpoDois = buscarCorpo(payloadDois);
    confirmar(corpoDois.parameters.length === 2, 'O BODY com {{1}} e {{2}} nao enviou exatamente dois parametros.');
    confirmar(corpoDois.parameters[0].text === 'Maria da Silva' &&
      corpoDois.parameters[1].text === 'Centro', 'A ordem dos parametros {{1}} e {{2}} foi alterada.');

    const payloadZero = await enviar(criarComando([
      { type: 'body', text: 'Mensagem sem valor personalizado.' }
    ], { corpo: [] }));
    confirmar(!buscarCorpo(payloadZero), 'Um BODY sem variaveis recebeu parametros artificiais.');

    const chamadasAntesDoBloqueio = chamadasMetaFake;
    let erroAusencia;
    try {
      await enviar(criarComando([
        { type: 'body', text: 'Informacao para o bairro {{1}}.' }
      ], {
        corpo: [{ origem: 'bairro' }]
      }, { bairroContato: null }));
    } catch (erro) {
      erroAusencia = erro;
    }
    confirmar(erroAusencia && erroAusencia.codigoIntegracao === 'CONFIGURACAO_ENVIO_INCOMPLETA',
      'Dado ausente nao foi classificado como CONFIGURACAO_ENVIO_INCOMPLETA.');
    confirmar(chamadasMetaFake === chamadasAntesDoBloqueio,
      'O provider fake foi chamado mesmo com dado obrigatorio ausente.');

    console.log('Regressao Meta 132000: ' + verificacoes +
      ' verificacoes aprovadas; BODY esperado/enviado = 1/1, 2/2 e 0/0.');
  } finally {
    provider.definirFetchParaTeste();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
