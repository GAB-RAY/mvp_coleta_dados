require('dotenv').config({ quiet: true });

const assert = require('assert');
const jwt = require('jsonwebtoken');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');

const TELEFONE = '21999986001';

async function requisitar(baseUrl, caminho, opcoes) {
  const resposta = await fetch(baseUrl + caminho, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opcoes || {}));
  const corpo = await resposta.json();

  return { status: resposta.status, corpo };
}

async function limpar() {
  const resultado = await banco.query(
    'SELECT id FROM contatos WHERE telefone_normalizado = $1',
    [TELEFONE]
  );

  if (!resultado.rows[0]) {
    return;
  }

  const id = resultado.rows[0].id;
  await banco.query('DELETE FROM aceites_privacidade WHERE contato_id = $1', [id]);
  await banco.query('DELETE FROM consentimentos WHERE contato_id = $1', [id]);
  await banco.query('DELETE FROM historico_contatos WHERE contato_id = $1', [id]);
  await banco.query('DELETE FROM contatos WHERE id = $1', [id]);
}

async function executar() {
  let servidor;

  try {
    await limpar();
    const usuario = await banco.query('SELECT id, email FROM usuarios ORDER BY id LIMIT 1');
    assert.ok(usuario.rows[0]);
    const segredo = process.env.JWT_SECRET || process.env.JWT_SEGREDO;
    const token = jwt.sign(
      { id: usuario.rows[0].id, email: usuario.rows[0].email },
      segredo,
      { expiresIn: '10m' }
    );
    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;
    const cabecalhos = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    };
    const origens = await requisitar(baseUrl, '/api/admin/origens', {
      headers: cabecalhos
    });
    assert.strictEqual(origens.status, 200);
    const origemManual = origens.corpo.origens.find(function (origem) {
      return origem.slug === 'cadastro-manual';
    });
    assert.ok(origemManual);

    const dados = {
      nome: 'Cadastro Manual Teste',
      telefone: TELEFONE,
      bairro: 'Vila Kennedy',
      idade: 40,
      problema: 'Educação',
      descricaoProblema: 'Registro manual temporário',
      participouEleicaoAnterior: 'nao',
      origemId: origemManual.id,
      status: 'ativo',
      aceitePrivacidade: true,
      autorizacaoMensagens: 'autorizado',
      autorizacaoLigacoes: 'recusado'
    };
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/contatos', {
      method: 'POST', body: JSON.stringify(dados)
    })).status, 401);

    const criacao = await requisitar(baseUrl, '/api/admin/contatos', {
      method: 'POST', headers: cabecalhos, body: JSON.stringify(dados)
    });
    assert.strictEqual(criacao.status, 201);
    assert.strictEqual(criacao.corpo.contatoCriado, true);

    const registros = await banco.query(
      `
        SELECT tipo, estado, resposta, registrado_por_usuario_id
        FROM consentimentos
        WHERE contato_id = $1 AND tipo IN ('mensagens', 'ligacoes')
        ORDER BY tipo
      `,
      [criacao.corpo.contatoId]
    );
    assert.strictEqual(registros.rowCount, 2);
    assert.strictEqual(registros.rows[0].tipo, 'ligacoes');
    assert.strictEqual(registros.rows[0].estado, 'recusado');
    assert.strictEqual(registros.rows[0].resposta, false);
    assert.strictEqual(registros.rows[1].estado, 'autorizado');
    assert.strictEqual(Number(registros.rows[1].registrado_por_usuario_id), Number(usuario.rows[0].id));

    const atualizacao = await requisitar(baseUrl, '/api/admin/contatos', {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(Object.assign({}, dados, {
        nome: 'Cadastro Manual Atualizado',
        idade: 41,
        autorizacaoMensagens: 'nao_informado',
        autorizacaoLigacoes: 'nao_informado'
      }))
    });
    assert.strictEqual(atualizacao.status, 200);
    assert.strictEqual(atualizacao.corpo.contatoCriado, false);
    assert.deepStrictEqual(atualizacao.corpo.camposAlterados.sort(), ['idade', 'nome']);

    const historico = await banco.query(
      `
        SELECT dados_anteriores, dados_novos, registrado_por_usuario_id
        FROM historico_contatos
        WHERE contato_id = $1
      `,
      [criacao.corpo.contatoId]
    );
    assert.strictEqual(historico.rowCount, 1);
    assert.strictEqual(historico.rows[0].dados_novos.idade, 41);
    assert.strictEqual(Number(historico.rows[0].registrado_por_usuario_id), Number(usuario.rows[0].id));
    const consentimentosDepois = await banco.query(
      "SELECT COUNT(*)::integer AS total FROM consentimentos WHERE contato_id = $1 AND tipo IN ('mensagens','ligacoes')",
      [criacao.corpo.contatoId]
    );
    assert.strictEqual(consentimentosDepois.rows[0].total, 2);

    console.log('Cadastro manual: 16 verificações aprovadas.');
    console.log('Criação, atualização auditada e consentimentos explícitos aprovados.');
  } finally {
    if (servidor) {
      await new Promise(function (resolver) {
        servidor.close(resolver);
      });
    }
    await limpar();
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro);
  process.exitCode = 1;
});
