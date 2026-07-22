require('dotenv').config({ quiet: true });

const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');

const TELEFONE = '21999986001';
const EMAIL_OPERADOR = 'cadastro.operador@invalid.local';
const EMAIL_ADMIN = 'cadastro.admin@invalid.local';
const EMAILS_TESTE = [EMAIL_OPERADOR, EMAIL_ADMIN];

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

  if (resultado.rows[0]) {
    const id = resultado.rows[0].id;
    await banco.query('DELETE FROM aceites_privacidade WHERE contato_id = $1', [id]);
    await banco.query('DELETE FROM consentimentos WHERE contato_id = $1', [id]);
    await banco.query('DELETE FROM historico_contatos WHERE contato_id = $1', [id]);
    await banco.query('DELETE FROM contatos WHERE id = $1', [id]);
  }

  await banco.query(
    'DELETE FROM tentativas_login WHERE email_informado = ANY($1::text[])',
    [EMAILS_TESTE]
  );
  await banco.query(
    'DELETE FROM usuarios WHERE email = ANY($1::text[])',
    [EMAILS_TESTE]
  );
}

async function executar() {
  let servidor;

  try {
    await limpar();
    const senhaHash = await bcrypt.hash('SenhaCadastro123!', 4);
    const usuarios = await banco.query(
      `
        INSERT INTO usuarios (nome, email, senha_hash, perfil)
        VALUES
          ('Operador Cadastro', $1, $3, 'operador'),
          ('Administrador Cadastro', $2, $3, 'administrador')
        RETURNING id, email, perfil
      `,
      [EMAIL_OPERADOR, EMAIL_ADMIN, senhaHash]
    );
    const operador = usuarios.rows.find(function (usuario) {
      return usuario.perfil === 'operador';
    });
    const administrador = usuarios.rows.find(function (usuario) {
      return usuario.perfil === 'administrador';
    });
    const segredo = process.env.JWT_SECRET || process.env.JWT_SEGREDO;
    const tokenOperador = jwt.sign(
      { id: operador.id, email: operador.email, perfil: operador.perfil },
      segredo,
      { expiresIn: '10m' }
    );
    const tokenAdministrador = jwt.sign(
      { id: administrador.id, email: administrador.email, perfil: administrador.perfil },
      segredo,
      { expiresIn: '10m' }
    );
    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;
    const cabecalhosOperador = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + tokenOperador
    };
    const cabecalhosAdministrador = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + tokenAdministrador
    };
    const origens = await requisitar(baseUrl, '/api/admin/origens', {
      headers: cabecalhosOperador
    });
    assert.strictEqual(origens.status, 200);
    const origemManual = origens.corpo.origens.find(function (origem) {
      return origem.slug === 'cadastro-manual';
    });
    assert.ok(origemManual);

    const dados = {
      nome: 'Cadastro Manual Teste',
      telefone: TELEFONE,
      bairro: 'vila kennedy',
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
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/contatos', {
      method: 'POST',
      headers: cabecalhosOperador,
      body: JSON.stringify(Object.assign({}, dados, { bairro: 'Bairro inventado' }))
    })).status, 400);

    const criacao = await requisitar(baseUrl, '/api/admin/contatos', {
      method: 'POST', headers: cabecalhosOperador, body: JSON.stringify(dados)
    });
    assert.strictEqual(criacao.status, 201);
    assert.strictEqual(criacao.corpo.contatoCriado, true);
    const bairroArmazenado = await banco.query(
      'SELECT bairro FROM contatos WHERE id = $1',
      [criacao.corpo.contatoId]
    );
    assert.strictEqual(bairroArmazenado.rows[0].bairro, 'Vila Kennedy');

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
    assert.strictEqual(Number(registros.rows[1].registrado_por_usuario_id), Number(operador.id));

    const atualizacaoOperador = await requisitar(baseUrl, '/api/admin/contatos', {
      method: 'POST',
      headers: cabecalhosOperador,
      body: JSON.stringify(Object.assign({}, dados, {
        nome: 'Cadastro Manual Atualizado',
        idade: 41,
        autorizacaoMensagens: 'nao_informado',
        autorizacaoLigacoes: 'nao_informado'
      }))
    });
    assert.strictEqual(atualizacaoOperador.status, 200);
    assert.strictEqual(atualizacaoOperador.corpo.contatoCriado, false);
    assert.deepStrictEqual(atualizacaoOperador.corpo.camposAlterados.sort(), ['idade', 'nome']);

    const atualizacaoAdministrador = await requisitar(baseUrl, '/api/admin/contatos', {
      method: 'POST',
      headers: cabecalhosAdministrador,
      body: JSON.stringify(Object.assign({}, dados, {
        nome: 'Cadastro Revisado pelo Admin',
        idade: 42,
        autorizacaoMensagens: 'nao_informado',
        autorizacaoLigacoes: 'nao_informado'
      }))
    });
    assert.strictEqual(atualizacaoAdministrador.status, 200);
    assert.strictEqual(atualizacaoAdministrador.corpo.contatoCriado, false);
    assert.deepStrictEqual(
      atualizacaoAdministrador.corpo.camposAlterados.sort(),
      ['idade', 'nome']
    );

    const historico = await banco.query(
      `
        SELECT dados_anteriores, dados_novos, registrado_por_usuario_id
        FROM historico_contatos
        WHERE contato_id = $1
        ORDER BY id
      `,
      [criacao.corpo.contatoId]
    );
    assert.strictEqual(historico.rowCount, 2);
    assert.strictEqual(historico.rows[0].dados_novos.idade, 41);
    assert.strictEqual(Number(historico.rows[0].registrado_por_usuario_id), Number(operador.id));
    assert.strictEqual(historico.rows[1].dados_novos.idade, 42);
    assert.strictEqual(
      Number(historico.rows[1].registrado_por_usuario_id),
      Number(administrador.id)
    );
    const consentimentosDepois = await banco.query(
      "SELECT COUNT(*)::integer AS total FROM consentimentos WHERE contato_id = $1 AND tipo IN ('mensagens','ligacoes')",
      [criacao.corpo.contatoId]
    );
    assert.strictEqual(consentimentosDepois.rows[0].total, 2);

    console.log('Cadastro manual: 24 verificações aprovadas.');
    console.log('Operador e administrador editaram com histórico; consentimentos explícitos aprovados.');
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
