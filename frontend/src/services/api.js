import { obterToken } from '../utils/armazenamentoToken';

const MENSAGEM_FALHA_CONEXAO =
  'Não foi possível conectar ao servidor. Tente novamente em alguns instantes.';
const ATRASOS_NOVA_TENTATIVA = [400, 1200, 3000];

function obterUrlBase() {
  const urlConfigurada = import.meta.env.VITE_API_URL;

  if (!urlConfigurada) {
    throw new Error('A URL da API não está configurada.');
  }

  return urlConfigurada.replace(/\/+$/, '');
}

function prepararConfiguracao(opcoesRecebidas) {
  const opcoes = opcoesRecebidas || {};
  const configuracao = Object.assign({}, opcoes);
  const autenticado = configuracao.autenticado === true;
  const cabecalhos = new Headers(configuracao.headers || {});

  delete configuracao.autenticado;

  const corpoEhFormulario = typeof FormData !== 'undefined' &&
    configuracao.body instanceof FormData;

  if (configuracao.body && !corpoEhFormulario && !cabecalhos.has('Content-Type')) {
    cabecalhos.set('Content-Type', 'application/json');
  }

  if (autenticado) {
    const token = obterToken();

    if (token) {
      cabecalhos.set('Authorization', 'Bearer ' + token);
    }
  }

  configuracao.headers = cabecalhos;

  return configuracao;
}

async function lerRespostaJson(resposta) {
  const textoResposta = await resposta.text();

  if (!textoResposta) {
    return null;
  }

  try {
    return JSON.parse(textoResposta);
  } catch (erro) {
    return null;
  }
}

function aguardar(tempoMs, sinal) {
  return new Promise(function (resolver, rejeitar) {
    if (sinal && sinal.aborted) {
      rejeitar(new DOMException('Operação cancelada.', 'AbortError'));
      return;
    }

    const temporizador = setTimeout(function () {
      if (sinal) {
        sinal.removeEventListener('abort', cancelar);
      }
      resolver();
    }, tempoMs);

    function cancelar() {
      clearTimeout(temporizador);
      rejeitar(new DOMException('Operação cancelada.', 'AbortError'));
    }

    if (sinal) {
      sinal.addEventListener('abort', cancelar, { once: true });
    }
  });
}

function podeRepetir(configuracao, erro, tentativa) {
  const metodo = String(configuracao.method || 'GET').toUpperCase();
  const estadosTemporarios = [0, 502, 503, 504];

  return metodo === 'GET' &&
    erro.name !== 'AbortError' &&
    estadosTemporarios.includes(erro.statusHttp) &&
    tentativa < ATRASOS_NOVA_TENTATIVA.length;
}

async function executarRequisicao(url, configuracao) {
  let resposta;

  try {
    resposta = await fetch(url, configuracao);
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw erro;
    }

    const erroConexao = new Error(MENSAGEM_FALHA_CONEXAO);
    erroConexao.statusHttp = 0;
    throw erroConexao;
  }

  const dados = await lerRespostaJson(resposta);

  if (!resposta.ok) {
    const mensagem = dados && dados.mensagem
      ? dados.mensagem
      : 'Não foi possível concluir a solicitação.';
    const erroResposta = new Error(mensagem);
    erroResposta.statusHttp = resposta.status;
    throw erroResposta;
  }

  return dados;
}

async function requisitar(caminho, opcoes) {
  const url = obterUrlBase() + caminho;
  const configuracao = prepararConfiguracao(opcoes);
  let tentativa = 0;

  while (true) {
    try {
      return await executarRequisicao(url, configuracao);
    } catch (erro) {
      if (!podeRepetir(configuracao, erro, tentativa)) {
        throw erro;
      }

      await aguardar(ATRASOS_NOVA_TENTATIVA[tentativa], configuracao.signal);
      tentativa += 1;
    }
  }
}

export default requisitar;
