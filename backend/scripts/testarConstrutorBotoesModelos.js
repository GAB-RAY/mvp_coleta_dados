process.env.WHATSAPP_OPTOUT_BUTTON_ID = 'nao_quero_mais_receber';

const banco = require('../src/config/banco');
const templateService = require('../src/modules/campanhas/templateMetaService');
const provider = require('../src/modules/mensageria/metaCloudApiProvider');

let verificacoes = 0;
function confirmar(condicao, mensagem) { if (!condicao) throw new Error(mensagem); verificacoes += 1; }
function rejeitar(funcao, trecho) {
  try { funcao(); } catch (erro) {
    confirmar(erro.message.toLowerCase().includes(trecho.toLowerCase()), 'Erro inesperado: ' + erro.message);
    return;
  }
  throw new Error('A configuracao deveria ser rejeitada.');
}
function dados(componentes, botoes) {
  return {
    nome: 'Construtor QA', categoria: 'Geral', metaNome: 'construtor_qa',
    metaIdioma: 'pt_BR', metaCategoria: 'MARKETING', ativo: true,
    componentes: [{ type: 'BODY', text: 'Ola' }].concat(componentes || []),
    configuracaoEnvio: { corpo: [], botoes: botoes || [] }
  };
}

async function executar() {
  const semBotao = templateService.prepararRascunho(dados([], []));
  confirmar(!semBotao.componentes.some(function(item){return item.type === 'BUTTONS';}), 'Modelo sem botao recebeu componente indevido.');
  const url = templateService.prepararRascunho(dados([{ type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Participar', url: 'https://example.com' }] }], []));
  confirmar(url.componentes[1].buttons.length === 1 && url.componentes[1].buttons[0].type === 'URL', 'Botao de link nao foi preservado.');
  const misto = templateService.prepararRascunho(dados([{ type: 'BUTTONS', buttons: [
    { type: 'URL', text: 'Quero participar', url: 'https://example.com' },
    { type: 'QUICK_REPLY', text: 'SAIR' }
  ] }], [{ indice: 1, subtipo: 'quick_reply', origem: 'opt_out' }]));
  confirmar(misto.componentes[1].buttons.map(function(item){return item.type;}).join(',') === 'URL,QUICK_REPLY', 'A ordem URL + SAIR mudou.');
  const payload = provider.montarPayload({ telefone: '5521999999999', templateNome: 'construtor_qa', templateIdioma: 'pt_BR', templateOrigem: 'interno', templateStatusOficial: 'APPROVED', templateComponentes: misto.componentes, templateConfiguracaoEnvio: misto.configuracaoEnvio });
  confirmar(payload.template.components.length === 1 && payload.template.components[0].index === '1', 'O SAIR nao usou a posicao real.');
  confirmar(payload.template.components[0].parameters[0].payload === 'nao_quero_mais_receber', 'O identificador configurado do SAIR nao foi usado.');
  const telefoneEUrl = templateService.prepararRascunho(dados([{ type: 'BUTTONS', buttons: [
    { type: 'PHONE_NUMBER', text: 'Ligar', phone_number: '+5521999999999' },
    { type: 'URL', text: 'Abrir', url: 'https://example.com' }
  ] }], []));
  confirmar(telefoneEUrl.componentes[1].buttons.length === 2, 'Dois botoes de acao oficialmente suportados foram rejeitados.');
  rejeitar(function(){templateService.prepararRascunho(dados([{ type: 'BUTTONS', buttons: [
    { type: 'URL', text: 'A', url: 'https://a.example' }, { type: 'URL', text: 'B', url: 'https://b.example' },
    { type: 'URL', text: 'C', url: 'https://c.example' }, { type: 'QUICK_REPLY', text: 'SAIR' }
  ] }], []));}, 'um a tres botoes');
  rejeitar(function(){templateService.prepararRascunho(dados([{ type: 'BUTTONS', buttons: [
    { type: 'QUICK_REPLY', text: 'SAIR' }, { type: 'QUICK_REPLY', text: 'PARAR' }
  ] }], [{ indice: 0, subtipo: 'quick_reply', origem: 'opt_out' }, { indice: 1, subtipo: 'quick_reply', origem: 'opt_out' }]));}, 'somente um botao');
  rejeitar(function(){templateService.prepararRascunho(dados([{ type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Abrir', url: 'http://example.com' }] }], []));}, 'https');
  rejeitar(function(){templateService.prepararRascunho(dados([{ type: 'BUTTONS', buttons: [{ type: 'FLOW', text: 'Abrir fluxo' }] }], []));}, 'acoes de botao');
  console.log('Construtor de botoes: ' + verificacoes + ' verificacoes aprovadas.');
}

executar().finally(function(){return banco.end();}).catch(function(erro){console.error(erro.stack || erro.message);process.exitCode=1;});
