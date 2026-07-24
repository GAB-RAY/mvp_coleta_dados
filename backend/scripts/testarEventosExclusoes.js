require('dotenv').config({ quiet: true });

const assert = require('assert');
const bcrypt = require('bcrypt');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');
const formatarDataRio = require('../src/utils/formatarDataRio');

const SENHA = 'TesteEventos123!';
let total = 0;

function verificar(condicao, mensagem) {
  total += 1;
  assert.ok(condicao, mensagem);
}

async function requisitar(baseUrl, caminho, opcoes) {
  const resposta = await fetch(baseUrl + caminho, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opcoes || {}));
  let corpo = {};
  const tipo = resposta.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    corpo = await resposta.json();
  }
  return { status: resposta.status, corpo };
}

async function login(baseUrl, email) {
  return requisitar(baseUrl, '/api/autenticacao/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: SENHA })
  });
}

function cabecalhos(token) {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
}

async function limparDadosTeste() {
  const emails = ['eventos.admin@invalid.local', 'eventos.operador@invalid.local'];
  const telefones = ['21999001122', '21999001133'];
  await banco.query(
    `DELETE FROM consentimentos
     WHERE contato_id_original IN (
       SELECT contato_id_original FROM solicitacoes_exclusao
       WHERE solicitada_por_usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1::text[]))
     )`,
    [emails]
  );
  await banco.query(
    `DELETE FROM solicitacoes_exclusao
     WHERE solicitada_por_usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1::text[]))`,
    [emails]
  );
  await banco.query(
    `DELETE FROM contato_eventos
     WHERE evento_id IN (
       SELECT id FROM eventos
       WHERE criado_por_usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1::text[]))
     )`,
    [emails]
  );
  await banco.query(
    `DELETE FROM eventos
     WHERE criado_por_usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1::text[]))`,
    [emails]
  );
  await banco.query(
    `DELETE FROM consentimentos
     WHERE contato_id IN (SELECT id FROM contatos WHERE telefone_normalizado = ANY($1::text[]))`,
    [telefones]
  );
  await banco.query('DELETE FROM contatos WHERE telefone_normalizado = ANY($1::text[])', [telefones]);
  await banco.query('DELETE FROM tentativas_login WHERE email_informado = ANY($1::text[])', [emails]);
  await banco.query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [emails]);
}

async function executar() {
  let servidor;
  let idsEventosAtivosPreservados = [];
  const emailAdmin = 'eventos.admin@invalid.local';
  const emailOperador = 'eventos.operador@invalid.local';
  const telefoneEvento = '21999001122';
  const telefoneGeral = '21999001133';

  try {
    await limparDadosTeste();
    const eventosAtivos = await banco.query(
      "SELECT id FROM eventos WHERE status = 'ativo' ORDER BY id"
    );
    idsEventosAtivosPreservados = eventosAtivos.rows.map(function (evento) {
      return evento.id;
    });
    if (idsEventosAtivosPreservados.length > 0) {
      await banco.query(
        "UPDATE eventos SET status = 'rascunho' WHERE id = ANY($1::bigint[])",
        [idsEventosAtivosPreservados]
      );
    }
    const senhaHash = await bcrypt.hash(SENHA, 4);
    await banco.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       VALUES ('Admin Eventos', $1, $3, 'administrador'),
              ('Operador Eventos', $2, $3, 'operador')`,
      [emailAdmin, emailOperador, senhaHash]
    );

    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;
    const admin = await login(baseUrl, emailAdmin);
    const operador = await login(baseUrl, emailOperador);
    verificar(admin.status === 200, 'Login do administrador falhou.');
    verificar(operador.status === 200, 'Login do operador falhou.');
    const adminHeaders = cabecalhos(admin.corpo.token);
    const operadorHeaders = cabecalhos(operador.corpo.token);

    verificar((await requisitar(baseUrl, '/api/admin/eventos')).status === 401, 'Eventos sem JWT não retornou 401.');
    verificar((await requisitar(baseUrl, '/api/admin/eventos', { method: 'POST', headers: operadorHeaders, body: '{}' })).status === 403, 'Operador conseguiu criar evento.');
    const hoje = formatarDataRio(new Date());
    const criacao = await requisitar(baseUrl, '/api/admin/eventos', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ nome: 'Mutirão comunitário', motivo: 'Ouvir moradores', dataInicial: hoje, dataFinal: hoje })
    });
    verificar(criacao.status === 201, 'Evento não foi criado.');
    const eventoId = criacao.corpo.evento.id;
    const edicao = await requisitar(baseUrl, '/api/admin/eventos/' + eventoId, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ nome: 'Mutirão do bairro', motivo: 'Ouvir moradores', dataInicial: hoje, dataFinal: hoje })
    });
    verificar(edicao.status === 200, 'Evento em rascunho não foi editado.');
    verificar((await requisitar(baseUrl, '/api/admin/eventos/' + eventoId + '/ativar', { method: 'POST', headers: adminHeaders })).status === 200, 'Evento não foi ativado.');

    const opcoesComEvento = await requisitar(baseUrl, '/api/publico/contatos/opcoes');
    verificar(opcoesComEvento.status === 200 && opcoesComEvento.corpo.eventoAtivo.id === eventoId, 'Formulário não informou o evento ativo.');
    const cadastroEvento = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Contato Evento', telefone: telefoneEvento, idade: 30, bairro: 'Vila Kennedy', problema: 'Saúde', aceitePrivacidade: true, autorizacaoMensagens: true, autorizacaoLigacoes: true })
    });
    verificar(cadastroEvento.status === 201 && cadastroEvento.corpo.evento.id === eventoId, 'Cadastro não foi vinculado ao evento.');
    const filtroEvento = await requisitar(baseUrl, '/api/admin/contatos?eventoId=' + eventoId, { headers: operadorHeaders });
    verificar(filtroEvento.status === 200 && filtroEvento.corpo.contatos.length === 1, 'Filtro por evento falhou.');
    verificar(filtroEvento.corpo.contatos[0].eventos[0].nome === 'Mutirão do bairro', 'Listagem não mostrou evento e data de vínculo.');
    const contatoId = filtroEvento.corpo.contatos[0].id;

    verificar((await requisitar(baseUrl, '/api/admin/relatorios/exportar.csv', { headers: operadorHeaders })).status === 403, 'Operador conseguiu exportar CSV.');
    verificar((await requisitar(baseUrl, '/api/admin/relatorios/exportar.xlsx', { headers: operadorHeaders })).status === 403, 'Operador conseguiu exportar Excel.');
    verificar((await requisitar(baseUrl, '/api/admin/contatos/' + contatoId, { method: 'DELETE', headers: operadorHeaders })).status === 404, 'Operador encontrou exclusão direta de contato.');

    const revogacao = await requisitar(baseUrl, '/api/admin/contatos/' + contatoId + '/revogar-consentimentos', {
      method: 'POST',
      headers: operadorHeaders,
      body: JSON.stringify({ tipo: 'mensagens', motivo: 'Solicitação da pessoa' })
    });
    verificar(revogacao.status === 200, 'Revogação não foi registrada.');
    const trilhaRevogacao = await banco.query(
      `SELECT id, estado, registro_anterior_id FROM consentimentos
       WHERE contato_id = $1 AND tipo = 'mensagens' ORDER BY id`,
      [contatoId]
    );
    verificar(trilhaRevogacao.rowCount === 2, 'Revogação não preservou o registro anterior.');
    verificar(Boolean(trilhaRevogacao.rows[1].registro_anterior_id), 'Revogação não referencia o registro anterior.');

    const solicitacao = await requisitar(baseUrl, '/api/admin/contatos/' + contatoId + '/solicitacao-exclusao', {
      method: 'POST', headers: operadorHeaders, body: JSON.stringify({ observacoes: 'Pedido recebido' })
    });
    verificar(solicitacao.status === 200, 'Operador não conseguiu solicitar exclusão.');
    const solicitacaoId = solicitacao.corpo.solicitacaoId;
    verificar((await requisitar(baseUrl, '/api/admin/solicitacoes-exclusao/' + solicitacaoId + '/aprovar', { method: 'POST', headers: operadorHeaders })).status === 403, 'Operador conseguiu aprovar exclusão.');
    verificar((await requisitar(baseUrl, '/api/admin/solicitacoes-exclusao', { headers: operadorHeaders })).status === 403, 'Operador conseguiu listar fila administrativa de exclusões.');
    const aprovacao = await requisitar(baseUrl, '/api/admin/solicitacoes-exclusao/' + solicitacaoId + '/aprovar', { method: 'POST', headers: adminHeaders });
    verificar(aprovacao.status === 200, 'Administrador não conseguiu aprovar exclusão.');
    verificar(Number((await banco.query('SELECT COUNT(*) AS total FROM contatos WHERE id = $1', [contatoId])).rows[0].total) === 0, 'Contato não foi excluído fisicamente.');
    verificar(Number((await banco.query('SELECT COUNT(*) AS total FROM consentimentos WHERE contato_id_original = $1', [contatoId])).rows[0].total) >= 3, 'Consentimentos/revogações foram apagados.');
    verificar(Number((await banco.query('SELECT COUNT(*) AS total FROM solicitacoes_exclusao WHERE id = $1 AND status = \'aprovada\' AND contato_id IS NULL', [solicitacaoId])).rows[0].total) === 1, 'Pedido aprovado não foi preservado sem dados pessoais.');

    verificar((await requisitar(baseUrl, '/api/admin/eventos/' + eventoId + '/encerrar', { method: 'POST', headers: adminHeaders })).status === 200, 'Evento não foi encerrado.');
    const opcoesGerais = await requisitar(baseUrl, '/api/publico/contatos/opcoes');
    verificar(opcoesGerais.corpo.eventoAtivo === null && opcoesGerais.corpo.contextoCadastro === null, 'Formulário sem evento exibiu contexto desnecessário.');
    const cadastroGeral = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Contato Geral', telefone: telefoneGeral, idade: 40, bairro: 'Vila Kennedy', problema: 'Educação', aceitePrivacidade: true, autorizacaoMensagens: false, autorizacaoLigacoes: false })
    });
    verificar(cadastroGeral.status === 201 && cadastroGeral.corpo.evento === null, 'Cadastro geral sem evento foi bloqueado ou vinculado indevidamente.');
    const semEvento = await requisitar(baseUrl, '/api/admin/contatos?eventoId=sem_evento', { headers: adminHeaders });
    verificar(semEvento.status === 200 && semEvento.corpo.contatos.some(function (item) { return item.telefone === telefoneGeral; }), 'Filtro de cadastros gerais falhou.');

    console.log('Eventos, permissões e exclusões: ' + total + ' verificações aprovadas.');
  } finally {
    if (servidor) {
      await new Promise(function (resolver) { servidor.close(resolver); });
    }
    await limparDadosTeste();
    if (idsEventosAtivosPreservados.length > 0) {
      await banco.query(
        "UPDATE eventos SET status = 'ativo' WHERE id = ANY($1::bigint[])",
        [idsEventosAtivosPreservados]
      );
    }
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
