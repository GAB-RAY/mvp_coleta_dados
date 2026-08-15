require('dotenv').config({ quiet: true });

process.env.JWT_SECRET = 'segredo-jwt-qa-persistencia-imagem-template-123456';
process.env.WHATSAPP_ACCESS_TOKEN = 'token-falso-persistencia-imagem';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321';
process.env.META_GRAPH_API_VERSION = 'v99.0';

const aplicacao = require('../src/app');
const banco = require('../src/config/banco');
const mensageriaService = require('../src/modules/mensageria/mensageriaService');
const templateService = require('../src/modules/campanhas/templateMetaService');

const ID_META = '999300001';
const componentesOficiais = [
  { type: 'HEADER', format: 'IMAGE' },
  { type: 'BODY', text: 'Convite oficial com imagem.' },
  { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Confirmar presença' }] }
];
let verificacoes = 0;

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
  verificacoes += 1;
}

function respostaJson(status, dados) {
  return { ok: status >= 200 && status < 300, status, json: async function () { return dados; } };
}

function definirMetaFake() {
  mensageriaService.definirProviderParaTeste(async function (url) {
    if (url.includes('/message_templates')) {
      return respostaJson(200, { data: [{
        id: ID_META,
        name: 'template_persistencia_imagem_qa',
        language: 'pt_BR',
        status: 'APPROVED',
        category: 'MARKETING',
        components: componentesOficiais
      }] });
    }
    if (url.includes('/media')) return respostaJson(200, { id: 'media-id-persistido-qa' });
    throw new Error('O teste tentou acessar um endpoint Meta nao previsto: ' + url);
  });
}

async function iniciarApi() {
  return new Promise(function (resolver) {
    const servidor = aplicacao.listen(0, '127.0.0.1', function () { resolver(servidor); });
  });
}

async function requisitar(servidor, caminho, opcoes) {
  const endereco = servidor.address();
  return fetch('http://127.0.0.1:' + endereco.port + caminho, opcoes);
}

async function lerJson(resposta) {
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error('HTTP ' + resposta.status + ': ' + (dados.mensagem || JSON.stringify(dados)));
  return dados;
}

async function salvarConfiguracao(servidor, token, templateId, configuracaoEnvio, removerImagem) {
  const resposta = await requisitar(servidor,
    '/api/admin/campanhas/templates/' + templateId + '/configuracao-envio', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ configuracaoEnvio, removerImagem: removerImagem === true })
    });
  return { resposta, dados: await lerJson(resposta) };
}

async function listarPelaApi(servidor, token) {
  const resposta = await requisitar(servidor, '/api/admin/campanhas/templates', {
    headers: { Authorization: 'Bearer ' + token }
  });
  return (await lerJson(resposta)).templates;
}

async function executar() {
  let servidor;
  let templateId;
  let rascunhoId;
  try {
    definirMetaFake();
    const usuario = (await banco.query(
      "SELECT * FROM usuarios WHERE ativo=TRUE AND perfil='administrador' ORDER BY id LIMIT 1"
    )).rows[0];
    confirmar(Boolean(usuario), 'Administrador QA nao encontrado.');

    const sincronizacaoInicial = await templateService.sincronizar(usuario);
    confirmar(sincronizacaoInicial.criados === 1, 'O template externo nao foi sincronizado.');
    const externo = (await banco.query(
      'SELECT * FROM modelos_mensagem WHERE meta_template_id=$1', [ID_META]
    )).rows[0];
    templateId = externo.id;
    confirmar(externo.meta_origem === 'meta' && externo.meta_status_oficial === 'APPROVED',
      'Origem externa ou aprovacao oficial incorreta.');

    servidor = await iniciarApi();
    const loginResposta = await requisitar(servidor, '/api/autenticacao/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'qa.campanhas@invalid.local', senha: 'SenhaQACampanhas123!' })
    });
    const login = await lerJson(loginResposta);
    confirmar(Boolean(login.token), 'Login QA nao retornou token.');

    const configuracaoLink = {
      cabecalho: { tipo: 'imagem', origem: 'link', valor: 'https://example.com/imagem-persistida.jpg' },
      corpo: [], botoes: []
    };
    const linkSalvo = await salvarConfiguracao(servidor, login.token, templateId, configuracaoLink, false);
    confirmar(linkSalvo.resposta.status === 200 &&
      linkSalvo.dados.template.meta_configuracao_envio.cabecalho.origem === 'link',
    'A rota real nao persistiu image.link.');
    let reaberto = (await listarPelaApi(servidor, login.token)).find(function (item) { return item.id === templateId; });
    confirmar(reaberto.meta_configuracao_envio.cabecalho.valor === configuracaoLink.cabecalho.valor,
      'A nova leitura nao devolveu image.link.');

    definirMetaFake();
    await templateService.sincronizar(usuario);
    reaberto = (await listarPelaApi(servidor, login.token)).find(function (item) { return item.id === templateId; });
    confirmar(reaberto.meta_configuracao_envio.cabecalho.valor === configuracaoLink.cabecalho.valor &&
      reaberto.meta_status_oficial === 'APPROVED' && reaberto.meta_origem === 'meta',
    'A sincronizacao apagou a configuracao local ou alterou o status oficial.');

    definirMetaFake();
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fea73581840000000049454e44ae426082', 'hex');
    const formulario = new FormData();
    formulario.append('imagem', new Blob([png], { type: 'image/png' }), 'imagem-qa.png');
    const uploadResposta = await requisitar(servidor, '/api/admin/campanhas/templates/imagem-envio', {
      method: 'POST', headers: { Authorization: 'Bearer ' + login.token }, body: formulario
    });
    const upload = await lerJson(uploadResposta);
    confirmar(upload.imagem.id === 'media-id-persistido-qa',
      'O upload oficial fake nao retornou o Media ID esperado.');
    const configuracaoId = {
      cabecalho: { tipo: 'imagem', origem: 'id', valor: upload.imagem.id },
      corpo: [], botoes: []
    };
    await salvarConfiguracao(servidor, login.token, templateId, configuracaoId, false);
    reaberto = (await listarPelaApi(servidor, login.token)).find(function (item) { return item.id === templateId; });
    confirmar(reaberto.meta_configuracao_envio.cabecalho.origem === 'id' &&
      reaberto.meta_configuracao_envio.cabecalho.valor === 'media-id-persistido-qa',
    'A nova leitura nao devolveu image.id.');

    await salvarConfiguracao(servidor, login.token, templateId, configuracaoLink, false);
    reaberto = (await listarPelaApi(servidor, login.token)).find(function (item) { return item.id === templateId; });
    confirmar(reaberto.meta_configuracao_envio.cabecalho.origem === 'link',
      'A troca dispositivo para URL nao persistiu.');
    await salvarConfiguracao(servidor, login.token, templateId, configuracaoId, false);
    reaberto = (await listarPelaApi(servidor, login.token)).find(function (item) { return item.id === templateId; });
    confirmar(reaberto.meta_configuracao_envio.cabecalho.origem === 'id',
      'A troca URL para dispositivo nao persistiu.');

    await salvarConfiguracao(servidor, login.token, templateId, { corpo: [], botoes: [] }, true);
    reaberto = (await listarPelaApi(servidor, login.token)).find(function (item) { return item.id === templateId; });
    confirmar(reaberto.meta_configuracao_envio.cabecalho === null,
      'A remocao intencional nao apagou somente a imagem de envio.');
    confirmar(reaberto.meta_status_oficial === 'APPROVED' && reaberto.meta_origem === 'meta',
      'Remover a configuracao alterou o template oficial.');

    const dadosRascunho = {
      nome: 'Rascunho imagem QA', categoria: 'Geral', conteudo: 'Ola, {{1}}!', ativo: true,
      metaNome: 'rascunho_imagem_qa', metaIdioma: 'pt_BR', metaCategoria: 'MARKETING',
      componentes: [
        { type: 'HEADER', format: 'IMAGE', handleExemplo: 'handle-exemplo-qa' },
        { type: 'BODY', text: 'Ola, {{1}}!', exemplos: ['Joao'] }
      ],
      configuracaoEnvio: {
        cabecalho: { tipo: 'imagem', origem: 'id', valor: 'media-rascunho-qa' },
        corpo: [{ origem: 'nome_contato' }], botoes: []
      }
    };
    const rascunho = await templateService.salvarRascunho(null, dadosRascunho, usuario);
    rascunhoId = rascunho.id;
    dadosRascunho.nome = 'Rascunho imagem QA editado';
    const rascunhoEditado = await templateService.salvarRascunho(rascunho.id, dadosRascunho, usuario);
    confirmar(rascunhoEditado.nome.endsWith('editado') &&
      rascunhoEditado.meta_configuracao_envio.cabecalho.valor === 'media-rascunho-qa',
    'Editar outro campo do rascunho apagou a imagem configurada.');

    const historicos = Number((await banco.query(
      "SELECT COUNT(*) AS total FROM historico_modelos_mensagem_meta WHERE modelo_id=$1 AND acao='configuracao_envio'",
      [templateId]
    )).rows[0].total);
    confirmar(historicos === 5, 'O historico nao registrou todas as alteracoes atomicas da configuracao.');

    console.log('Persistencia da imagem do template: ' + verificacoes + ' verificacoes aprovadas.');
  } finally {
    if (servidor) await new Promise(function (resolver) { servidor.close(resolver); });
    mensageriaService.definirProviderParaTeste();
    const ids = [templateId, rascunhoId].filter(Boolean);
    if (ids.length) {
      await banco.query('DELETE FROM historico_modelos_mensagem_meta WHERE modelo_id=ANY($1::bigint[])', [ids]);
      await banco.query('DELETE FROM modelos_mensagem WHERE id=ANY($1::bigint[])', [ids]);
    }
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
