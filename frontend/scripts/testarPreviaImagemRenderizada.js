import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const diretorio = path.dirname(fileURLToPath(import.meta.url));
const raizFrontend = path.resolve(diretorio, '..');
const diretorioBuild = path.join(raizFrontend, 'dist');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const configuracaoVercel = JSON.parse(fs.readFileSync(path.join(raizFrontend, 'vercel.json'), 'utf8'));
const politicaSeguranca = configuracaoVercel.headers[0].headers.find(function (cabecalho) {
  return cabecalho.key === 'Content-Security-Policy';
}).value;

function aguardar(tempo) {
  return new Promise(function (resolver) { setTimeout(resolver, tempo); });
}

function tipoConteudo(arquivo) {
  const extensao = path.extname(arquivo).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  }[extensao] || 'application/octet-stream';
}

function iniciarServidor() {
  const servidor = http.createServer(function (requisicao, resposta) {
    const caminhoRecebido = decodeURIComponent(new URL(requisicao.url, 'http://localhost').pathname);
    const caminhoRelativo = caminhoRecebido === '/' ? 'index.html' : caminhoRecebido.replace(/^\/+/, '');
    let arquivo = path.resolve(diretorioBuild, caminhoRelativo);

    if (!arquivo.startsWith(diretorioBuild) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      arquivo = path.join(diretorioBuild, 'index.html');
    }

    resposta.writeHead(200, {
      'Content-Type': tipoConteudo(arquivo),
      'Content-Security-Policy': politicaSeguranca,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(arquivo).pipe(resposta);
  });

  return new Promise(function (resolver) {
    servidor.listen(0, '127.0.0.1', function () {
      resolver({ servidor, porta: servidor.address().port });
    });
  });
}

async function aguardarDepuracao(porta) {
  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    try {
      const resposta = await fetch('http://127.0.0.1:' + porta + '/json/list');
      const alvos = await resposta.json();
      const pagina = alvos.find(function (alvo) { return alvo.type === 'page'; });
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch (erro) {
      // O navegador ainda está iniciando.
    }
    await aguardar(100);
  }
  throw new Error('O Edge não disponibilizou a sessão de depuração.');
}

function conectar(endereco) {
  return new Promise(function (resolver, rejeitar) {
    const socket = new WebSocket(endereco);
    const pendentes = new Map();
    let proximoId = 1;

    socket.addEventListener('open', function () {
      resolver({
        enviar: function (metodo, parametros) {
          return new Promise(function (resolverComando, rejeitarComando) {
            const id = proximoId;
            proximoId += 1;
            pendentes.set(id, { resolver: resolverComando, rejeitar: rejeitarComando });
            socket.send(JSON.stringify({ id, method: metodo, params: parametros || {} }));
          });
        },
        fechar: function () { socket.close(); }
      });
    });
    socket.addEventListener('message', function (evento) {
      const mensagem = JSON.parse(evento.data);
      if (!mensagem.id || !pendentes.has(mensagem.id)) return;
      const pendente = pendentes.get(mensagem.id);
      pendentes.delete(mensagem.id);
      if (mensagem.error) pendente.rejeitar(new Error(mensagem.error.message));
      else pendente.resolver(mensagem.result);
    });
    socket.addEventListener('error', rejeitar);
  });
}

async function executarExpressao(cliente, expressao) {
  const resultado = await cliente.enviar('Runtime.evaluate', {
    expression: expressao,
    awaitPromise: true,
    returnByValue: true
  });
  if (resultado.exceptionDetails) {
    throw new Error(resultado.exceptionDetails.text || 'Falha ao executar expressão no navegador.');
  }
  return resultado.result.value;
}

async function aguardarCondicao(cliente, expressao, mensagem) {
  for (let tentativa = 0; tentativa < 80; tentativa += 1) {
    if (await executarExpressao(cliente, expressao)) return;
    await aguardar(100);
  }
  throw new Error(mensagem);
}

const scriptPreparacao = String.raw`
  localStorage.setItem('tokenAdministrativo', 'token-qa-visual');
  localStorage.setItem('usuarioAdministrativo', JSON.stringify({ id: 1, nome: 'QA visual', perfil: 'administrador' }));
  window.confirm = function () { return true; };
  window.__requisicoesQa = [];
  window.__templateQa = {
    id: 9001, nome: 'Modelo externo com imagem', categoria: 'MARKETING', texto: 'Olá {{nome}}, convite oficial', ativo: true,
    meta_nome: 'modelo_externo_imagem_qa', meta_idioma: 'pt_BR', meta_categoria: 'MARKETING',
    meta_status: 'aprovado', meta_status_oficial: 'APPROVED', meta_template_id: '999300001', meta_origem: 'meta',
    meta_componentes: [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', parameter_format: 'NAMED', text: 'Olá {{nome}}, convite oficial' },
      { type: 'BUTTONS', buttons: [
        { type: 'URL', text: 'Quero Participar!', url: 'https://example.com/participar' },
        { type: 'QUICK_REPLY', text: 'SAIR' }
      ] }
    ],
    meta_configuracao_envio: { corpo: [{ origem: 'nome_contato' }], botoes: [] }
  };
  window.fetch = async function (entrada, opcoes) {
    const url = String(entrada);
    const configuracao = opcoes || {};
    const metodo = String(configuracao.method || 'GET').toUpperCase();
    window.__requisicoesQa.push({ url: url, metodo: metodo, corpo: typeof configuracao.body === 'string' ? configuracao.body : null });
    if (url.includes('/templates/imagem-envio') && metodo === 'POST') {
      return new Response(JSON.stringify({ mensagem: 'Imagem preparada.', imagem: { id: 'media-id-browser-qa' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/templates/9001/configuracao-envio') && metodo === 'PUT') {
      const dados = JSON.parse(configuracao.body);
      window.__templateQa.meta_configuracao_envio = dados.configuracaoEnvio;
      return new Response(JSON.stringify({ mensagem: 'Configuração de envio atualizada com sucesso.', template: window.__templateQa }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      campanhas: [], templates: [window.__templateQa],
      capacidade: { capacidadeRestante: 0, limiteInterno: 250, utilizado24h: 0 },
      bairros: [], categoriasProblema: [], eventos: [], origens: []
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
`;

const selecionarCabecalhoImagem = String.raw`(() => {
  const rotulo = Array.from(document.querySelectorAll('label')).find(item => item.firstChild && item.firstChild.textContent.trim() === 'Cabeçalho');
  if (!rotulo) return false;
  const campo = rotulo.querySelector('select');
  campo.value = 'imagem';
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`;

const selecionarArquivo = String.raw`(() => {
  const campos = Array.from(document.querySelectorAll('input[type="file"]'));
  const campo = campos[campos.length - 1];
  if (!campo) return false;
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP8z8AARAwMjDAGACQDAf8ZB2B3AAAAAElFTkSuQmCC'), caractere => caractere.charCodeAt(0));
  const arquivo = new File([bytes], 'imagem-qa.png', { type: 'image/png' });
  const transferencia = new DataTransfer();
  transferencia.items.add(arquivo);
  campo.files = transferencia.files;
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`;

const removerArquivo = String.raw`(() => {
  const campos = Array.from(document.querySelectorAll('input[type="file"]'));
  const campo = campos[campos.length - 1];
  if (!campo) return false;
  campo.value = '';
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`;

function alterarModo(modo) {
  return `(() => {
    const campo = document.querySelector('input[name="imagemModo"][value="${modo}"]');
    if (!campo) return false;
    campo.click();
    return true;
  })()`;
}

function preencherUrl(valor) {
  return `(() => {
    const campo = document.querySelector('input[type="url"][placeholder="https://..."]');
    if (!campo) return false;
    const definidor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    definidor.call(campo, ${JSON.stringify(valor)});
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`;
}

async function validarImagem(cliente, prefixo) {
  await aguardarCondicao(
    cliente,
    `(() => { const imagem = document.querySelector('.bolha-previa-whatsapp > img'); return Boolean(imagem && imagem.src.startsWith(${JSON.stringify(prefixo)}) && imagem.complete && imagem.naturalWidth > 0); })()`,
    'A imagem ' + prefixo + ' não apareceu na prévia renderizada.'
  );
}

let servidor;
let navegador;
let cliente;
let diretorioTemporario;

try {
  assert.equal(fs.existsSync(path.join(diretorioBuild, 'index.html')), true, 'Execute o build antes do teste visual.');
  const iniciado = await iniciarServidor();
  servidor = iniciado.servidor;
  diretorioTemporario = fs.mkdtempSync(path.join(os.tmpdir(), 'acorda-rj-previa-'));
  const portaDepuracao = 9300 + Math.floor(Math.random() * 400);
  navegador = spawn(edge, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--ignore-certificate-errors', '--user-data-dir=' + diretorioTemporario,
    '--remote-debugging-port=' + portaDepuracao, '--window-size=1440,1000', 'about:blank'
  ], { stdio: 'ignore' });

  cliente = await conectar(await aguardarDepuracao(portaDepuracao));
  await cliente.enviar('Page.enable');
  await cliente.enviar('Runtime.enable');
  await cliente.enviar('Page.addScriptToEvaluateOnNewDocument', { source: scriptPreparacao });
  await cliente.enviar('Page.navigate', { url: 'http://127.0.0.1:' + iniciado.porta + '/admin/campanhas' });
  await aguardarCondicao(cliente, `document.body && document.body.textContent.includes('Gerenciar modelos de mensagem')`, 'A tela de campanhas não foi carregada.');

  await executarExpressao(cliente, `document.querySelector('.gerenciar-templates-campanha').open = true`);
  assert.equal(await executarExpressao(cliente, `(() => {
    const campo = document.querySelector('.campo-template-conteudo textarea');
    const definir = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    definir.call(campo, 'Olá, ');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`), true);
  assert.equal(await executarExpressao(cliente, `(() => {
    const campo = document.querySelector('.campo-template-conteudo textarea');
    campo.focus(); campo.setSelectionRange(5, 5);
    const opcao = Array.from(document.querySelectorAll('.atalhos-personalizacao-template button')).find(item => item.textContent.trim() === 'Nome da pessoa');
    opcao.click();
    return true;
  })()`), true);
  await aguardarCondicao(cliente, `(() => {
    const campo=document.querySelector('.campo-template-conteudo textarea');
    const origem=document.querySelector('.configuracao-parametro-template select');
    return campo?.value==='Olá, {{1}}' && origem?.value==='nome_contato';
  })()`, 'A opção Nome da pessoa não inseriu nem configurou {{1}}.');
  assert.equal(await executarExpressao(cliente, `(() => {
    const campo = document.querySelector('.campo-template-conteudo textarea');
    const definir = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    definir.call(campo, campo.value + '! Seu bairro é ');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`), true);
  assert.equal(await executarExpressao(cliente, `(() => {
    const campo = document.querySelector('.campo-template-conteudo textarea');
    campo.focus(); campo.setSelectionRange(campo.value.length, campo.value.length);
    const opcao = Array.from(document.querySelectorAll('.atalhos-personalizacao-template button')).find(item => item.textContent.trim() === 'Bairro');
    opcao.click();
    return true;
  })()`), true);
  await aguardarCondicao(cliente, `(() => {
    const campo=document.querySelector('.campo-template-conteudo textarea');
    const origens=document.querySelectorAll('.configuracao-parametro-template select');
    return campo?.value==='Olá, {{1}}! Seu bairro é {{2}}' && origens.length===2 && origens[1].value==='bairro';
  })()`, 'A opção Bairro não inseriu nem configurou {{2}}.');
  await aguardarCondicao(cliente, `document.querySelector('.texto-corpo-previa')?.textContent.includes('Olá, João! Seu bairro é Copacabana')`, 'A prévia não resolveu as informações adicionadas pelos atalhos.');
  assert.equal(await executarExpressao(cliente, `(() => {
    const adicionar = Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim().startsWith('+ Adicionar'));
    if (!adicionar) return false;
    adicionar.click();
    return true;
  })()`), true);
  await aguardarCondicao(cliente, `document.querySelectorAll('.editor-botao-modelo').length === 1`, 'O primeiro botao nao foi adicionado ao construtor.');
  await executarExpressao(cliente, `Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim().startsWith('+ Adicionar')).click()`);
  await aguardarCondicao(cliente, `document.querySelectorAll('.editor-botao-modelo').length === 2`, 'Dois botoes nao foram adicionados ao construtor.');
  assert.equal(await executarExpressao(cliente, `(() => {
    const editores = document.querySelectorAll('.editor-botao-modelo');
    const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    definir.call(editores[0].querySelector('input'), 'Quero participar!');
    editores[0].querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
    const selecao = editores[1].querySelector('select');
    selecao.value = 'optout'; selecao.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`), true);
  await aguardarCondicao(cliente, `document.querySelectorAll('.botao-previa').length === 2`, 'A previa nao exibiu todos os botoes.');
  assert.equal(await executarExpressao(cliente, `(() => { const botoes=document.querySelectorAll('[aria-label*="cima"]'); botoes[1].click(); return true; })()`), true);
  await aguardarCondicao(cliente, `document.querySelector('.botao-previa')?.textContent.includes('SAIR')`, 'A previa nao acompanhou a nova ordem dos botoes.');
  assert.equal(await executarExpressao(cliente, `(() => { const remover=Array.from(document.querySelectorAll('.editor-botao-modelo button')).find(item => item.textContent.trim()==='Remover'); remover.click(); return true; })()`), true);
  await aguardarCondicao(cliente, `document.querySelectorAll('.editor-botao-modelo').length === 1 && document.querySelectorAll('.botao-previa').length === 1`, 'A remocao do botao nao atualizou a previa.');
  assert.equal(await executarExpressao(cliente, selecionarCabecalhoImagem), true);
  await aguardarCondicao(cliente, `document.querySelectorAll('input[type="file"]').length === 2`, 'Os campos de imagem não foram exibidos.');

  assert.equal(await executarExpressao(cliente, selecionarArquivo), true);
  await validarImagem(cliente, 'blob:');

  assert.equal(await executarExpressao(cliente, alterarModo('internet')), true);
  await aguardarCondicao(cliente, `Boolean(document.querySelector('input[type="url"][placeholder="https://..."]'))`, 'O campo de URL não apareceu.');
  assert.equal(await executarExpressao(cliente, preencherUrl('https://placehold.co/2x2.png')), true);
  await validarImagem(cliente, 'https://placehold.co/2x2.png');

  assert.equal(await executarExpressao(cliente, preencherUrl('')), true);
  await aguardarCondicao(cliente, `document.querySelector('.imagem-vazia-previa')?.textContent.includes('Sua imagem aparecerá aqui')`, 'A URL vazia não retornou ao placeholder.');
  assert.equal(await executarExpressao(cliente, preencherUrl('https://127.0.0.1:9/imagem-inacessivel.png')), true);
  await aguardarCondicao(cliente, `document.querySelector('.imagem-vazia-previa')?.textContent.includes('Não foi possível carregar esta imagem')`, 'A URL inacessível não exibiu o aviso amigável.');

  assert.equal(await executarExpressao(cliente, alterarModo('dispositivo')), true);
  await aguardarCondicao(cliente, `document.querySelector('.imagem-vazia-previa')?.textContent.includes('Sua imagem aparecerá aqui')`, 'A troca para dispositivo manteve a URL anterior.');
  assert.equal(await executarExpressao(cliente, selecionarArquivo), true);
  await validarImagem(cliente, 'blob:');
  assert.equal(await executarExpressao(cliente, removerArquivo), true);
  await aguardarCondicao(cliente, `document.querySelector('.imagem-vazia-previa')?.textContent.includes('Sua imagem aparecerá aqui')`, 'A remoção manteve a imagem local anterior.');

  await cliente.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await executarExpressao(cliente, selecionarArquivo), true);
  await validarImagem(cliente, 'blob:');
  const larguraMobile = await executarExpressao(cliente, `Math.round(document.querySelector('.previa-modelo-mensagem').getBoundingClientRect().width)`);
  const larguraConstrutor = await executarExpressao(cliente, `Math.round(document.querySelector('.construtor-botoes-modelo').getBoundingClientRect().width)`);
  assert.equal(larguraConstrutor <= 390, true, 'O construtor de botoes ultrapassou a largura da tela movel.');
  assert.equal(larguraMobile <= 390, true, 'A prévia ultrapassou a largura da tela móvel.');

  await cliente.enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  assert.equal(await executarExpressao(cliente, `(() => { const botao = Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === 'Configurar imagem'); if (!botao) return false; botao.click(); return true; })()`), true);
  assert.equal(await executarExpressao(cliente, alterarModo('internet')), true);
  assert.equal(await executarExpressao(cliente, preencherUrl('https://example.com/imagem-salva.jpg')), true);
  assert.equal(await executarExpressao(cliente, `(() => { const card = Array.from(document.querySelectorAll('.botao-oficial-modelo')).find(item => item.textContent.includes('SAIR')); const campo = card && card.querySelector('input[type="checkbox"]'); if (!campo) return false; campo.click(); return campo.checked; })()`), true);
  assert.equal(await executarExpressao(cliente, `(() => { const botao = Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === 'Salvar informações de envio'); if (!botao) return false; botao.click(); return true; })()`), true);
  await aguardarCondicao(cliente, `window.__requisicoesQa.some(item => item.metodo === 'PUT' && item.url.includes('/templates/9001/configuracao-envio'))`, 'O frontend não enviou a configuração por URL.');
  let ultimoPayload = await executarExpressao(cliente, `JSON.parse(window.__requisicoesQa.filter(item => item.metodo === 'PUT').at(-1).corpo)`);
  assert.deepEqual(ultimoPayload, {
    configuracaoEnvio: { corpo: [{ origem: 'nome_contato' }], botoes: [{ indice: 1, subtipo: 'quick_reply', origem: 'opt_out' }], cabecalho: { tipo: 'imagem', origem: 'link', valor: 'https://example.com/imagem-salva.jpg' } },
    removerImagem: false
  });
  await aguardarCondicao(cliente, `Array.from(document.querySelectorAll('button')).some(item => item.textContent.trim() === 'Definir informações de envio')`, 'A lista não foi recarregada após salvar a URL.');
  await executarExpressao(cliente, `Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === 'Definir informações de envio').click()`);
  await aguardarCondicao(cliente, `document.querySelector('input[type="url"][placeholder="https://..."]')?.value === 'https://example.com/imagem-salva.jpg'`, 'A URL não reapareceu ao reabrir a edição.');

  assert.equal(await executarExpressao(cliente, alterarModo('dispositivo')), true);
  assert.equal(await executarExpressao(cliente, selecionarArquivo), true);
  await executarExpressao(cliente, `Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === 'Salvar informações de envio').click()`);
  await aguardarCondicao(cliente, `window.__requisicoesQa.filter(item => item.metodo === 'PUT').length >= 2`, 'O frontend não enviou a configuração por Media ID.');
  ultimoPayload = await executarExpressao(cliente, `JSON.parse(window.__requisicoesQa.filter(item => item.metodo === 'PUT').at(-1).corpo)`);
  assert.equal(ultimoPayload.configuracaoEnvio.cabecalho.origem, 'id');
  assert.equal(ultimoPayload.configuracaoEnvio.cabecalho.valor, 'media-id-browser-qa');
  await aguardarCondicao(cliente, `Array.from(document.querySelectorAll('button')).some(item => item.textContent.trim() === 'Definir informações de envio')`, 'A lista não foi recarregada após salvar o Media ID.');
  await executarExpressao(cliente, `Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === 'Definir informações de envio').click()`);
  await aguardarCondicao(cliente, `document.querySelector('.imagem-vazia-previa')?.textContent.includes('Imagem configurada para envio')`, 'O Media ID salvo não foi reconhecido ao reabrir.');

  assert.equal(await executarExpressao(cliente, `(() => { const botao = Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === 'Remover imagem'); if (!botao) return false; botao.click(); return true; })()`), true);
  await executarExpressao(cliente, `Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === 'Salvar informações de envio').click()`);
  await aguardarCondicao(cliente, `window.__requisicoesQa.filter(item => item.metodo === 'PUT').length >= 3`, 'O frontend não enviou a remoção intencional.');
  ultimoPayload = await executarExpressao(cliente, `JSON.parse(window.__requisicoesQa.filter(item => item.metodo === 'PUT').at(-1).corpo)`);
  assert.equal(ultimoPayload.removerImagem, true);
  assert.equal(Object.hasOwn(ultimoPayload.configuracaoEnvio, 'cabecalho'), false);

  console.log('Prévia e edição renderizadas: personalização assistida, imagem, persistência por URL/ID, reabertura, remoção, desktop e celular aprovados.');
} finally {
  if (cliente) cliente.fechar();
  if (navegador) {
    navegador.kill();
    await Promise.race([
      new Promise(function (resolver) { navegador.once('exit', resolver); }),
      aguardar(3000)
    ]);
  }
  if (servidor) await new Promise(function (resolver) { servidor.close(resolver); });
  if (diretorioTemporario) {
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      try {
        fs.rmSync(diretorioTemporario, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        break;
      } catch (erro) {
        if (tentativa === 4) throw erro;
        await aguardar(250);
      }
    }
  }
}
