require('dotenv').config({ quiet: true });

const assert = require('assert');
const bcrypt = require('bcrypt');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');

const EMAIL = 'privacidade.operador@invalid.local';
const TELEFONE = '21999987007';
const TELEFONE_SEM_RESPOSTA = '21999987008';
const SENHA = 'SenhaPrivacidade123!';
let total = 0;

function verificar(condicao, mensagem) {
  total += 1;
  assert.ok(condicao, mensagem);
}

async function requisitar(baseUrl, caminho, opcoes) {
  const resposta = await fetch(baseUrl + caminho, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opcoes || {}));
  return { status: resposta.status, corpo: await resposta.json() };
}

async function limpar() {
  await banco.query(
    `DELETE FROM solicitacoes_exclusao
     WHERE solicitada_por_usuario_id IN (SELECT id FROM usuarios WHERE email = $1)`,
    [EMAIL]
  );
  const contatos = await banco.query(
    'SELECT id FROM contatos WHERE telefone_normalizado = ANY($1::text[])',
    [[TELEFONE, TELEFONE_SEM_RESPOSTA]]
  );
  if (contatos.rows.length > 0) {
    const ids = contatos.rows.map(function (item) { return item.id; });
    await banco.query('DELETE FROM consentimentos WHERE contato_id = ANY($1::bigint[])', [ids]);
    await banco.query('DELETE FROM contatos WHERE id = ANY($1::bigint[])', [ids]);
  }
  await banco.query('DELETE FROM tentativas_login WHERE email_informado = $1', [EMAIL]);
  await banco.query('DELETE FROM usuarios WHERE email = $1', [EMAIL]);
}

async function executar() {
  let servidor;

  try {
    await limpar();
    const senhaHash = await bcrypt.hash(SENHA, 4);
    await banco.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       VALUES ('Operador Privacidade', $1, $2, 'operador')`,
      [EMAIL, senhaHash]
    );
    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;
    const cadastro = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Contato Privacidade', telefone: TELEFONE, idade: 38,
        bairro: 'Vila Kennedy', problema: 'Saúde', aceitePrivacidade: true,
        autorizacaoMensagens: true, autorizacaoLigacoes: true
      })
    });
    verificar(cadastro.status === 201, 'Cadastro temporário falhou.');
    const login = await requisitar(baseUrl, '/api/autenticacao/login', {
      method: 'POST', body: JSON.stringify({ email: EMAIL, senha: SENHA })
    });
    verificar(login.status === 200, 'Login temporário falhou.');
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.corpo.token };
    const cadastroSemResposta = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Contato Sem Resposta', telefone: TELEFONE_SEM_RESPOSTA, idade: 39,
        bairro: 'Vila Kennedy', problema: 'Sa\u00fade', aceitePrivacidade: true,
        autorizacaoMensagens: false, autorizacaoLigacoes: false
      })
    });
    verificar(
      cadastroSemResposta.status === 201,
      'Cadastro sem resposta de comunicaÃ§Ã£o falhou: HTTP ' +
        cadastroSemResposta.status + ' - ' + JSON.stringify(cadastroSemResposta.corpo)
    );
    const contatoSemResposta = await banco.query(
      'SELECT id FROM contatos WHERE telefone_normalizado = $1',
      [TELEFONE_SEM_RESPOSTA]
    );
    const usuarioTeste = await banco.query('SELECT id FROM usuarios WHERE email = $1', [EMAIL]);
    const exclusaoModel = require('../src/modules/exclusoes/solicitacaoExclusaoModel');
    const pedidoSemResposta = await exclusaoModel.solicitar(
      contatoSemResposta.rows[0].id,
      usuarioTeste.rows[0].id,
      null
    );
    await exclusaoModel.rejeitar(pedidoSemResposta.id, usuarioTeste.rows[0].id, null);
    const estadoSemResposta = await banco.query(
      `SELECT bloqueado_para_mensagens, bloqueado_para_ligacoes
       FROM contatos WHERE id = $1`,
      [contatoSemResposta.rows[0].id]
    );
    verificar(
      estadoSemResposta.rows[0].bloqueado_para_mensagens === false &&
        estadoSemResposta.rows[0].bloqueado_para_ligacoes === false,
      'Rejeitar exclusÃ£o transformou ausÃªncia de resposta em bloqueio.'
    );
    const lista = await requisitar(baseUrl, '/api/admin/contatos?telefone=' + TELEFONE, { headers });
    const contatoId = lista.corpo.contatos[0].id;

    const revogacao = await requisitar(baseUrl, '/api/admin/contatos/' + contatoId + '/revogar-consentimentos', {
      method: 'POST', headers, body: JSON.stringify({ tipo: 'ambos', motivo: 'Pedido expresso' })
    });
    verificar(revogacao.status === 200, 'Revogação falhou.');
    verificar(revogacao.corpo.tiposRevogados.length === 2, 'Ambas as revogações não foram registradas.');
    const registros = await banco.query(
      `SELECT tipo, estado, ativo, registro_anterior_id
       FROM consentimentos WHERE contato_id = $1 ORDER BY id`,
      [contatoId]
    );
    verificar(registros.rowCount === 4, 'O histórico imutável dos consentimentos está incompleto.');
    verificar(registros.rows.filter(function (item) { return item.estado === 'revogado'; }).length === 2, 'Estados revogados não foram persistidos.');
    verificar(registros.rows.filter(function (item) { return Boolean(item.registro_anterior_id); }).length === 2, 'Revogações não apontam para registros anteriores.');
    const repeticao = await requisitar(baseUrl, '/api/admin/contatos/' + contatoId + '/revogar-consentimentos', {
      method: 'POST', headers, body: JSON.stringify({ tipo: 'ambos', motivo: 'Pedido expresso' })
    });
    verificar(repeticao.status === 200 && repeticao.corpo.alterado === false, 'Revogação repetida não foi idempotente.');
    verificar(Number((await banco.query('SELECT COUNT(*) AS total FROM consentimentos WHERE contato_id = $1', [contatoId])).rows[0].total) === 4, 'Revogação repetida duplicou registros.');

    const pedido = await requisitar(baseUrl, '/api/admin/contatos/' + contatoId + '/solicitacao-exclusao', {
      method: 'POST', headers
    });
    verificar(pedido.status === 200 && pedido.corpo.alterado === true, 'Pedido de exclusão falhou.');
    const pedidoRepetido = await requisitar(baseUrl, '/api/admin/contatos/' + contatoId + '/solicitacao-exclusao', {
      method: 'POST', headers
    });
    verificar(pedidoRepetido.corpo.alterado === false, 'Pedido repetido não foi idempotente.');
    const estado = await banco.query(
      `SELECT bloqueado_para_mensagens, bloqueado_para_ligacoes
       FROM contatos WHERE id = $1`,
      [contatoId]
    );
    verificar(estado.rows[0].bloqueado_para_mensagens === true, 'Mensagens não foram bloqueadas.');
    verificar(estado.rows[0].bloqueado_para_ligacoes === true, 'Ligações não foram bloqueadas.');
    const reenvioPendente = await requisitar(baseUrl, '/api/publico/contatos', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Contato Privacidade', telefone: TELEFONE, idade: 38,
        bairro: 'Vila Kennedy', problema: 'Saúde', aceitePrivacidade: true,
        autorizacaoMensagens: true, autorizacaoLigacoes: true
      })
    });
    verificar(
      reenvioPendente.status === 201 && reenvioPendente.corpo.contatoCriado === false,
      'Reenvio consciente do contato existente falhou.'
    );
    const estadoDepoisReenvio = await banco.query(
      `SELECT bloqueado_para_mensagens, bloqueado_para_ligacoes
       FROM contatos WHERE id = $1`,
      [contatoId]
    );
    verificar(
      estadoDepoisReenvio.rows[0].bloqueado_para_mensagens === true &&
        estadoDepoisReenvio.rows[0].bloqueado_para_ligacoes === true,
      'Pedido pendente deixou de bloquear comunicações após novo envio.'
    );
    verificar(Number((await banco.query("SELECT COUNT(*) AS total FROM solicitacoes_exclusao WHERE contato_id = $1 AND status = 'pendente'", [contatoId])).rows[0].total) === 1, 'Fila pendente não foi registrada corretamente.');

    console.log('Privacidade administrativa: ' + total + ' verificações aprovadas.');
  } finally {
    if (servidor) {
      await new Promise(function (resolver) { servidor.close(resolver); });
    }
    await limpar();
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
