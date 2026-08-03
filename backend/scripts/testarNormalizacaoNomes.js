require('dotenv').config({ quiet: true });

const assert = require('assert');
const banco = require('../src/config/banco');
const normalizarNomePessoa = require('../src/utils/normalizarNomePessoa');

async function executar() {
  assert.strictEqual(normalizarNomePessoa('0029'), null);
  assert.strictEqual(normalizarNomePessoa('  0035 Coimbra  '), '0035 Coimbra');
  assert.strictEqual(normalizarNomePessoa('Maria   da Silva'), 'Maria da Silva');
  assert.strictEqual(normalizarNomePessoa(''), null);
  assert.strictEqual(normalizarNomePessoa(null), null);

  const nomesInvalidos = await banco.query(`
    SELECT COUNT(*)::integer AS total
    FROM contatos
    WHERE nome IS NOT NULL
      AND TRIM(nome) !~ '[[:alpha:]]'
  `);
  assert.strictEqual(nomesInvalidos.rows[0].total, 0);

  const restricao = await banco.query(`
    SELECT 1
    FROM pg_catalog.pg_constraint AS restricao
    INNER JOIN pg_catalog.pg_class AS tabela
      ON tabela.oid = restricao.conrelid
    INNER JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = tabela.relnamespace
    WHERE namespace.nspname = 'public'
      AND tabela.relname = 'contatos'
      AND restricao.conname = 'contatos_nome_valido'
      AND restricao.contype = 'c'
  `);
  assert.strictEqual(restricao.rowCount, 1);

  console.log('Normalização de nomes: 7 verificações aprovadas.');
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
}).finally(function () {
  return banco.end();
});
