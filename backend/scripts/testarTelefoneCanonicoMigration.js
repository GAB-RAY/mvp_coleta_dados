require('dotenv').config({ quiet: true });

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const banco = require('../src/config/banco');

const TELEFONE_LOCAL = '21999887766';
const TELEFONE_COM_PAIS = '5521999887766';

async function limpar() {
  await banco.query(
    'DELETE FROM contatos WHERE telefone_normalizado = ANY($1::text[])',
    [[TELEFONE_LOCAL, TELEFONE_COM_PAIS]]
  );
}

async function inserir(telefone, nome) {
  await banco.query(
    `INSERT INTO contatos
     (nome,telefone,telefone_normalizado,consentimento_armazenamento,consentimento_mensagens,status_contato)
     VALUES ($1,$2,$2,TRUE,FALSE,'ativo')`,
    [nome, telefone]
  );
}

async function executar() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'migrations', '018_garantir_telefone_canonico_unico.sql'),
    'utf8'
  );

  try {
    await limpar();
    await inserir(TELEFONE_LOCAL, 'Telefone local');
    await inserir(TELEFONE_COM_PAIS, 'Telefone com país');

    await assert.rejects(
      banco.query(sql),
      function (erro) {
        return String(erro.message).includes('grupos de contatos com o mesmo telefone canonico');
      }
    );
    assert.strictEqual(Number((await banco.query(
      'SELECT COUNT(*) AS total FROM contatos WHERE telefone_normalizado = ANY($1::text[])',
      [[TELEFONE_LOCAL, TELEFONE_COM_PAIS]]
    )).rows[0].total), 2);

    await banco.query('DELETE FROM contatos WHERE telefone_normalizado = $1', [TELEFONE_LOCAL]);
    await banco.query(sql);
    const resultado = await banco.query(
      'SELECT telefone_normalizado FROM contatos WHERE nome = $1',
      ['Telefone com país']
    );
    assert.strictEqual(resultado.rows[0].telefone_normalizado, TELEFONE_LOCAL);
    assert.strictEqual(Number((await banco.query(
      `SELECT COUNT(*) AS total FROM pg_indexes
       WHERE schemaname='public' AND indexname='contatos_telefone_normalizado_unico'`
    )).rows[0].total), 1);

    console.log('Telefone canônico: colisão bloqueada sem mesclagem e unicidade validada.');
  } finally {
    await limpar();
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
