require('dotenv').config({ quiet: true });

const TOKEN_TESTE = 'TOKEN_SUPER_SECRETO_QA_987654';
process.env.WHATSAPP_ACCESS_TOKEN = TOKEN_TESTE;
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321';
process.env.META_GRAPH_API_VERSION = 'v99.0';

const provider = require('../src/modules/mensageria/metaCloudApiProvider');

let verificacoes = 0;

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
  verificacoes += 1;
}

function comandoValido() {
  return {
    telefone: '5521999999999',
    templateNome: 'template_log_qa',
    templateIdioma: 'pt_BR',
    templateOrigem: 'meta',
    templateStatusOficial: 'APPROVED',
    templateComponentes: [{ type: 'BODY', text: 'Mensagem de teste.' }],
    templateConfiguracaoEnvio: {}
  };
}

async function executar() {
  const consoleErrorOriginal = console.error;
  const logs = [];
  console.error = function () {
    logs.push(Array.from(arguments).join(' '));
  };
  try {
    provider.definirFetchParaTeste(async function () {
      return {
        ok: false,
        status: 400,
        json: async function () {
          return {
            error: {
              message: 'Parâmetro inválido. Authorization: Bearer ' + TOKEN_TESTE,
              type: 'OAuthException',
              code: 132000,
              error_subcode: 2494010,
              error_data: {
                messaging_product: 'whatsapp',
                details: 'detalhe de exemplo ' + TOKEN_TESTE +
                  ' para 5521999999999 e pessoa@exemplo.invalid'
              },
              fbtrace_id: 'TESTE123'
            }
          };
        }
      };
    });

    let erroRecebido;
    try { await provider.enviarTemplate(comandoValido()); }
    catch (erro) { erroRecebido = erro; }
    confirmar(erroRecebido && erroRecebido.message === 'A Meta recusou a operação solicitada.',
      'A mensagem amigável para o usuário foi alterada ou recebeu detalhe técnico.');
    confirmar(logs.length === 1, 'A resposta de erro da Meta deveria gerar um único log técnico.');

    const registro = JSON.parse(logs[0]);
    confirmar(registro.evento === 'erro_meta_cloud_api' && registro.statusMeta === 400,
      'O log não identificou o evento e o status HTTP da Meta.');
    confirmar(registro.codigoMeta === 132000 && registro.subcodigoMeta === 2494010,
      'O log não preservou código e subcódigo da Meta.');
    confirmar(registro.tipoMeta === 'OAuthException' && registro.produtoMeta === 'whatsapp',
      'O log não preservou tipo e produto da Meta.');
    confirmar(registro.detalhesMeta.includes('detalhe de exemplo') &&
      registro.fbtraceId === 'TESTE123',
    'O log não preservou details e fbtrace_id.');
    confirmar(!logs[0].includes(TOKEN_TESTE) && !/authorization/i.test(logs[0]) &&
      !/bearer/i.test(logs[0]),
    'O log técnico expôs token, Authorization ou Bearer.');
    confirmar(!logs[0].includes('5521999999999') &&
      !logs[0].includes('pessoa@exemplo.invalid'),
    'O log técnico expôs telefone ou e-mail retornado no detalhe da Meta.');

    const quantidadeAntesDaValidacaoLocal = logs.length;
    const comandoInvalido = comandoValido();
    comandoInvalido.templateStatusOficial = 'PENDING';
    try { await provider.enviarTemplate(comandoInvalido); }
    catch (erro) {}
    confirmar(logs.length === quantidadeAntesDaValidacaoLocal,
      'Uma validação local foi registrada indevidamente como erro da Meta.');

    consoleErrorOriginal('Log seguro de erro Meta: ' + verificacoes + ' verificações aprovadas.');
  } finally {
    provider.definirFetchParaTeste();
    console.error = consoleErrorOriginal;
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
