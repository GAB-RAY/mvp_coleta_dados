require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');

async function sincronizar(cliente) {
  const estrutura = await cliente.query(`
    SELECT COUNT(*)::integer AS total
    FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name=ANY($1::text[])
  `, [['eventos', 'historico_eventos']]);

  if (estrutura.rows[0].total !== 2) {
    throw new Error('Estrutura de eventos incompatível. Nenhuma alteração foi aplicada.');
  }

  const restricoes = await cliente.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definicao
    FROM pg_constraint
    WHERE conname=ANY($1::text[])
  `, [['eventos_status_valido', 'historico_eventos_acao_valida']]);
  const definicoes = restricoes.rows.map(function (item) {
    return item.definicao;
  }).join(' ');

  if (definicoes.includes('excluido') && definicoes.includes('exclusao')) {
    return false;
  }

  await cliente.query(`
    ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_status_valido;
    ALTER TABLE eventos ADD CONSTRAINT eventos_status_valido CHECK (
      status IN ('rascunho', 'ativo', 'encerrado', 'excluido')
    );
    ALTER TABLE historico_eventos
      DROP CONSTRAINT IF EXISTS historico_eventos_acao_valida;
    ALTER TABLE historico_eventos
      ADD CONSTRAINT historico_eventos_acao_valida CHECK (
        tipo_acao IN ('criacao', 'edicao', 'ativacao', 'encerramento', 'exclusao')
      );
  `);
  return true;
}

async function executar() {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(
      "SELECT pg_advisory_xact_lock(hashtext('acorda-vk-exclusao-eventos-v1'))"
    );
    const alterado = await sincronizar(cliente);
    await cliente.query('COMMIT');
    console.log(alterado
      ? 'Estrutura de exclusão de eventos sincronizada com sucesso.'
      : 'Estrutura de exclusão de eventos já estava atualizada.');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro);
  process.exitCode = 1;
});
