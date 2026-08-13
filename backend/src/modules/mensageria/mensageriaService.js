const criarAppError = require('../../utils/AppError');
const model = require('./mensageriaModel');
const metaProvider = require('./metaCloudApiProvider');
const limiteMetaService = require('../campanhas/limiteMetaService');

let obterAgora = function () { return new Date(); };

const ORDEM_STATUS = { pendente: 0, enviando: 1, enviada: 2, entregue: 3, lida: 4, falhou: 5 };
const MAPA_META = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou' };

function sanitizarTexto(valor, maximo) {
  if (typeof valor !== 'string') return null;
  return valor.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maximo) || null;
}

function prepararErro(erroRecebido) {
  const erro = erroRecebido || {};
  const codigo = sanitizarTexto(String(erro.code || erro.codigo || ''), 80);
  return {
    codigo,
    titulo: sanitizarTexto(erro.title || erro.titulo, 200),
    descricao: sanitizarTexto(erro.message || erro.descricao, 1000),
    categoria: sanitizarTexto(erro.error_data && erro.error_data.details || erro.categoria, 100),
    permiteNovaTentativa: false
  };
}

function prepararErroProvider(erro) {
  return {
    codigo: sanitizarTexto(erro.codigoIntegracao || 'META_ERRO', 80),
    titulo: 'Falha no envio pela Meta',
    descricao: sanitizarTexto(erro.message || 'Falha ao enviar mensagem.', 1000),
    categoria: 'meta_cloud_api',
    permiteNovaTentativa: erro.permiteNovaTentativa === true
  };
}

function identificarOptOut(mensagem) {
  const esperado = process.env.WHATSAPP_OPTOUT_BUTTON_ID || 'nao_quero_mais_receber';
  const identificador = mensagem && mensagem.interactive && mensagem.interactive.button_reply && mensagem.interactive.button_reply.id ||
    mensagem && mensagem.button && mensagem.button.payload;
  return identificador === esperado;
}

async function atualizarStatusEntrega(dados) {
  const identificador = sanitizarTexto(dados.identificadorExterno, 255);
  const status = dados.status;
  if (!identificador || ORDEM_STATUS[status] === undefined) throw criarAppError('Evento de mensageria invalido.', 400);
  return model.atualizarStatusPorIdentificador({
    identificadorExterno: identificador,
    chaveEvento: identificador + ':' + status,
    status,
    origem: dados.origem || 'webhook',
    erro: prepararErro(dados.erro)
  });
}

async function processarWebhook(payload) {
  const alteracoes = [];
  const entradas = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entrada of entradas) {
    const mudancas = Array.isArray(entrada.changes) ? entrada.changes : [];
    for (const mudanca of mudancas) {
      const valor = mudanca && mudanca.value || {};
      if (mudanca && mudanca.field === 'business_capability_update') {
        const contaEsperada = String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '');
        const contaRecebida = String(entrada.id || '');
        if (contaEsperada && contaRecebida === contaEsperada &&
          valor.max_daily_conversations_per_business !== undefined) {
          const atualizado = await limiteMetaService.registrarLimiteDoWebhook(
            valor.max_daily_conversations_per_business
          );
          alteracoes.push({
            processado: atualizado,
            motivo: atualizado ? 'limite_meta_atualizado' : 'limite_meta_invalido'
          });
        }
        continue;
      }
      const statuses = Array.isArray(valor.statuses) ? valor.statuses : [];
      for (const item of statuses) {
        const status = MAPA_META[item.status];
        if (!status || !item.id) continue;
        alteracoes.push(await atualizarStatusEntrega({
          identificadorExterno: item.id,
          status,
          statusAtual: 'pendente',
          origem: 'webhook',
          erro: item.errors && item.errors[0]
        }));
      }
      const mensagens = Array.isArray(valor.messages) ? valor.messages : [];
      for (const mensagem of mensagens) {
        if (!mensagem.id) continue;
        if (identificarOptOut(mensagem)) {
          const contexto = mensagem.context && mensagem.context.id
            ? await model.buscarTentativaPorIdentificadorPublico(sanitizarTexto(mensagem.context.id, 255))
            : null;
          alteracoes.push(await model.registrarOptOut({
            identificadorEvento: sanitizarTexto(mensagem.id, 240), telefone: mensagem.from,
            campanhaId: contexto && contexto.campanha_id, tentativaId: contexto && contexto.id
          }));
        } else {
          const nova = await model.registrarMensagemRecebida(sanitizarTexto(mensagem.id, 240));
          alteracoes.push({ processado: nova, motivo: nova ? 'mensagem_recebida_registrada' : 'evento_repetido' });
        }
      }
    }
  }
  return alteracoes;
}

async function receberIdentificadorExterno(tentativaId, identificadorExterno) {
  const id = Number(tentativaId);
  if (!Number.isInteger(id) || id < 1) throw criarAppError('Tentativa invalida.', 400);
  const identificador = sanitizarTexto(identificadorExterno, 255);
  if (!identificador) throw criarAppError('Identificador externo invalido.', 400);
  return model.vincularIdentificadorExterno(id, identificador);
}

async function prepararEnvio(tentativaId) {
  const tentativa = await model.buscarTentativa(Number(tentativaId));
  if (!tentativa) throw criarAppError('Tentativa nao encontrada.', 404);
  return { tentativaId: tentativa.id, status: tentativa.status, envioRealizado: false };
}

async function enviar(tentativaIdRecebido) {
  const tentativaId = Number(tentativaIdRecebido);
  if (!Number.isInteger(tentativaId) || tentativaId < 1) throw criarAppError('Tentativa invalida.', 400);
  let tentativa;
  try {
    tentativa = await model.iniciarEnvio(tentativaId, obterAgora());
  } catch (erro) {
    const conflitos = ['ENVIO_DUPLICADO','CAMPANHA_INDISPONIVEL','TEMPLATE_NAO_APROVADO','CONTATO_BLOQUEADO','CAPACIDADE_INSUFICIENTE'];
    if (erro.codigo === 'TENTATIVA_NAO_ENCONTRADA') throw criarAppError(erro.message, 404);
    if (conflitos.includes(erro.codigo)) throw criarAppError(erro.message, 409);
    throw erro;
  }
  try {
    const resultado = await metaProvider.enviarTemplate({
      telefone: tentativa.telefone_normalizado,
      nomeContato: tentativa.contato_nome,
      templateNome: tentativa.meta_nome,
      templateIdioma: tentativa.meta_idioma,
      templateComponentes: tentativa.meta_componentes,
      templateConfiguracaoEnvio: tentativa.meta_configuracao_envio
    });
    return await model.concluirEnvio(tentativaId, resultado.identificadorExterno, obterAgora());
  } catch (erro) {
    const falha = prepararErroProvider(erro);
    await model.registrarFalhaEnvio(tentativaId, falha, obterAgora());
    throw criarAppError(falha.descricao, erro.statusHttpExterno === 422 ? 422 : 502);
  }
}

async function reprocessar(tentativaId) {
  try { return await model.reprocessarFalha(Number(tentativaId)); }
  catch (erro) { if (erro.codigo === 'REPROCESSAMENTO_INVALIDO') throw criarAppError(erro.message, 409); throw erro; }
}

function definirRelogioParaTeste(funcao) {
  obterAgora = funcao || function () { return new Date(); };
}

function definirProviderParaTeste(funcao) {
  metaProvider.definirFetchParaTeste(funcao);
}

module.exports = {
  atualizarStatusEntrega, definirProviderParaTeste, definirRelogioParaTeste,
  enviar, prepararEnvio, processarWebhook, receberIdentificadorExterno, reprocessar
};
