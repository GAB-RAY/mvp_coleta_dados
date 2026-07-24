require('dotenv').config({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.API_LIMITE_MAXIMO = '1000';
process.env.PUBLICO_LIMITE_MAXIMO = '2';
process.env.PUBLICO_LIMITE_JANELA_MS = '60000';
process.env.API_REQUISICOES_CONCORRENTES = '10';

const EventEmitter = require('events');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');
const validarAmbiente = require('../src/config/validarAmbiente');
const criarLimitadorConcorrencia = require('../src/middlewares/limitarConcorrencia');

let verificacoes = 0;

function verificar(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }

  verificacoes += 1;
}

function criarRespostaFalsa() {
  const resposta = new EventEmitter();
  resposta.cabecalhos = {};
  resposta.setHeader = function (nome, valor) {
    resposta.cabecalhos[nome] = valor;
  };
  return resposta;
}

function testarConcorrencia() {
  const limitador = criarLimitadorConcorrencia();
  const respostas = [];
  const erros = [];
  let indice;

  for (indice = 0; indice < 10; indice += 1) {
    const resposta = criarRespostaFalsa();
    respostas.push(resposta);
    limitador({ path: '/api/teste-carga' }, resposta, function (erro) {
      erros.push(erro || null);
    });
  }

  verificar(erros.every(function (erro) { return erro === null; }), 'O limite bloqueou cedo demais.');

  const respostaExcedente = criarRespostaFalsa();
  let erroExcedente;
  limitador({ path: '/api/teste-carga' }, respostaExcedente, function (erro) {
    erroExcedente = erro;
  });
  verificar(erroExcedente && erroExcedente.statusHttp === 503, 'O excesso de concorrência não retornou 503.');
  verificar(respostaExcedente.cabecalhos['Retry-After'] === '2', 'Retry-After não foi informado.');

  respostas.forEach(function (resposta) {
    resposta.emit('finish');
  });

  const respostaLiberada = criarRespostaFalsa();
  let erroDepoisDaLiberacao = null;
  limitador({ path: '/api/teste-carga' }, respostaLiberada, function (erro) {
    erroDepoisDaLiberacao = erro || null;
  });
  verificar(erroDepoisDaLiberacao === null, 'A concorrência não foi liberada ao finalizar respostas.');
  respostaLiberada.emit('finish');
}

function testarAmbienteProducao() {
  const nomes = [
    'NODE_ENV',
    'JWT_SECRET',
    'JWT_TEMPO_EXPIRACAO',
    'FRONTEND_URL',
    'DATABASE_URL'
  ];
  const valoresAnteriores = {};

  nomes.forEach(function (nome) {
    valoresAnteriores[nome] = process.env[nome];
  });

  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'curto';
  process.env.JWT_TEMPO_EXPIRACAO = '8h';
  process.env.FRONTEND_URL = 'https://exemplo.com';
  process.env.DATABASE_URL = 'postgresql://usuario:senha@banco.exemplo.com:5432/banco?sslmode=require';

  let recusouSegredoCurto = false;
  try {
    validarAmbiente();
  } catch (erro) {
    recusouSegredoCurto = erro.message.includes('32 bytes');
  }
  verificar(recusouSegredoCurto, 'Produção aceitou JWT_SECRET curto.');

  process.env.JWT_SECRET = 'segredo-com-mais-de-trinta-e-dois-caracteres';
  let ambienteValido = true;
  try {
    validarAmbiente();
  } catch (erro) {
    ambienteValido = false;
  }
  verificar(ambienteValido, 'Uma configuração segura de produção foi recusada.');

  nomes.forEach(function (nome) {
    if (valoresAnteriores[nome] === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valoresAnteriores[nome];
    }
  });
}

async function enviarJson(url, texto) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: texto
  });
}

async function executar() {
  const servidor = aplicacao.listen(0);
  await new Promise(function (resolver) { servidor.once('listening', resolver); });
  const endereco = servidor.address();
  const base = 'http://127.0.0.1:' + endereco.port;

  try {
    const vivo = await fetch(base + '/api/saude/vivo');
    const dadosVivo = await vivo.json();
    verificar(vivo.status === 200, 'A rota de vida não retornou 200.');
    verificar(dadosVivo.mensagem === 'Aplicação em execução.', 'A resposta de vida é inválida.');
    verificar(Boolean(vivo.headers.get('x-request-id')), 'A resposta não possui X-Request-Id.');
    verificar(vivo.headers.get('x-content-type-options') === 'nosniff', 'Helmet não aplicou nosniff.');

    const pronto = await fetch(base + '/api/saude/pronto');
    verificar(pronto.status === 200, 'A rota de prontidão não confirmou o PostgreSQL.');

    const jsonInvalido = await enviarJson(base + '/api/autenticacao/login', '{');
    const dadosJsonInvalido = await jsonInvalido.json();
    verificar(jsonInvalido.status === 400, 'JSON inválido não retornou 400.');
    verificar(dadosJsonInvalido.mensagem === 'O JSON enviado é inválido.', 'A mensagem de JSON inválido divergiu.');

    const corpoGrande = JSON.stringify({ email: 'a'.repeat(40000), senha: 'senha' });
    const respostaGrande = await enviarJson(base + '/api/autenticacao/login', corpoGrande);
    verificar(respostaGrande.status === 413, 'Corpo maior que 32 KB não retornou 413.');

    const cadastroInvalido = JSON.stringify({ telefone: '(21) 99999-8765' });
    const primeiraTentativa = await enviarJson(base + '/api/publico/contatos', cadastroInvalido);
    const segundaTentativa = await enviarJson(base + '/api/publico/contatos', cadastroInvalido);
    const terceiraTentativa = await enviarJson(base + '/api/publico/contatos', cadastroInvalido);
    verificar(primeiraTentativa.status === 400, 'A primeira tentativa inválida não chegou à validação.');
    verificar(segundaTentativa.status === 400, 'A segunda tentativa inválida não chegou à validação.');
    verificar(terceiraTentativa.status === 429, 'O limite público não retornou 429.');

    const opcoes = await fetch(base + '/api/publico/contatos/opcoes');
    const dadosOpcoes = await opcoes.json();
    verificar(opcoes.status === 200, 'As opções públicas não foram carregadas.');
    verificar(
      String(opcoes.headers.get('cache-control')).includes('max-age=30'),
      'As opções públicas não possuem cache curto.'
    );
    verificar(Array.isArray(dadosOpcoes.bairros) && dadosOpcoes.bairros.length === 166, 'O cache não retornou os 166 bairros.');

    verificar(banco.options.max === 5, 'O pool PostgreSQL não usa o limite padrão de 5 conexões.');
    verificar(
      banco.options.connectionTimeoutMillis === 5000,
      'O pool PostgreSQL não possui tempo limite de conexão.'
    );

    testarConcorrencia();
    testarAmbienteProducao();

    console.log('Resiliência validada: ' + verificacoes + ' verificações aprovadas.');
  } finally {
    await new Promise(function (resolver) { servidor.close(resolver); });
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro);
  process.exitCode = 1;
});
