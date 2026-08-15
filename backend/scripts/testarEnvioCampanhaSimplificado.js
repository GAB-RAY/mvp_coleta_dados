require('dotenv').config({ quiet: true });

const http = require('http');
const banco = require('../src/config/banco');
const aplicacao = require('../src/app');
const campanhaService = require('../src/modules/campanhas/campanhaService');
const mensageriaService = require('../src/modules/mensageria/mensageriaService');

let verificacoes = 0;

function confirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
  verificacoes += 1;
}

function telefone(indice) {
  return '552197' + String(100000 + indice).padStart(6, '0');
}

async function inserirContatos(marca, quantidade, bairro, origemId, deslocamento) {
  const nomes = [];
  const telefones = [];
  let indice;
  for (indice = 0; indice < quantidade; indice += 1) {
    nomes.push(marca + ' CONTATO ' + indice);
    telefones.push(telefone(deslocamento + indice));
  }
  return (await banco.query(`
    INSERT INTO contatos (
      nome, telefone, telefone_normalizado, bairro, problema, idade, origem_id,
      consentimento_armazenamento, status_contato
    )
    SELECT nome, numero, numero, $3, 'Saude', 30, $4, TRUE, 'ativo'
    FROM UNNEST($1::text[], $2::text[]) AS dados(nome, numero)
    RETURNING id
  `, [nomes, telefones, bairro, origemId])).rows;
}

async function criarCampanha(nome, modeloId, usuario) {
  const criada = await campanhaService.criar({
    nome,
    finalidade: 'Validacao do envio simplificado.',
    modeloId,
    filtros: { nome }
  }, usuario);
  return campanhaService.alterarStatus(criada.id, 'pronta', usuario);
}

async function enviarTodas(tentativas) {
  const tamanhoGrupo = 20;
  let indice;
  for (indice = 0; indice < tentativas.length; indice += tamanhoGrupo) {
    await Promise.all(tentativas.slice(indice, indice + tamanhoGrupo).map(function (tentativaId) {
      return mensageriaService.enviar(tentativaId);
    }));
  }
}

async function contar(campanhaId) {
  return (await banco.query(`
    SELECT
      COUNT(*)::int AS participacoes,
      COUNT(DISTINCT participacao.contato_id)::int AS contatos_unicos,
      COUNT(*) FILTER (WHERE tentativa.status='enviada')::int AS enviadas,
      COUNT(*) FILTER (WHERE tentativa.status='falhou')::int AS falhas
    FROM campanha_participacoes participacao
    INNER JOIN campanha_tentativas tentativa
      ON tentativa.participacao_id=participacao.id
      AND tentativa.numero_tentativa=(
        SELECT MAX(ultima.numero_tentativa)
        FROM campanha_tentativas ultima
        WHERE ultima.participacao_id=participacao.id
      )
    WHERE participacao.campanha_id=$1
  `, [campanhaId])).rows[0];
}

async function iniciarApi() {
  const servidor = http.createServer(aplicacao);
  await new Promise(function (resolver, rejeitar) {
    servidor.once('error', rejeitar);
    servidor.listen(0, '127.0.0.1', resolver);
  });
  return servidor;
}

async function requisitarApi(servidor, caminho, opcoes) {
  const endereco = servidor.address();
  return fetch('http://127.0.0.1:' + endereco.port + caminho, opcoes);
}

async function executar() {
  const bancoTemporario = String(process.env.DATABASE_URL || '').includes('acorda_rj_campanhas_qa_');
  if (process.env.NODE_ENV !== 'test' || !bancoTemporario) {
    throw new Error('O teste exige o banco temporario isolado de campanhas.');
  }

  const marcaBase = 'QA_ENVIO_SIMPLES_' + Date.now();
  const usuario = (await banco.query(`
    SELECT id,nome,email,perfil FROM usuarios
    WHERE perfil='administrador' AND ativo=TRUE ORDER BY id LIMIT 1
  `)).rows[0];
  const origem = (await banco.query('SELECT id FROM origens WHERE ativa=TRUE ORDER BY id LIMIT 1')).rows[0];
  const bairro = (await banco.query('SELECT nome FROM bairros WHERE ativo=TRUE ORDER BY id LIMIT 1')).rows[0];
  confirmar(Boolean(usuario && origem && bairro), 'Fixtures administrativas indisponiveis.');

  const auditoriaSchema = (await banco.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='campanhas'
        AND column_name='atualizado_por_usuario_id'
    ) AS coluna,
    EXISTS (
      SELECT 1 FROM schema_migrations WHERE versao='014'
    ) AS migration
  `)).rows[0];
  confirmar(auditoriaSchema.coluna && auditoriaSchema.migration,
    'A migration 014 e a coluna de auditoria de campanhas devem existir no schema atual.');

  await campanhaService.atualizarLimite({
    valor: 500,
    motivo: marcaBase + ' capacidade simulada'
  }, usuario);
  await banco.query(`
    INSERT INTO sincronizacoes_limite_meta (
      limite_anterior, limite_novo, tier_anterior, tier_novo,
      origem, status, usuario_id
    ) VALUES (500, 500, 'TIER_500', 'TIER_500', 'webhook_meta', 'sucesso', $1)
  `, [usuario.id]);

  const modelo = await campanhaService.salvarTemplate(null, {
    nome: marcaBase + ' MODELO', categoria: 'Geral', ativo: true,
    metaNome: ('qa_envio_simples_' + Date.now()).toLowerCase(),
    metaIdioma: 'pt_BR', metaCategoria: 'MARKETING', conteudo: 'Ola {{1}}',
    componentes: [{ type: 'BODY', text: 'Ola {{1}}', exemplos: ['Pessoa QA'] }],
    configuracaoEnvio: { corpo: [{ origem: 'nome_contato' }], botoes: [] }
  }, usuario);
  await banco.query(`
    UPDATE modelos_mensagem
    SET meta_template_id=$2, meta_status='aprovado',
      meta_status_oficial='APPROVED', meta_origem='meta'
    WHERE id=$1
  `, [modelo.id, marcaBase + '_META']);

  let chamadasProvider = 0;
  mensageriaService.definirProviderParaTeste(async function (url, opcoes) {
    const payload = JSON.parse(opcoes.body);
    chamadasProvider += 1;
    confirmar(url.endsWith('/v99.0/123456789/messages'), 'Endpoint do provider fake divergente.');
    confirmar(payload.messaging_product === 'whatsapp' && payload.type === 'template',
      'Payload entregue ao provider fake deve ser um template WhatsApp.');
    return {
      ok: true,
      status: 200,
      json: async function () {
        return { messages: [{ id: 'wamid.qa.envio.' + chamadasProvider }] };
      }
    };
  });

  const inicio = new Date('2035-01-01T12:00:00.000Z');
  campanhaService.definirRelogioParaTeste(function () { return inicio; });
  mensageriaService.definirRelogioParaTeste(function () { return inicio; });

  const marcaPrincipal = marcaBase + ' PRINCIPAL';
  await inserirContatos(marcaPrincipal, 2000, bairro.nome, origem.id, 0);
  const principal = await criarCampanha(marcaPrincipal, modelo.id, usuario);
  const previaInicial = await campanhaService.visualizarPublico(principal.id, 10000);
  confirmar(previaInicial.publicoApto === 2000 && previaInicial.restantes === 2000 &&
    previaInicial.podeEnviarAgora === 500,
  'Teste 1: 2.000 aptos devem permitir 500 envios agora. Recebido: ' + JSON.stringify({
    aptos: previaInicial.publicoApto,
    restantes: previaInicial.restantes,
    podeEnviarAgora: previaInicial.podeEnviarAgora,
    capacidade: previaInicial.capacidade
  }));

  const servidor = await iniciarApi();
  try {
    const login = await requisitarApi(servidor, '/api/autenticacao/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'qa.campanhas@invalid.local', senha: 'SenhaQACampanhas123!' })
    });
    const autenticacao = await login.json();
    confirmar(login.status === 200 && Boolean(autenticacao.token),
      'A rota real deve autenticar o administrador QA.');
    const respostaPreparacao = await requisitarApi(
      servidor,
      '/api/admin/campanhas/' + principal.id + '/envios',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + autenticacao.token
        },
        body: JSON.stringify({ quantidade: 500, chaveIdempotencia: marcaBase + '-principal-1' })
      }
    );
    const preparacao = await respostaPreparacao.json();
    confirmar(respostaPreparacao.status === 201 && preparacao.resultado.tentativas.length === 500,
      'Teste 10: rota, controller, service, model, transacao e banco devem preparar 500 sem erro 500.');
    await enviarTodas(preparacao.resultado.tentativas);
  } finally {
    await new Promise(function (resolver) { servidor.close(resolver); });
  }

  const depoisPrimeiro = await campanhaService.visualizarPublico(principal.id, 10000);
  const totaisPrimeiro = await contar(principal.id);
  confirmar(totaisPrimeiro.enviadas === 500 && totaisPrimeiro.contatos_unicos === 500 &&
    depoisPrimeiro.restantes === 1500,
  'Teste 1: 500 devem ser enviados pelo fake e 1.500 devem permanecer na mesma campanha.');
  confirmar(depoisPrimeiro.podeEnviarAgora === 0,
    'Teste 4: capacidade esgotada deve produzir podeEnviarAgora igual a zero.');
  const lotesAntesZero = Number((await banco.query(
    'SELECT COUNT(*) AS total FROM campanha_lotes WHERE campanha_id=$1', [principal.id]
  )).rows[0].total);
  let erroCapacidadeZero;
  try {
    await campanhaService.prepararEnvio(principal.id, {
      quantidade: 1, chaveIdempotencia: marcaBase + '-sem-capacidade'
    }, usuario);
  } catch (erro) { erroCapacidadeZero = erro; }
  const lotesDepoisZero = Number((await banco.query(
    'SELECT COUNT(*) AS total FROM campanha_lotes WHERE campanha_id=$1', [principal.id]
  )).rows[0].total);
  confirmar(erroCapacidadeZero && erroCapacidadeZero.statusHttp === 409 &&
    lotesAntesZero === lotesDepoisZero,
  'Teste 4: capacidade zero deve rejeitar com 409 sem criar reserva invalida.');

  const segundoMomento = new Date(inicio.getTime() + 25 * 60 * 60 * 1000);
  campanhaService.definirRelogioParaTeste(function () { return segundoMomento; });
  mensageriaService.definirRelogioParaTeste(function () { return segundoMomento; });
  const previaSegundo = await campanhaService.visualizarPublico(principal.id, 10000);
  confirmar(previaSegundo.restantes === 1500 && previaSegundo.podeEnviarAgora === 500,
    'Teste 2: a mesma campanha deve liberar mais 500 apos a janela simulada.');
  const segundaPreparacao = await campanhaService.prepararEnvio(principal.id, {
    quantidade: 500, chaveIdempotencia: marcaBase + '-principal-2'
  }, usuario);
  await enviarTodas(segundaPreparacao.tentativas);
  const depoisSegundo = await campanhaService.visualizarPublico(principal.id, 10000);
  const totaisSegundo = await contar(principal.id);
  confirmar(totaisSegundo.enviadas === 1000 && totaisSegundo.contatos_unicos === 1000 &&
    depoisSegundo.restantes === 1000,
  'Teste 2: a continuidade deve totalizar 1.000 enviados e preservar 1.000 restantes.');

  const terceiroMomento = new Date(inicio.getTime() + 50 * 60 * 60 * 1000);
  campanhaService.definirRelogioParaTeste(function () { return terceiroMomento; });
  mensageriaService.definirRelogioParaTeste(function () { return terceiroMomento; });
  const marcaDuzentos = marcaBase + ' DUZENTOS';
  await inserirContatos(marcaDuzentos, 200, bairro.nome, origem.id, 3000);
  const campanhaDuzentos = await criarCampanha(marcaDuzentos, modelo.id, usuario);
  const previaDuzentos = await campanhaService.visualizarPublico(campanhaDuzentos.id, 10000);
  confirmar(previaDuzentos.restantes === 200 && previaDuzentos.podeEnviarAgora === 200,
    'Teste 3: 200 restantes com capacidade 500 devem permitir somente 200.');

  const marcaParcial = marcaBase + ' PARCIAL';
  await inserirContatos(marcaParcial, 600, bairro.nome, origem.id, 4000);
  const campanhaParcial = await criarCampanha(marcaParcial, modelo.id, usuario);
  const previaParcial = await campanhaService.visualizarPublico(campanhaParcial.id, 10000);
  confirmar(previaParcial.podeEnviarAgora === 500,
    'Teste 5: o maximo seguro da campanha parcial deve ser 500.');
  const parcial = await campanhaService.prepararEnvio(campanhaParcial.id, {
    quantidade: 200, chaveIdempotencia: marcaBase + '-parcial-200'
  }, usuario);
  await enviarTodas(parcial.tentativas);
  const depoisParcial = await campanhaService.visualizarPublico(campanhaParcial.id, 10000);
  confirmar((await contar(campanhaParcial.id)).enviadas === 200 && depoisParcial.restantes === 400,
    'Teste 5: quantidade menor deve enviar 200 e preservar 400 restantes.');

  const quartoMomento = new Date(inicio.getTime() + 75 * 60 * 60 * 1000);
  campanhaService.definirRelogioParaTeste(function () { return quartoMomento; });
  mensageriaService.definirRelogioParaTeste(function () { return quartoMomento; });
  const marcaExcesso = marcaBase + ' EXCESSO';
  await inserirContatos(marcaExcesso, 600, bairro.nome, origem.id, 5000);
  const campanhaExcesso = await criarCampanha(marcaExcesso, modelo.id, usuario);
  let erroExcesso;
  try {
    await campanhaService.prepararEnvio(campanhaExcesso.id, {
      quantidade: 501, chaveIdempotencia: marcaBase + '-excesso'
    }, usuario);
  } catch (erro) { erroExcesso = erro; }
  confirmar(erroExcesso && erroExcesso.statusHttp === 409 &&
    Number((await banco.query('SELECT COUNT(*) AS total FROM campanha_lotes WHERE campanha_id=$1',
      [campanhaExcesso.id])).rows[0].total) === 0,
  'Teste 6: 501 deve ser rejeitado sem reserva quando o maximo e 500.');

  const marcaConcorrente = marcaBase + ' CONCORRENTE';
  await inserirContatos(marcaConcorrente, 100, bairro.nome, origem.id, 6000);
  const campanhaConcorrente = await criarCampanha(marcaConcorrente, modelo.id, usuario);
  const chaveConcorrente = marcaBase + '-duplo-clique';
  const concorrentes = await Promise.all([
    campanhaService.prepararEnvio(campanhaConcorrente.id, {
      quantidade: 50, chaveIdempotencia: chaveConcorrente
    }, usuario),
    campanhaService.prepararEnvio(campanhaConcorrente.id, {
      quantidade: 50, chaveIdempotencia: chaveConcorrente
    }, usuario)
  ]);
  const idsA = concorrentes[0].tentativas.slice().sort(function (a, b) { return a - b; });
  const idsB = concorrentes[1].tentativas.slice().sort(function (a, b) { return a - b; });
  const contagemConcorrente = await contar(campanhaConcorrente.id);
  confirmar(JSON.stringify(idsA) === JSON.stringify(idsB) &&
    contagemConcorrente.participacoes === 50 && contagemConcorrente.contatos_unicos === 50,
  'Teste 7: duplo clique deve devolver as mesmas tentativas sem duplicar contatos.');

  const quintoMomento = new Date(inicio.getTime() + 100 * 60 * 60 * 1000);
  campanhaService.definirRelogioParaTeste(function () { return quintoMomento; });
  mensageriaService.definirRelogioParaTeste(function () { return quintoMomento; });
  const marcaElegibilidade = marcaBase + ' ELEGIBILIDADE';
  const contatosElegibilidade = await inserirContatos(marcaElegibilidade, 2, bairro.nome, origem.id, 7000);
  const campanhaElegibilidade = await criarCampanha(marcaElegibilidade, modelo.id, usuario);
  const primeiraElegivel = await campanhaService.prepararEnvio(campanhaElegibilidade.id, {
    quantidade: 1, chaveIdempotencia: marcaBase + '-elegivel-1'
  }, usuario);
  await enviarTodas(primeiraElegivel.tentativas);
  await banco.query(`
    UPDATE contatos
    SET bloqueado_para_mensagens=TRUE, atualizado_em=CURRENT_TIMESTAMP
    WHERE id=$1
  `, [contatosElegibilidade[1].id]);
  const sextoMomento = new Date(inicio.getTime() + 125 * 60 * 60 * 1000);
  campanhaService.definirRelogioParaTeste(function () { return sextoMomento; });
  mensageriaService.definirRelogioParaTeste(function () { return sextoMomento; });
  const previaInelegivel = await campanhaService.visualizarPublico(campanhaElegibilidade.id, 10000);
  confirmar(previaInelegivel.restantes === 0 && previaInelegivel.podeEnviarAgora === 0 &&
    (await contar(campanhaElegibilidade.id)).participacoes === 1,
  'Teste 8: contato bloqueado entre rodadas nao pode entrar em nova reserva.');

  const marcaFalha = marcaBase + ' FALHA';
  await inserirContatos(marcaFalha, 1, bairro.nome, origem.id, 8000);
  const campanhaFalha = await criarCampanha(marcaFalha, modelo.id, usuario);
  const preparacaoFalha = await campanhaService.prepararEnvio(campanhaFalha.id, {
    quantidade: 1, chaveIdempotencia: marcaBase + '-falha'
  }, usuario);
  mensageriaService.definirProviderParaTeste(async function () {
    return {
      ok: false, status: 500,
      json: async function () {
        return { error: { code: 131000, message: 'Falha Meta simulada' } };
      }
    };
  });
  let falhaProvider;
  try { await mensageriaService.enviar(preparacaoFalha.tentativas[0]); }
  catch (erro) { falhaProvider = erro; }
  const tentativaFalha = (await banco.query(
    'SELECT * FROM campanha_tentativas WHERE id=$1', [preparacaoFalha.tentativas[0]]
  )).rows[0];
  const novaTentativa = await mensageriaService.reprocessar(tentativaFalha.id);
  const historicosFalha = Number((await banco.query(`
    SELECT COUNT(*) AS total FROM historico_status_mensageria
    WHERE participacao_id=$1
  `, [tentativaFalha.participacao_id])).rows[0].total);
  confirmar(falhaProvider && falhaProvider.statusHttp === 502 && tentativaFalha.status === 'falhou' &&
    novaTentativa.numero_tentativa === 2 && historicosFalha >= 3,
  'Teste 9: falha fake deve preservar historico e permitir nova tentativa.');

  const duplicidades = Number((await banco.query(`
    SELECT COUNT(*) AS total FROM (
      SELECT campanha_id, contato_id, COUNT(*)
      FROM campanha_participacoes
      GROUP BY campanha_id, contato_id
      HAVING COUNT(*) > 1
    ) duplicadas
  `)).rows[0].total);
  confirmar(duplicidades === 0, 'Nenhuma campanha pode conter o mesmo contato duas vezes.');
  confirmar(chamadasProvider === 1201,
    'Somente os 1.201 envios de sucesso previstos devem chegar ao provider fake.');

  console.log('Envio simplificado de campanhas: ' + verificacoes + ' verificacoes aprovadas.');
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
}).finally(async function () {
  campanhaService.definirRelogioParaTeste(null);
  mensageriaService.definirRelogioParaTeste(null);
  mensageriaService.definirProviderParaTeste();
  await banco.end();
});
