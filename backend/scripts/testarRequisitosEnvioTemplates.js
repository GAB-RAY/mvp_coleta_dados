require('dotenv').config({ quiet: true });

process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso-requisitos';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321';
process.env.META_GRAPH_API_VERSION = 'v99.0';
process.env.WHATSAPP_OPTOUT_BUTTON_ID = 'nao_quero_mais_receber';

const analisador = require('../src/modules/mensageria/analisadorRequisitosTemplate');
const provider = require('../src/modules/mensageria/metaCloudApiProvider');

let verificacoes = 0;
let chamadasProvider = 0;
let ultimoPayload;

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
  verificacoes += 1;
}

function comandoExterno(componentes, configuracao) {
  return {
    telefone: '5521999999999',
    nomeContato: 'Maria',
    bairroContato: 'Centro',
    problemaContato: 'Saúde',
    templateNome: 'template_externo_aprovado_qa',
    templateIdioma: 'pt_BR',
    templateOrigem: 'meta',
    templateStatusOficial: 'APPROVED',
    templateComponentes: componentes,
    templateConfiguracaoEnvio: configuracao || {}
  };
}

function analisar(comando) {
  return analisador.analisarRequisitosDeEnvio({
    origem: comando.templateOrigem,
    statusOficial: comando.templateStatusOficial,
    nome: comando.templateNome,
    idioma: comando.templateIdioma,
    componentes: comando.templateComponentes
  }, comando.templateConfiguracaoEnvio, {
    identificadorOptOut: process.env.WHATSAPP_OPTOUT_BUTTON_ID
  });
}

async function enviar(comando) {
  ultimoPayload = null;
  return provider.enviarTemplate(comando);
}

async function executar() {
  provider.definirFetchParaTeste(async function (url, opcoes) {
    chamadasProvider += 1;
    confirmar(url.endsWith('/123456789/messages'), 'O envio fake usou endpoint inesperado.');
    ultimoPayload = JSON.parse(opcoes.body);
    return {
      ok: true,
      status: 200,
      json: async function () { return { messages: [{ id: 'wamid.requisitos.' + chamadasProvider }] }; }
    };
  });

  try {
    const somenteTexto = comandoExterno([{ type: 'BODY', text: 'Mensagem sem variável.' }], {});
    await enviar(somenteTexto);
    confirmar(chamadasProvider === 1 && !ultimoPayload.template.components,
      'A) Externo APPROVED somente texto não chegou limpo ao provider fake.');

    const componentesImagem = [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Mensagem com imagem.' }
    ];
    const semImagem = analisar(comandoExterno(componentesImagem, {}));
    confirmar(!semImagem.validoParaEnvio && semImagem.pendencias.length === 1 &&
      semImagem.pendencias[0].tipo === 'imagem_cabecalho',
    'B) HEADER IMAGE sem mídia deveria ter somente a pendência de imagem.');

    await enviar(comandoExterno(componentesImagem, {
      cabecalho: { tipo: 'imagem', origem: 'link', valor: 'https://example.com/imagem.jpg' }
    }));
    confirmar(ultimoPayload.template.components[0].parameters[0].image.link ===
      'https://example.com/imagem.jpg', 'C) image.link não chegou ao provider fake.');

    await enviar(comandoExterno(componentesImagem, {
      cabecalho: { tipo: 'imagem', origem: 'id', valor: 'media-id-qa' }
    }));
    confirmar(ultimoPayload.template.components[0].parameters[0].image.id === 'media-id-qa',
      'D) image.id não chegou ao provider fake.');

    const componentesVariavel = [{ type: 'BODY', text: 'Olá {{1}}.' }];
    const semVariavel = analisar(comandoExterno(componentesVariavel, {}));
    confirmar(!semVariavel.validoParaEnvio && semVariavel.pendencias.length === 1 &&
      semVariavel.pendencias[0].mensagem === 'Configure o valor {{1}}.',
    'E) A ausência de {{1}} deveria produzir somente sua pendência específica.');

    await enviar(comandoExterno(componentesVariavel, { corpo: [{ origem: 'nome_contato' }] }));
    confirmar(ultimoPayload.template.components[0].parameters[0].text === 'Maria',
      'F) {{1}} configurado não foi resolvido no provider fake.');

    const botaoEstatico = [
      { type: 'BODY', text: 'Consulte.' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Abrir', url: 'https://example.com' }] }
    ];
    await enviar(comandoExterno(botaoEstatico, {}));
    confirmar(!ultimoPayload.template.components,
      'G) Botão estático criou parâmetro artificial no payload.');

    const quickReplyComum = [
      { type: 'BODY', text: 'Confirme.' },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Confirmar presença' }] }
    ];
    await enviar(comandoExterno(quickReplyComum, {}));
    confirmar(!ultimoPayload.template.components,
      'H) QUICK_REPLY comum foi tratado automaticamente como opt-out.');

    const botaoSair = [
      { type: 'BODY', text: 'Mensagem com descadastro.' },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'SAIR' }] }
    ];
    await enviar(comandoExterno(botaoSair, {
      botoes: [{ indice: 0, subtipo: 'quick_reply', origem: 'opt_out' }]
    }));
    confirmar(ultimoPayload.template.components[0].parameters[0].payload ===
      'nao_quero_mais_receber', 'I) O botão SAIR configurado perdeu o payload de opt-out.');

    const internoIncompleto = comandoExterno(quickReplyComum, {});
    internoIncompleto.templateOrigem = 'interno';
    const analiseInterno = analisar(internoIncompleto);
    confirmar(!analiseInterno.validoParaEnvio &&
      analiseInterno.pendencias.some(function (item) { return item.tipo === 'botao_opt_out'; }),
    'J) O template interno incompleto deixou de ser bloqueado.');

    const naoAprovado = comandoExterno([{ type: 'BODY', text: 'Em análise.' }], {});
    naoAprovado.templateStatusOficial = 'PENDING';
    const analiseNaoAprovado = analisar(naoAprovado);
    confirmar(!analiseNaoAprovado.validoParaEnvio &&
      analiseNaoAprovado.pendencias.some(function (item) { return item.tipo === 'status_oficial'; }),
    'K) O template não aprovado deixou de ser bloqueado.');

    const equivalenteReal = [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Olá {{1}}, confirme sua participação.' },
      { type: 'BUTTONS', buttons: [
        { type: 'QUICK_REPLY', text: 'Confirmar' },
        { type: 'QUICK_REPLY', text: 'SAIR' }
      ] }
    ];
    const comandoReal = comandoExterno(equivalenteReal, {
      cabecalho: { tipo: 'imagem', origem: 'id', valor: 'media-id-real-equivalente' },
      corpo: [{ origem: 'nome_contato' }],
      botoes: [{ indice: 1, subtipo: 'quick_reply', origem: 'opt_out' }]
    });
    const analiseReal = analisar(comandoReal);
    confirmar(analiseReal.validoParaEnvio && analiseReal.pendencias.length === 0,
      'O template equivalente ao real manteve bloqueios internos indevidos.');
    await enviar(comandoReal);
    confirmar(ultimoPayload.template.components[0].parameters[0].image.id ===
      'media-id-real-equivalente' &&
      ultimoPayload.template.components[1].parameters[0].text === 'Maria' &&
      ultimoPayload.template.components[2].index === '1' &&
      ultimoPayload.template.components[2].parameters[0].payload === 'nao_quero_mais_receber',
    'O payload equivalente ao real não preservou imagem, variável e SAIR.');
    confirmar(ultimoPayload.template.components.filter(function (item) {
      return item.type === 'button';
    }).length === 1, 'O QUICK_REPLY comum recebeu configuração de opt-out inventada.');

    console.log('Requisitos centralizados de templates: ' + verificacoes +
      ' verificações aprovadas; matriz A-K e template equivalente validados.');
  } finally {
    provider.definirFetchParaTeste();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
