ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS finalidade TEXT,
  ADD COLUMN IF NOT EXISTS modelo_id BIGINT,
  ADD COLUMN IF NOT EXISTS filtros_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS responsavel_usuario_id BIGINT,
  ADD COLUMN IF NOT EXISTS pronta_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ativada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pausada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ;

UPDATE public.campanhas
SET finalidade = COALESCE(NULLIF(BTRIM(descricao), ''), 'Campanha cadastrada antes da estrutura de lotes.'),
    status = CASE WHEN ativo THEN 'rascunho' ELSE 'cancelada' END,
    responsavel_usuario_id = criado_por_usuario_id
WHERE finalidade IS NULL
   OR status IS NULL
   OR responsavel_usuario_id IS NULL;

ALTER TABLE public.campanhas
  ALTER COLUMN finalidade SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN responsavel_usuario_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campanhas_status_novo_valido'
  ) THEN
    ALTER TABLE public.campanhas ADD CONSTRAINT campanhas_status_novo_valido
      CHECK (status IN ('rascunho','pronta','ativa','pausada','concluida','cancelada'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campanhas_modelo_novo_fkey'
  ) THEN
    ALTER TABLE public.campanhas ADD CONSTRAINT campanhas_modelo_novo_fkey
      FOREIGN KEY (modelo_id) REFERENCES public.modelos_mensagem(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campanhas_responsavel_novo_fkey'
  ) THEN
    ALTER TABLE public.campanhas ADD CONSTRAINT campanhas_responsavel_novo_fkey
      FOREIGN KEY (responsavel_usuario_id) REFERENCES public.usuarios(id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.campanha_lotes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campanha_id BIGINT NOT NULL REFERENCES public.campanhas(id),
  tamanho_solicitado INTEGER NOT NULL,
  tamanho_efetivo INTEGER NOT NULL,
  ordem INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'reservado',
  chave_idempotencia VARCHAR(100) NOT NULL,
  criado_por_usuario_id BIGINT NOT NULL REFERENCES public.usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campanha_lotes_tamanhos_validos CHECK (
    tamanho_solicitado BETWEEN 1 AND 10000
    AND tamanho_efetivo BETWEEN 1 AND tamanho_solicitado
  ),
  CONSTRAINT campanha_lotes_status_valido CHECK (
    status IN ('reservado','processando','processado','cancelado')
  ),
  CONSTRAINT campanha_lotes_ordem_unica UNIQUE (campanha_id, ordem),
  CONSTRAINT campanha_lotes_idempotencia_unica UNIQUE (campanha_id, chave_idempotencia)
);

CREATE TABLE IF NOT EXISTS public.campanha_participacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campanha_id BIGINT NOT NULL REFERENCES public.campanhas(id),
  contato_id BIGINT NOT NULL REFERENCES public.contatos(id),
  lote_original_id BIGINT NOT NULL REFERENCES public.campanha_lotes(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  reservado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campanha_participacoes_status_valido CHECK (
    status IN ('pendente','enviando','enviada','entregue','lida','falhou')
  ),
  CONSTRAINT campanha_participacao_unica UNIQUE (campanha_id, contato_id)
);

CREATE TABLE IF NOT EXISTS public.campanha_tentativas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  participacao_id BIGINT NOT NULL REFERENCES public.campanha_participacoes(id),
  numero_tentativa INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  identificador_externo VARCHAR(255),
  codigo_erro_externo VARCHAR(80),
  titulo_erro VARCHAR(200),
  descricao_erro TEXT,
  categoria_erro VARCHAR(100),
  permite_nova_tentativa BOOLEAN NOT NULL DEFAULT FALSE,
  iniciada_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalizada_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campanha_tentativas_numero_valido CHECK (numero_tentativa > 0),
  CONSTRAINT campanha_tentativas_status_valido CHECK (
    status IN ('pendente','enviando','enviada','entregue','lida','falhou')
  ),
  CONSTRAINT campanha_tentativas_numero_unico UNIQUE (participacao_id, numero_tentativa),
  CONSTRAINT campanha_tentativas_externo_unico UNIQUE (identificador_externo)
);

CREATE TABLE IF NOT EXISTS public.historico_status_mensageria (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  participacao_id BIGINT NOT NULL REFERENCES public.campanha_participacoes(id),
  tentativa_id BIGINT REFERENCES public.campanha_tentativas(id),
  status_anterior VARCHAR(20),
  status_novo VARCHAR(20) NOT NULL,
  origem VARCHAR(30) NOT NULL,
  codigo_erro_sanitizado VARCHAR(80),
  descricao_erro_sanitizada TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historico_status_mensageria_status_valido CHECK (
    status_novo IN ('pendente','enviando','enviada','entregue','lida','falhou')
    AND (status_anterior IS NULL OR status_anterior IN ('pendente','enviando','enviada','entregue','lida','falhou'))
  ),
  CONSTRAINT historico_status_mensageria_origem_valida CHECK (
    origem IN ('reserva','processamento','webhook','reprocessamento','administrativo')
  )
);

CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  chave VARCHAR(100) PRIMARY KEY,
  valor_inteiro INTEGER NOT NULL,
  atualizado_por_usuario_id BIGINT REFERENCES public.usuarios(id),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT configuracoes_sistema_valor_positivo CHECK (valor_inteiro > 0)
);

CREATE TABLE IF NOT EXISTS public.historico_configuracoes_sistema (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chave VARCHAR(100) NOT NULL,
  valor_anterior INTEGER NOT NULL,
  valor_novo INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  usuario_id BIGINT NOT NULL REFERENCES public.usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historico_configuracoes_motivo_valido CHECK (LENGTH(BTRIM(motivo)) >= 3)
);

CREATE TABLE IF NOT EXISTS public.eventos_webhook_mensageria (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identificador_externo VARCHAR(255) NOT NULL,
  tipo_evento VARCHAR(80) NOT NULL,
  processado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT eventos_webhook_identificador_unico UNIQUE (identificador_externo)
);

INSERT INTO public.configuracoes_sistema (chave, valor_inteiro)
VALUES ('limite_mensagens_24h', 250)
ON CONFLICT (chave) DO NOTHING;

CREATE INDEX IF NOT EXISTS campanhas_status_indice
  ON public.campanhas (status, criado_em DESC);
CREATE INDEX IF NOT EXISTS campanha_lotes_campanha_indice
  ON public.campanha_lotes (campanha_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS campanha_participacoes_lote_indice
  ON public.campanha_participacoes (lote_original_id, id);
CREATE INDEX IF NOT EXISTS campanha_participacoes_status_indice
  ON public.campanha_participacoes (campanha_id, status);
CREATE INDEX IF NOT EXISTS campanha_participacoes_reserva_indice
  ON public.campanha_participacoes (reservado_em);
CREATE INDEX IF NOT EXISTS campanha_tentativas_status_indice
  ON public.campanha_tentativas (status, criado_em);
CREATE INDEX IF NOT EXISTS historico_status_participacao_indice
  ON public.historico_status_mensageria (participacao_id, criado_em DESC);

