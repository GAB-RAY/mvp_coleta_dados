require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');

async function executar() {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    await cliente.query(
      "SELECT pg_advisory_xact_lock(hashtext('acorda-vk-compatibilidade-comunicacao-v1'))"
    );
    await cliente.query(`
      DO $$
      BEGIN
        IF to_regclass('public.numeros_whatsapp') IS NOT NULL THEN
          ALTER TABLE numeros_whatsapp
            ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;

        IF to_regclass('public.modelos_mensagem') IS NOT NULL THEN
          ALTER TABLE modelos_mensagem
            ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;

        IF to_regclass('public.campanhas') IS NOT NULL THEN
          ALTER TABLE campanhas
            ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;
      END
      $$;
    `);
    await cliente.query('COMMIT');
    console.log('Compatibilidade das estruturas de comunicação verificada.');
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
