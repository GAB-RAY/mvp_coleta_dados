const ENDERECO_GRAPH = 'https://graph.facebook.com';

let executarFetch = function () { return fetch.apply(globalThis, arguments); };

function textoSeguro(valor, maximo) {
  if (valor === undefined || valor === null) return null;
  return String(valor).replace(/[\r\n\t]+/g, ' ').trim().slice(0, maximo) || null;
}

function criarErroIntegracao(mensagem, codigo, statusHttp, permiteNovaTentativa) {
  const erro = new Error(mensagem);
  erro.codigoIntegracao = textoSeguro(codigo, 80) || 'META_ERRO';
  erro.statusHttpExterno = Number(statusHttp) || null;
  erro.permiteNovaTentativa = permiteNovaTentativa === true;
  return erro;
}

function obterConfiguracao() {
  const configuracao = {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    versao: process.env.META_GRAPH_API_VERSION
  };
  if (!configuracao.token || !configuracao.phoneNumberId || !configuracao.businessAccountId || !configuracao.versao) {
    throw criarErroIntegracao('A integracao com o WhatsApp nao esta configurada.', 'META_NAO_CONFIGURADA', 503, false);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(configuracao.versao) || !/^\d+$/.test(configuracao.phoneNumberId)) {
    throw criarErroIntegracao('A configuracao da integracao com o WhatsApp e invalida.', 'META_CONFIGURACAO_INVALIDA', 503, false);
  }
  return configuracao;
}

function montarPayload(comando) {
  const telefone = String(comando.telefone || '').replace(/\D/g, '');
  if (telefone.length < 10 || telefone.length > 15) {
    throw criarErroIntegracao('O telefone do contato e invalido para o WhatsApp.', 'TELEFONE_INVALIDO', 422, false);
  }
  if (!comando.templateNome || !comando.templateIdioma) {
    throw criarErroIntegracao('O template oficial da Meta nao esta configurado.', 'TEMPLATE_META_INVALIDO', 409, false);
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: telefone,
    type: 'template',
    template: {
      name: comando.templateNome,
      language: { code: comando.templateIdioma }
    }
  };
}

async function lerResposta(resposta) {
  try { return await resposta.json(); }
  catch (erro) { throw criarErroIntegracao('A Meta retornou uma resposta invalida.', 'META_RESPOSTA_INVALIDA', resposta.status, true); }
}

function prepararErroMeta(resposta, corpo) {
  const externo = corpo && corpo.error || {};
  const codigo = textoSeguro(externo.code || externo.error_subcode, 80) || 'META_HTTP_' + resposta.status;
  const mensagem = resposta.status === 401
    ? 'A credencial da Meta foi recusada.'
    : 'A Meta recusou o envio da mensagem.';
  const permite = resposta.status >= 500 || resposta.status === 429;
  return criarErroIntegracao(mensagem, codigo, resposta.status, permite);
}

async function enviarTemplate(comando) {
  const configuracao = obterConfiguracao();
  const payload = montarPayload(comando);
  const controlador = new AbortController();
  const timeoutMs = Number(process.env.META_REQUISICAO_TIMEOUT_MS || 10000);
  const temporizador = setTimeout(function () { controlador.abort(); }, timeoutMs);
  try {
    const resposta = await executarFetch(
      ENDERECO_GRAPH + '/' + configuracao.versao + '/' + configuracao.phoneNumberId + '/messages',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + configuracao.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controlador.signal
      }
    );
    const corpo = await lerResposta(resposta);
    if (!resposta.ok) throw prepararErroMeta(resposta, corpo);
    const identificador = corpo && Array.isArray(corpo.messages) && corpo.messages[0] && corpo.messages[0].id;
    if (!identificador) throw criarErroIntegracao('A Meta nao confirmou o identificador da mensagem.', 'META_RESPOSTA_INVALIDA', resposta.status, true);
    return { identificadorExterno: textoSeguro(identificador, 255) };
  } catch (erro) {
    if (erro.name === 'AbortError') throw criarErroIntegracao('A Meta nao respondeu dentro do tempo esperado.', 'META_TIMEOUT', 504, true);
    if (erro.codigoIntegracao) throw erro;
    throw criarErroIntegracao('Nao foi possivel comunicar com a Meta.', 'META_INDISPONIVEL', 503, true);
  } finally {
    clearTimeout(temporizador);
  }
}

async function consultarLimiteMensageria() {
  const configuracao = obterConfiguracao();
  const controlador = new AbortController();
  const timeoutMs = Number(process.env.META_REQUISICAO_TIMEOUT_MS || 10000);
  const temporizador = setTimeout(function () { controlador.abort(); }, timeoutMs);

  try {
    const parametros = new URLSearchParams({
      fields: 'whatsapp_business_manager_messaging_limit'
    });
    const resposta = await executarFetch(
      ENDERECO_GRAPH + '/' + configuracao.versao + '/' + configuracao.phoneNumberId + '?' + parametros.toString(),
      {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + configuracao.token },
        signal: controlador.signal
      }
    );
    const corpo = await lerResposta(resposta);

    if (!resposta.ok) {
      throw prepararErroMeta(resposta, corpo);
    }

    const tier = textoSeguro(
      corpo && corpo.whatsapp_business_manager_messaging_limit,
      40
    );

    if (!tier) {
      throw criarErroIntegracao(
        'A Meta não informou o limite oficial de mensageria.',
        'META_LIMITE_AUSENTE',
        resposta.status,
        true
      );
    }

    return { tier };
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw criarErroIntegracao(
        'A Meta não respondeu dentro do tempo esperado.',
        'META_TIMEOUT',
        504,
        true
      );
    }
    if (erro.codigoIntegracao) throw erro;
    throw criarErroIntegracao(
      'Não foi possível consultar o limite na Meta.',
      'META_INDISPONIVEL',
      503,
      true
    );
  } finally {
    clearTimeout(temporizador);
  }
}

function definirFetchParaTeste(funcao) {
  executarFetch = funcao || function () { return fetch.apply(globalThis, arguments); };
}

module.exports = {
  consultarLimiteMensageria,
  definirFetchParaTeste,
  enviarTemplate,
  montarPayload
};
