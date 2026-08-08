const criarAppError = require('../../utils/AppError');
const model = require('./mensageriaModel');

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
        if (mensagem.id) {
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

async function reprocessar(tentativaId) {
  try { return await model.reprocessarFalha(Number(tentativaId)); }
  catch (erro) { if (erro.codigo === 'REPROCESSAMENTO_INVALIDO') throw criarAppError(erro.message, 409); throw erro; }
}

module.exports = { atualizarStatusEntrega, prepararEnvio, processarWebhook, receberIdentificadorExterno, reprocessar };
