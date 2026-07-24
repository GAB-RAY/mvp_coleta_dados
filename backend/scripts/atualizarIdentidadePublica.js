require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');

const TEXTO_AVISO_PRIVACIDADE =
  'Li o Aviso de Privacidade e autorizo o tratamento dos dados informados para participação no projeto Acorda VK.';

async function atualizarIdentidadePublica() {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    await cliente.query(
      `
        UPDATE textos_formulario
        SET ativo = FALSE,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE tipo = 'aviso_privacidade'
          AND ativo = TRUE
          AND (versao <> 'aviso_privacidade_v2' OR texto <> $1)
      `,
      [TEXTO_AVISO_PRIVACIDADE]
    );
    await cliente.query(
      `
        INSERT INTO textos_formulario (tipo, versao, texto, ativo)
        VALUES ('aviso_privacidade', 'aviso_privacidade_v2', $1, TRUE)
        ON CONFLICT (tipo, versao)
        DO UPDATE SET
          texto = EXCLUDED.texto,
          ativo = TRUE,
          atualizado_em = CURRENT_TIMESTAMP
      `,
      [TEXTO_AVISO_PRIVACIDADE]
    );
    const resultadoVersoes = await cliente.query(
      `
        SELECT
          COUNT(*)::integer AS total_versoes,
          COUNT(*) FILTER (WHERE ativo = TRUE)::integer AS total_ativas
        FROM textos_formulario
        WHERE tipo = 'aviso_privacidade'
      `
    );
    await cliente.query('COMMIT');
    console.log('Identidade pública atualizada para Acorda VK. Versões anteriores preservadas.');
    console.log(
      'Avisos de privacidade: ' + resultadoVersoes.rows[0].total_versoes +
      ' versões, ' + resultadoVersoes.rows[0].total_ativas + ' ativa.'
    );
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
    await banco.end();
  }
}

atualizarIdentidadePublica().catch(function (erro) {
  console.error(erro.message);
  process.exitCode = 1;
});
