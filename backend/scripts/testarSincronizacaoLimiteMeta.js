require('dotenv').config({ quiet: true });

process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso-nao-real';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321';
process.env.META_GRAPH_API_VERSION = 'v99.0';
process.env.META_REQUISICAO_TIMEOUT_MS = '20';

const banco = require('../src/config/banco');
const autorizarAdministrador = require('../src/middlewares/autorizarAdministrador');
const campanhaModel = require('../src/modules/campanhas/campanhaModel');
const limiteMetaService = require('../src/modules/campanhas/limiteMetaService');
const metaProvider = require('../src/modules/mensageria/metaCloudApiProvider');

let verificacoes = 0;

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
  verificacoes += 1;
}

function respostaMeta(status, corpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async function () { return corpo; }
  };
}

async function confirmarRejeicao(promessa, trecho) {
  try {
    await promessa;
  } catch (erro) {
    confirmar(
      erro.message.toLowerCase().includes(trecho.toLowerCase()),
      'Erro inesperado: ' + erro.message
    );
    return erro;
  }
  throw new Error('A operacao deveria ter sido recusada.');
}

async function executar() {
  const usuario = (await banco.query(
    "SELECT id, perfil FROM usuarios WHERE perfil = 'administrador' AND ativo = TRUE ORDER BY id LIMIT 1"
  )).rows[0];
  confirmar(Boolean(usuario), 'E necessario um administrador ativo para o teste.');

  const limiteOriginal = (await banco.query(
    "SELECT valor_inteiro FROM configuracoes_sistema WHERE chave = 'limite_mensagens_24h'"
  )).rows[0].valor_inteiro;
  const ultimoId = (await banco.query(
    'SELECT COALESCE(MAX(id), 0)::bigint AS id FROM sincronizacoes_limite_meta'
  )).rows[0].id;

  try {
    await banco.query(
      "UPDATE configuracoes_sistema SET valor_inteiro = 100000 WHERE chave = 'limite_mensagens_24h'"
    );

    metaProvider.definirFetchParaTeste(async function (url, opcoes) {
      confirmar(opcoes.method === 'GET', 'A consulta do limite deve usar GET.');
      confirmar(
        url.includes('/v99.0/123456789?fields=whatsapp_business_manager_messaging_limit'),
        'Campo oficial atual da Meta nao foi consultado.'
      );
      confirmar(
        opcoes.headers.Authorization === 'Bearer token-falso-nao-real',
        'A consulta nao utilizou a credencial configurada.'
      );
      return respostaMeta(200, { whatsapp_business_manager_messaging_limit: 'TIER_2K' });
    });
    let capacidade = await limiteMetaService.sincronizarPorApi(usuario);
    confirmar(
      capacidade.limiteMeta === 2000 && capacidade.limite === 2000,
      'O aumento oficial deve respeitar o menor limite efetivo.'
    );

    metaProvider.definirFetchParaTeste(async function () {
      return respostaMeta(200, { whatsapp_business_manager_messaging_limit: 'TIER_250' });
    });
    capacidade = await limiteMetaService.sincronizarPorApi(usuario);
    confirmar(
      capacidade.limiteMeta === 250 && capacidade.limite === 250,
      'A reducao oficial deve diminuir a capacidade efetiva.'
    );

    metaProvider.definirFetchParaTeste(async function () {
      return respostaMeta(200, { whatsapp_business_manager_messaging_limit: 'TIER_DESCONHECIDO' });
    });
    await confirmarRejeicao(limiteMetaService.sincronizarPorApi(usuario), 'limite oficial desconhecido');
    capacidade = await campanhaModel.obterCapacidade(new Date());
    confirmar(capacidade.limite === 250, 'Resposta invalida nao pode liberar capacidade.');

    metaProvider.definirFetchParaTeste(async function () {
      return respostaMeta(401, { error: { code: 190, message: 'token invalido' } });
    });
    await confirmarRejeicao(limiteMetaService.sincronizarPorApi(usuario), 'capacidade segura anterior');
    capacidade = await campanhaModel.obterCapacidade(new Date());
    confirmar(capacidade.limite === 250, 'Token invalido nao pode liberar capacidade.');

    metaProvider.definirFetchParaTeste(function (url, opcoes) {
      return new Promise(function (resolve, reject) {
        opcoes.signal.addEventListener('abort', function () {
          const erro = new Error('abortado');
          erro.name = 'AbortError';
          reject(erro);
        });
      });
    });
    await confirmarRejeicao(limiteMetaService.sincronizarPorApi(usuario), 'capacidade segura anterior');
    capacidade = await campanhaModel.obterCapacidade(new Date());
    confirmar(capacidade.limite === 250, 'Timeout nao pode liberar capacidade.');

    metaProvider.definirFetchParaTeste(async function () { throw new Error('indisponivel'); });
    await confirmarRejeicao(limiteMetaService.sincronizarPorApi(usuario), 'capacidade segura anterior');
    capacidade = await campanhaModel.obterCapacidade(new Date());
    confirmar(capacidade.limite === 250, 'Indisponibilidade nao pode liberar capacidade.');

    const webhookAtualizado = await limiteMetaService.registrarLimiteDoWebhook('TIER_2K');
    confirmar(webhookAtualizado === true, 'Webhook oficial valido deve ser aceito.');
    const webhookReducao = await limiteMetaService.registrarLimiteDoWebhook(250);
    confirmar(webhookReducao === true, 'Reducao numerica do webhook deve ser aceita.');
    capacidade = await campanhaModel.obterCapacidade(new Date());
    confirmar(capacidade.limite === 250, 'Reducao recebida por webhook deve valer para novas operacoes.');
    const webhookInvalido = await limiteMetaService.registrarLimiteDoWebhook({});
    confirmar(webhookInvalido === false, 'Webhook com limite invalido deve ser ignorado com seguranca.');

    let erroPermissao;
    autorizarAdministrador(
      { usuario: { id: 999, perfil: 'operador' } },
      {},
      function (erro) { erroPermissao = erro; }
    );
    confirmar(erroPermissao && erroPermissao.statusHttp === 403, 'Operador nao pode sincronizar nem alterar o limite.');

    const auditoria = (await banco.query(
      'SELECT status, origem, usuario_id FROM sincronizacoes_limite_meta WHERE id > $1 ORDER BY id',
      [ultimoId]
    )).rows;
    confirmar(
      auditoria.some(function (item) { return item.status === 'sucesso' && item.origem === 'consulta_api' && Number(item.usuario_id) === Number(usuario.id); }),
      'Sincronizacao administrativa deve ser auditada.'
    );
    confirmar(
      auditoria.some(function (item) { return item.status === 'falha'; }),
      'Falhas de sincronizacao devem ser auditadas sem dados sensiveis.'
    );

    console.log('Sincronizacao segura do limite Meta: ' + verificacoes + ' verificacoes aprovadas.');
  } finally {
    metaProvider.definirFetchParaTeste();
    await banco.query(
      "UPDATE configuracoes_sistema SET valor_inteiro = $1 WHERE chave = 'limite_mensagens_24h'",
      [limiteOriginal]
    );
    await banco.query('DELETE FROM sincronizacoes_limite_meta WHERE id > $1', [ultimoId]);
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
