const criarAppError = require('../../utils/AppError');
const campanhaModel = require('./campanhaModel');
const metaProvider = require('../mensageria/metaCloudApiProvider');

const LIMITES_POR_TIER = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_2K: 2000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: null,
  UNLIMITED: null,
  UNTIERED: 250
};

function interpretarTier(valor) {
  const tier = typeof valor === 'string' ? valor.trim().toUpperCase() : '';

  if (!Object.prototype.hasOwnProperty.call(LIMITES_POR_TIER, tier)) {
    throw criarAppError('A Meta retornou um limite oficial desconhecido.', 502);
  }

  return { tier, limite: LIMITES_POR_TIER[tier] };
}

function interpretarValorWebhook(valor) {
  if (typeof valor === 'number' && Number.isInteger(valor)) {
    if (valor === -1) return { tier: 'UNLIMITED', limite: null };
    if (valor > 0) return { tier: String(valor), limite: valor };
  }

  if (typeof valor === 'string') {
    const texto = valor.trim().toUpperCase();
    if (/^[0-9]+$/.test(texto) && Number(texto) > 0) {
      return { tier: texto, limite: Number(texto) };
    }
    return interpretarTier(texto);
  }

  throw criarAppError('A Meta enviou um limite oficial invalido.', 502);
}

function codigoSeguro(erro) {
  return String(erro && (erro.codigoIntegracao || erro.codigo) || 'META_ERRO')
    .replace(/[^A-Z0-9_-]/gi, '')
    .slice(0, 80) || 'META_ERRO';
}

async function registrarFalha(origem, erro, usuarioId) {
  await campanhaModel.registrarFalhaSincronizacaoLimiteMeta({
    origem,
    codigoErro: codigoSeguro(erro),
    usuarioId: usuarioId || null
  });
}

async function sincronizarPorApi(usuario) {
  try {
    const resposta = await metaProvider.consultarLimiteMensageria();
    const limite = interpretarTier(resposta.tier);
    await campanhaModel.registrarSincronizacaoLimiteMeta({
      tier: limite.tier,
      limite: limite.limite,
      origem: 'consulta_api',
      usuarioId: usuario && usuario.id
    });
    return campanhaModel.obterCapacidade(new Date());
  } catch (erro) {
    await registrarFalha('consulta_api', erro, usuario && usuario.id);
    if (erro.statusHttp) throw erro;
    throw criarAppError(
      'Nao foi possivel sincronizar o limite com a Meta. A capacidade segura anterior foi mantida.',
      502
    );
  }
}

async function registrarLimiteDoWebhook(valor) {
  try {
    const limite = interpretarValorWebhook(valor);
    await campanhaModel.registrarSincronizacaoLimiteMeta({
      tier: limite.tier,
      limite: limite.limite,
      origem: 'webhook_meta',
      usuarioId: null
    });
    return true;
  } catch (erro) {
    await registrarFalha('webhook_meta', erro, null);
    return false;
  }
}

module.exports = {
  interpretarTier,
  interpretarValorWebhook,
  registrarLimiteDoWebhook,
  sincronizarPorApi
};
