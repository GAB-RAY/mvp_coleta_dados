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
    appId: process.env.META_APP_ID,
    versao: process.env.META_GRAPH_API_VERSION
  };
  if (!configuracao.token || !configuracao.phoneNumberId || !configuracao.businessAccountId || !configuracao.versao) {
    throw criarErroIntegracao('A integracao com o WhatsApp nao esta configurada.', 'META_NAO_CONFIGURADA', 503, false);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(configuracao.versao) || !/^\d+$/.test(configuracao.phoneNumberId) || !/^\d+$/.test(configuracao.businessAccountId)) {
    throw criarErroIntegracao('A configuracao da integracao com o WhatsApp e invalida.', 'META_CONFIGURACAO_INVALIDA', 503, false);
  }
  return configuracao;
}

function resolverParametro(parametro, comando, posicao) {
  const origens = {
    nome_contato: comando.nomeContato,
    bairro: comando.bairroContato,
    problema: comando.problemaContato,
    fixo: parametro.valor
  };
  const valor = textoSeguro(origens[parametro.origem], 1000);
  if (!valor) {
    throw criarErroIntegracao(
      'Este contato nao possui a informacao necessaria para preencher {{' + posicao + '}}.',
      'TEMPLATE_DADO_AUSENTE', 422, false
    );
  }
  return valor;
}

function contarVariaveis(conteudo) {
  const numeros = Array.from(String(conteudo || '').matchAll(/\{\{(\d+)\}\}/g), function (item) {
    return Number(item[1]);
  });
  return new Set(numeros).size;
}

function validarConfiguracaoParaEnvio(comando) {
  const componentes = Array.isArray(comando.templateComponentes) ? comando.templateComponentes : [];
  if (!componentes.length) return;
  const configuracao = comando.templateConfiguracaoEnvio || {};
  const corpo = componentes.find(function (item) { return item.type === 'BODY'; });
  const parametrosCorpo = Array.isArray(configuracao.corpo) ? configuracao.corpo : [];
  if (contarVariaveis(corpo && corpo.text) !== parametrosCorpo.length) {
    throw criarErroIntegracao('Configure todos os parametros do texto principal antes do envio.', 'TEMPLATE_META_INVALIDO', 409, false);
  }
  const cabecalho = componentes.find(function (item) { return item.type === 'HEADER'; });
  if (cabecalho && cabecalho.format === 'IMAGE' && (!configuracao.cabecalho || configuracao.cabecalho.tipo !== 'imagem')) {
    throw criarErroIntegracao('Configure a imagem do template antes do envio.', 'TEMPLATE_META_INVALIDO', 409, false);
  }
  if (cabecalho && cabecalho.format === 'TEXT' && contarVariaveis(cabecalho.text) > 0) {
    const parametros = configuracao.cabecalho && configuracao.cabecalho.parametros;
    if (!Array.isArray(parametros) || parametros.length !== contarVariaveis(cabecalho.text)) {
      throw criarErroIntegracao('Configure o cabecalho do template antes do envio.', 'TEMPLATE_META_INVALIDO', 409, false);
    }
  }
  const grupoBotoes = componentes.find(function (item) { return item.type === 'BUTTONS'; });
  const configuracoesBotoes = Array.isArray(configuracao.botoes) ? configuracao.botoes : [];
  if (!grupoBotoes) return;
  grupoBotoes.buttons.forEach(function (botao, indice) {
    const exigeParametro = botao.type === 'QUICK_REPLY' || (botao.type === 'URL' && String(botao.url || '').includes('{{1}}'));
    if (!exigeParametro) return;
    const encontrada = configuracoesBotoes.find(function (item) { return item.indice === indice; });
    if (!encontrada) {
      throw criarErroIntegracao('Configure todos os botoes do template antes do envio.', 'TEMPLATE_META_INVALIDO', 409, false);
    }
  });
}

function montarComponentesEnvio(comando) {
  const configuracao = comando.templateConfiguracaoEnvio || {};
  const componentes = [];
  if (configuracao.cabecalho) {
    const cabecalho = configuracao.cabecalho;
    if (cabecalho.tipo === 'imagem') {
      const imagem = cabecalho.origem === 'id' ? { id: cabecalho.valor } : { link: cabecalho.valor };
      componentes.push({ type: 'header', parameters: [{ type: 'image', image: imagem }] });
    } else if (cabecalho.tipo === 'texto' && Array.isArray(cabecalho.parametros) && cabecalho.parametros.length) {
      componentes.push({
        type: 'header',
        parameters: cabecalho.parametros.map(function (item, indice) {
          return { type: 'text', text: resolverParametro(item, comando, indice + 1) };
        })
      });
    }
  }
  if (Array.isArray(configuracao.corpo) && configuracao.corpo.length) {
    componentes.push({
      type: 'body',
      parameters: configuracao.corpo.map(function (item, indice) {
        return { type: 'text', text: resolverParametro(item, comando, indice + 1) };
      })
    });
  }
  if (Array.isArray(configuracao.botoes)) {
    configuracao.botoes.forEach(function (botao) {
      const valor = botao.origem === 'opt_out'
        ? process.env.WHATSAPP_OPTOUT_BUTTON_ID
        : resolverParametro(botao, comando, 1);
      if (!valor) throw criarErroIntegracao('A configuracao do botao do template e invalida.', 'TEMPLATE_META_INVALIDO', 409, false);
      componentes.push({
        type: 'button',
        sub_type: botao.subtipo,
        index: String(botao.indice),
        parameters: [{ type: botao.subtipo === 'quick_reply' ? 'payload' : 'text', [botao.subtipo === 'quick_reply' ? 'payload' : 'text']: valor }]
      });
    });
  }
  return componentes;
}

function montarPayload(comando) {
  const telefone = String(comando.telefone || '').replace(/\D/g, '');
  if (telefone.length < 10 || telefone.length > 15) {
    throw criarErroIntegracao('O telefone do contato e invalido para o WhatsApp.', 'TELEFONE_INVALIDO', 422, false);
  }
  if (!comando.templateNome || !comando.templateIdioma) {
    throw criarErroIntegracao('O template oficial da Meta nao esta configurado.', 'TEMPLATE_META_INVALIDO', 409, false);
  }
  validarConfiguracaoParaEnvio(comando);
  const template = { name: comando.templateNome, language: { code: comando.templateIdioma } };
  const componentes = montarComponentesEnvio(comando);
  if (componentes.length) template.components = componentes;
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to: telefone, type: 'template', template };
}

async function lerResposta(resposta) {
  try { return await resposta.json(); }
  catch (erro) { throw criarErroIntegracao('A Meta retornou uma resposta invalida.', 'META_RESPOSTA_INVALIDA', resposta.status, true); }
}

function prepararErroMeta(resposta, corpo, operacao) {
  const externo = corpo && corpo.error || {};
  const codigo = textoSeguro(externo.code || externo.error_subcode, 80) || 'META_HTTP_' + resposta.status;
  let mensagem = resposta.status === 401 ? 'A credencial da Meta foi recusada.' : 'A Meta recusou a operacao solicitada.';
  if (operacao === 'template') mensagem = resposta.status === 401 ? mensagem : 'A Meta recusou o template. Revise os campos e exemplos informados.';
  if (operacao === 'imagem') mensagem = resposta.status === 401 ? 'A conexao com a Meta precisa ser conferida pelo administrador.' : 'Nao foi possivel enviar a imagem. Verifique o arquivo e tente novamente.';
  return criarErroIntegracao(mensagem, codigo, resposta.status, resposta.status >= 500 || resposta.status === 429);
}

async function requisitarMeta(caminho, opcoes, operacao) {
  const configuracao = obterConfiguracao();
  const controlador = new AbortController();
  const timeoutMs = Number(process.env.META_REQUISICAO_TIMEOUT_MS || 10000);
  const temporizador = setTimeout(function () { controlador.abort(); }, timeoutMs);
  try {
    const resposta = await executarFetch(ENDERECO_GRAPH + '/' + configuracao.versao + '/' + caminho, Object.assign({}, opcoes, {
      headers: Object.assign({ Authorization: 'Bearer ' + configuracao.token }, opcoes && opcoes.headers),
      signal: controlador.signal
    }));
    const corpo = await lerResposta(resposta);
    if (!resposta.ok) throw prepararErroMeta(resposta, corpo, operacao);
    return { corpo, status: resposta.status };
  } catch (erro) {
    if (erro.name === 'AbortError') throw criarErroIntegracao('A Meta nao respondeu dentro do tempo esperado.', 'META_TIMEOUT', 504, true);
    if (erro.codigoIntegracao) throw erro;
    throw criarErroIntegracao('Nao foi possivel comunicar com a Meta.', 'META_INDISPONIVEL', 503, true);
  } finally { clearTimeout(temporizador); }
}

async function enviarTemplate(comando) {
  const configuracao = obterConfiguracao();
  const resposta = await requisitarMeta(configuracao.phoneNumberId + '/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(montarPayload(comando))
  }, 'envio');
  const identificador = resposta.corpo && Array.isArray(resposta.corpo.messages) && resposta.corpo.messages[0] && resposta.corpo.messages[0].id;
  if (!identificador) throw criarErroIntegracao('A Meta nao confirmou o identificador da mensagem.', 'META_RESPOSTA_INVALIDA', resposta.status, true);
  return { identificadorExterno: textoSeguro(identificador, 255) };
}

async function criarTemplateOficial(payload) {
  const configuracao = obterConfiguracao();
  const resposta = await requisitarMeta(configuracao.businessAccountId + '/message_templates', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }, 'template');
  if (!resposta.corpo || !resposta.corpo.id || !resposta.corpo.status) {
    throw criarErroIntegracao('A Meta retornou uma resposta incompleta ao criar o template.', 'META_RESPOSTA_INVALIDA', resposta.status, true);
  }
  return resposta.corpo;
}

async function prepararImagemExemplo(conteudo, tipoMime) {
  const configuracao = obterConfiguracao();
  if (!configuracao.appId || !/^\d+$/.test(configuracao.appId)) {
    throw criarErroIntegracao(
      'O aplicativo da Meta nao esta configurado para preparar imagens de template.',
      'META_APP_NAO_CONFIGURADO',
      503,
      false
    );
  }
  if (!Buffer.isBuffer(conteudo) || conteudo.length === 0) {
    throw criarErroIntegracao('A imagem de exemplo e invalida.', 'META_IMAGEM_INVALIDA', 400, false);
  }

  const parametros = new URLSearchParams({
    file_length: String(conteudo.length),
    file_type: tipoMime
  });
  const sessao = await requisitarMeta(
    configuracao.appId + '/uploads?' + parametros.toString(),
    { method: 'POST' },
    'template'
  );
  const identificadorSessao = textoSeguro(sessao.corpo && sessao.corpo.id, 4000);
  if (!identificadorSessao || !identificadorSessao.startsWith('upload:')) {
    throw criarErroIntegracao(
      'A Meta nao confirmou a preparacao da imagem de exemplo.',
      'META_RESPOSTA_INVALIDA',
      sessao.status,
      true
    );
  }

  const upload = await requisitarMeta(identificadorSessao, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      file_offset: '0'
    },
    body: conteudo
  }, 'template');
  const handle = textoSeguro(upload.corpo && upload.corpo.h, 4000);
  if (!handle) {
    throw criarErroIntegracao(
      'A Meta nao confirmou a imagem de exemplo do template.',
      'META_RESPOSTA_INVALIDA',
      upload.status,
      true
    );
  }
  return { handle };
}

async function prepararImagemEnvio(conteudo, tipoMime, nomeArquivo) {
  const configuracao = obterConfiguracao();
  if (!Buffer.isBuffer(conteudo) || conteudo.length === 0) {
    throw criarErroIntegracao('Selecione uma imagem JPG ou PNG valida.', 'META_IMAGEM_INVALIDA', 400, false);
  }
  const formulario = new FormData();
  formulario.append('messaging_product', 'whatsapp');
  formulario.append('file', new Blob([conteudo], { type: tipoMime }), nomeArquivo || 'imagem');
  const resposta = await requisitarMeta(
    configuracao.phoneNumberId + '/media',
    { method: 'POST', body: formulario },
    'imagem'
  );
  const id = textoSeguro(resposta.corpo && resposta.corpo.id, 255);
  if (!id) {
    throw criarErroIntegracao(
      'Nao foi possivel preparar a imagem para o envio. Tente novamente.',
      'META_RESPOSTA_INVALIDA', resposta.status, true
    );
  }
  return { id };
}

async function listarTemplatesOficiais() {
  const configuracao = obterConfiguracao();
  const templates = [];
  const cursores = new Set();
  let cursor = null;
  for (let pagina = 0; pagina < 100; pagina += 1) {
    const parametros = new URLSearchParams({ fields: 'id,name,language,status,category,components', limit: '100' });
    if (cursor) parametros.set('after', cursor);
    const resposta = await requisitarMeta(configuracao.businessAccountId + '/message_templates?' + parametros.toString(), { method: 'GET' }, 'template');
    if (!resposta.corpo || !Array.isArray(resposta.corpo.data)) {
      throw criarErroIntegracao('A Meta retornou uma lista de templates invalida.', 'META_RESPOSTA_INVALIDA', resposta.status, true);
    }
    templates.push.apply(templates, resposta.corpo.data);
    const proximo = resposta.corpo.paging && resposta.corpo.paging.next && resposta.corpo.paging.cursors && resposta.corpo.paging.cursors.after;
    if (!proximo) return templates;
    if (cursores.has(proximo)) throw criarErroIntegracao('A paginacao da Meta retornou um cursor repetido.', 'META_RESPOSTA_INVALIDA', resposta.status, true);
    cursores.add(proximo); cursor = proximo;
  }
  throw criarErroIntegracao('A Meta excedeu o limite seguro de paginas de templates.', 'META_RESPOSTA_INVALIDA', 502, true);
}

async function buscarTemplateOficialPorNome(nome) {
  const configuracao = obterConfiguracao();
  const parametros = new URLSearchParams({ fields: 'id,name,language,status,category,components', name: nome });
  const resposta = await requisitarMeta(configuracao.businessAccountId + '/message_templates?' + parametros.toString(), { method: 'GET' }, 'template');
  if (!resposta.corpo || !Array.isArray(resposta.corpo.data)) throw criarErroIntegracao('A Meta retornou uma resposta de template invalida.', 'META_RESPOSTA_INVALIDA', resposta.status, true);
  return resposta.corpo.data;
}

async function buscarTemplateOficialPorId(idRecebido) {
  const id = String(idRecebido || '').trim();
  if (!/^\d+$/.test(id)) {
    throw criarErroIntegracao('O identificador oficial do template e invalido.', 'META_TEMPLATE_INVALIDO', 400, false);
  }
  const parametros = new URLSearchParams({ fields: 'id,name,language,status,category,components' });
  const resposta = await requisitarMeta(id + '?' + parametros.toString(), { method: 'GET' }, 'template');
  if (!resposta.corpo || String(resposta.corpo.id || '') !== id) {
    throw criarErroIntegracao('A Meta retornou um template invalido.', 'META_RESPOSTA_INVALIDA', resposta.status, true);
  }
  return resposta.corpo;
}

async function consultarLimiteMensageria() {
  const configuracao = obterConfiguracao();
  const parametros = new URLSearchParams({ fields: 'whatsapp_business_manager_messaging_limit' });
  const resposta = await requisitarMeta(configuracao.phoneNumberId + '?' + parametros.toString(), { method: 'GET' }, 'limite');
  const tier = textoSeguro(resposta.corpo && resposta.corpo.whatsapp_business_manager_messaging_limit, 40);
  if (!tier) throw criarErroIntegracao('A Meta nao informou o limite oficial de mensageria.', 'META_LIMITE_AUSENTE', resposta.status, true);
  return { tier };
}

function definirFetchParaTeste(funcao) { executarFetch = funcao || function () { return fetch.apply(globalThis, arguments); }; }

module.exports = {
  buscarTemplateOficialPorId, buscarTemplateOficialPorNome, consultarLimiteMensageria, criarTemplateOficial,
  definirFetchParaTeste, enviarTemplate, listarTemplatesOficiais, montarPayload, prepararImagemEnvio, prepararImagemExemplo,
  validarConfiguracaoParaEnvio
};
