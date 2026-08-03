require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');

async function verificarEstruturaBase(cliente) {
  const resultado = await cliente.query(
    `SELECT COUNT(*)::integer AS total
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [['usuarios', 'contatos', 'eventos']]
  );

  if (resultado.rows[0].total !== 3) {
    throw new Error('Estrutura base incompatível. Nenhuma alteração foi aplicada.');
  }

  const funcao = await cliente.query(
    "SELECT to_regprocedure('public.atualizar_data_modificacao()') IS NOT NULL AS existe"
  );

  if (!funcao.rows[0].existe) {
    throw new Error('Função de atualização de datas não encontrada.');
  }
}

async function criarTabelas(cliente) {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS numeros_whatsapp (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      numero VARCHAR(30) NOT NULL,
      numero_normalizado VARCHAR(20) NOT NULL,
      responsavel VARCHAR(150) NOT NULL,
      observacao TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      criado_por_usuario_id BIGINT NOT NULL,
      atualizado_por_usuario_id BIGINT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT numeros_whatsapp_nome_valido CHECK (LENGTH(TRIM(nome)) >= 2),
      CONSTRAINT numeros_whatsapp_numero_valido CHECK (numero_normalizado ~ '^[0-9]{10,15}$'),
      CONSTRAINT numeros_whatsapp_criador_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios(id),
      CONSTRAINT numeros_whatsapp_atualizador_fkey FOREIGN KEY (atualizado_por_usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS modelos_mensagem (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      categoria VARCHAR(100) NOT NULL,
      texto TEXT NOT NULL,
      evento_id BIGINT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      criado_por_usuario_id BIGINT NOT NULL,
      atualizado_por_usuario_id BIGINT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT modelos_mensagem_nome_valido CHECK (LENGTH(TRIM(nome)) >= 2),
      CONSTRAINT modelos_mensagem_categoria_valida CHECK (LENGTH(TRIM(categoria)) >= 2),
      CONSTRAINT modelos_mensagem_texto_valido CHECK (LENGTH(TRIM(texto)) >= 2),
      CONSTRAINT modelos_mensagem_evento_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE SET NULL,
      CONSTRAINT modelos_mensagem_criador_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios(id),
      CONSTRAINT modelos_mensagem_atualizador_fkey FOREIGN KEY (atualizado_por_usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS campanhas (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      descricao TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      criado_por_usuario_id BIGINT NOT NULL,
      atualizado_por_usuario_id BIGINT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT campanhas_nome_valido CHECK (LENGTH(TRIM(nome)) >= 2),
      CONSTRAINT campanhas_criador_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios(id),
      CONSTRAINT campanhas_atualizador_fkey FOREIGN KEY (atualizado_por_usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS comunicacoes (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      contato_id BIGINT NOT NULL,
      evento_id BIGINT,
      modelo_id BIGINT,
      campanha_id BIGINT,
      numero_whatsapp_id BIGINT NOT NULL,
      operador_usuario_id BIGINT NOT NULL,
      confirmado_por_usuario_id BIGINT,
      texto_preparado TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'preparada',
      enviada_em TIMESTAMPTZ,
      respondida_em TIMESTAMPTZ,
      observacoes TEXT,
      motivo_reenvio TEXT,
      proxima_acao TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT comunicacoes_texto_valido CHECK (LENGTH(TRIM(texto_preparado)) >= 2),
      CONSTRAINT comunicacoes_status_valido CHECK (status IN (
        'nao_contatado', 'preparada', 'enviada', 'aguardando_resposta',
        'respondido', 'em_atendimento', 'concluido', 'sem_resposta',
        'nao_deseja_contato', 'recusou_atendimento', 'numero_invalido'
      )),
      CONSTRAINT comunicacoes_envio_coerente CHECK (
        status NOT IN ('enviada', 'aguardando_resposta', 'respondido', 'em_atendimento', 'concluido', 'sem_resposta')
        OR enviada_em IS NOT NULL
      ),
      CONSTRAINT comunicacoes_contato_fkey FOREIGN KEY (contato_id) REFERENCES contatos(id) ON DELETE CASCADE,
      CONSTRAINT comunicacoes_evento_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE SET NULL,
      CONSTRAINT comunicacoes_modelo_fkey FOREIGN KEY (modelo_id) REFERENCES modelos_mensagem(id) ON DELETE SET NULL,
      CONSTRAINT comunicacoes_campanha_fkey FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL,
      CONSTRAINT comunicacoes_numero_fkey FOREIGN KEY (numero_whatsapp_id) REFERENCES numeros_whatsapp(id),
      CONSTRAINT comunicacoes_operador_fkey FOREIGN KEY (operador_usuario_id) REFERENCES usuarios(id),
      CONSTRAINT comunicacoes_confirmador_fkey FOREIGN KEY (confirmado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS historico_comunicacoes (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      comunicacao_id BIGINT NOT NULL,
      status_anterior VARCHAR(30),
      status_novo VARCHAR(30) NOT NULL,
      usuario_id BIGINT NOT NULL,
      observacoes TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT historico_comunicacoes_comunicacao_fkey FOREIGN KEY (comunicacao_id) REFERENCES comunicacoes(id) ON DELETE CASCADE,
      CONSTRAINT historico_comunicacoes_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);
}

async function criarIndicesETriggers(cliente) {
  await cliente.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS numeros_whatsapp_numero_unico ON numeros_whatsapp (numero_normalizado);
    CREATE INDEX IF NOT EXISTS modelos_mensagem_evento_indice ON modelos_mensagem (evento_id, ativo);
    CREATE INDEX IF NOT EXISTS campanhas_ativo_nome_indice ON campanhas (ativo DESC, nome);
    CREATE INDEX IF NOT EXISTS comunicacoes_contato_indice ON comunicacoes (contato_id, criado_em DESC);
    CREATE INDEX IF NOT EXISTS comunicacoes_evento_indice ON comunicacoes (evento_id, criado_em DESC);
    CREATE INDEX IF NOT EXISTS comunicacoes_status_indice ON comunicacoes (status, criado_em DESC);
    CREATE INDEX IF NOT EXISTS comunicacoes_campanha_indice ON comunicacoes (campanha_id, contato_id, enviada_em DESC);
    CREATE INDEX IF NOT EXISTS comunicacoes_modelo_indice ON comunicacoes (modelo_id, criado_em DESC);
    CREATE INDEX IF NOT EXISTS comunicacoes_numero_indice ON comunicacoes (numero_whatsapp_id, criado_em DESC);
    CREATE INDEX IF NOT EXISTS comunicacoes_operador_indice ON comunicacoes (operador_usuario_id, criado_em DESC);
    CREATE INDEX IF NOT EXISTS historico_comunicacoes_comunicacao_indice ON historico_comunicacoes (comunicacao_id, criado_em DESC);

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'numeros_whatsapp_atualizar_data') THEN
        CREATE TRIGGER numeros_whatsapp_atualizar_data BEFORE UPDATE ON numeros_whatsapp
          FOR EACH ROW EXECUTE FUNCTION atualizar_data_modificacao();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'modelos_mensagem_atualizar_data') THEN
        CREATE TRIGGER modelos_mensagem_atualizar_data BEFORE UPDATE ON modelos_mensagem
          FOR EACH ROW EXECUTE FUNCTION atualizar_data_modificacao();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'campanhas_atualizar_data') THEN
        CREATE TRIGGER campanhas_atualizar_data BEFORE UPDATE ON campanhas
          FOR EACH ROW EXECUTE FUNCTION atualizar_data_modificacao();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'comunicacoes_atualizar_data') THEN
        CREATE TRIGGER comunicacoes_atualizar_data BEFORE UPDATE ON comunicacoes
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
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('acorda-vk-estrutura-producao-v1'))");
    await verificarEstruturaBase(cliente);
    await criarTabelas(cliente);
    await criarIndicesETriggers(cliente);
    await cliente.query('COMMIT');
    console.log('Estrutura de comunicação disponível.');
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
