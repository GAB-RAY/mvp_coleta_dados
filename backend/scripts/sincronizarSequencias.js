require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');

async function executar() {
  const colunas = await banco.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND is_identity = 'YES'
     ORDER BY table_name, column_name`
  );
  let indice;

  for (indice = 0; indice < colunas.rows.length; indice += 1) {
    const tabela = colunas.rows[indice].table_name;
    const coluna = colunas.rows[indice].column_name;

    if (!/^[a-z0-9_]+$/.test(tabela) || !/^[a-z0-9_]+$/.test(coluna)) {
      throw new Error('Identificador de sequência inválido.');
    }

    const resultado = await banco.query(
      'SELECT MAX("' + coluna + '")::bigint AS maior FROM public."' + tabela + '"'
    );
    const maior = resultado.rows[0].maior;
    const sequencia = await banco.query(
      'SELECT pg_get_serial_sequence($1, $2) AS nome',
      ['public.' + tabela, coluna]
    );

    if (maior === null) {
      await banco.query('SELECT setval($1::regclass, 1, FALSE)', [sequencia.rows[0].nome]);
    } else {
      await banco.query('SELECT setval($1::regclass, $2, TRUE)', [sequencia.rows[0].nome, maior]);
    }
  }

  console.log('Sequências sincronizadas: ' + colunas.rowCount + '.');
  await banco.end();
}

executar().catch(function (erro) {
  console.error(erro.message);
  process.exitCode = 1;
});
