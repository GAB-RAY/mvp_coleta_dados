require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');

async function sincronizar(cliente) {
  const verificacao = await cliente.query(
    "SELECT COUNT(*)::integer AS total FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
    [['usuarios', 'contatos', 'numeros_whatsapp', 'modelos_mensagem', 'comunicacoes']]
  );

  if (verificacao.rows[0].total !== 5) {
    throw new Error('Estrutura atual incompatível. Nenhuma alteração foi aplicada.');
  }

  await cliente.query(`
    CREATE TABLE IF NOT EXISTS campanhas (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nome VARCHAR(150) NOT NULL CHECK (LENGTH(TRIM(nome)) >= 2),
      descricao TEXT, ativo BOOLEAN NOT NULL DEFAULT TRUE,
      criado_por_usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
      atualizado_por_usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE comunicacoes
      ADD COLUMN IF NOT EXISTS campanha_id BIGINT,
      ADD COLUMN IF NOT EXISTS confirmado_por_usuario_id BIGINT,
      ADD COLUMN IF NOT EXISTS motivo_reenvio TEXT;
    CREATE TABLE IF NOT EXISTS historico_comunicacoes (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      comunicacao_id BIGINT NOT NULL REFERENCES comunicacoes(id) ON DELETE CASCADE,
      status_anterior VARCHAR(30), status_novo VARCHAR(30) NOT NULL,
      usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
      observacoes TEXT, criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE comunicacoes DROP CONSTRAINT IF EXISTS comunicacoes_status_valido;
    ALTER TABLE comunicacoes ADD CONSTRAINT comunicacoes_status_valido CHECK (status IN (
      'nao_contatado','preparada','enviada','aguardando_resposta','respondido',
      'em_atendimento','concluido','sem_resposta','nao_deseja_contato',
      'recusou_atendimento','numero_invalido'
    ));
    CREATE INDEX IF NOT EXISTS campanhas_ativo_nome_indice ON campanhas (ativo DESC,nome);
    CREATE INDEX IF NOT EXISTS comunicacoes_campanha_indice ON comunicacoes (campanha_id,contato_id,enviada_em DESC);
    CREATE INDEX IF NOT EXISTS comunicacoes_modelo_indice ON comunicacoes (modelo_id,criado_em DESC);
    CREATE INDEX IF NOT EXISTS comunicacoes_numero_indice ON comunicacoes (numero_whatsapp_id,criado_em DESC);
    CREATE INDEX IF NOT EXISTS comunicacoes_operador_indice ON comunicacoes (operador_usuario_id,criado_em DESC);
    CREATE INDEX IF NOT EXISTS historico_comunicacoes_comunicacao_indice ON historico_comunicacoes (comunicacao_id,criado_em DESC);
  `);

  await cliente.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='comunicacoes_campanha_fkey') THEN
        ALTER TABLE comunicacoes ADD CONSTRAINT comunicacoes_campanha_fkey
          FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='comunicacoes_confirmador_fkey') THEN
        ALTER TABLE comunicacoes ADD CONSTRAINT comunicacoes_confirmador_fkey
          FOREIGN KEY (confirmado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='campanhas_atualizar_data') THEN
        CREATE TRIGGER campanhas_atualizar_data BEFORE UPDATE ON campanhas
          FOR EACH ROW EXECUTE FUNCTION atualizar_data_modificacao();
      END IF;
    END
    $$;
  `);
}

async function executar() {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('acorda-vk-comunicacao-manual-v1'))");
    await sincronizar(cliente);
    await cliente.query('COMMIT');
    console.log('Estrutura de comunicação manual sincronizada com sucesso.');
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
