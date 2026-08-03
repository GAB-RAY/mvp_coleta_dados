DO $$
BEGIN
  ALTER TABLE public.contato_eventos
    ADD COLUMN IF NOT EXISTS status_inscricao VARCHAR(30) DEFAULT 'inscrito';

  UPDATE public.contato_eventos
  SET status_inscricao = 'inscrito'
  WHERE status_inscricao IS NULL;

  ALTER TABLE public.contato_eventos
    ALTER COLUMN status_inscricao SET NOT NULL;

  ALTER TABLE public.contato_eventos
    ADD COLUMN IF NOT EXISTS cadastrado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

  UPDATE public.contato_eventos
  SET cadastrado_em = CURRENT_TIMESTAMP
  WHERE cadastrado_em IS NULL;

  ALTER TABLE public.contato_eventos
    ALTER COLUMN cadastrado_em SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS restricao
    INNER JOIN pg_catalog.pg_class AS tabela
      ON tabela.oid = restricao.conrelid
    INNER JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = tabela.relnamespace
    WHERE namespace.nspname = 'public'
      AND tabela.relname = 'contato_eventos'
      AND restricao.conname = 'contato_eventos_status_valido'
  ) THEN
    ALTER TABLE public.contato_eventos
      ADD CONSTRAINT contato_eventos_status_valido CHECK (
        status_inscricao IN ('inscrito', 'confirmado', 'presente', 'cancelado')
      );
  END IF;

  CREATE INDEX IF NOT EXISTS contato_eventos_evento_id_indice
    ON public.contato_eventos (evento_id, cadastrado_em DESC);

  CREATE INDEX IF NOT EXISTS contato_eventos_contato_id_indice
    ON public.contato_eventos (contato_id);
END;
$$;

DO $$
DECLARE
  total_comunicacoes INTEGER;
BEGIN
  SELECT COUNT(*)::integer
  INTO total_comunicacoes
  FROM public.comunicacoes;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'comunicacoes'
      AND column_name = 'contato_id'
  ) AND total_comunicacoes > 0 THEN
    RAISE EXCEPTION
      'Nao e seguro adicionar comunicacoes.contato_id: existem registros sem vinculo recuperavel.';
  END IF;

  ALTER TABLE public.comunicacoes
    ADD COLUMN IF NOT EXISTS contato_id BIGINT;

  ALTER TABLE public.comunicacoes
    ADD COLUMN IF NOT EXISTS evento_id BIGINT;

  ALTER TABLE public.comunicacoes
    ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

  UPDATE public.comunicacoes
  SET criado_em = CURRENT_TIMESTAMP
  WHERE criado_em IS NULL;

  ALTER TABLE public.comunicacoes
    ALTER COLUMN criado_em SET NOT NULL;

  CREATE INDEX IF NOT EXISTS comunicacoes_contato_indice
    ON public.comunicacoes (contato_id, criado_em DESC);

  CREATE INDEX IF NOT EXISTS comunicacoes_evento_indice
    ON public.comunicacoes (evento_id, criado_em DESC);
END;
$$;
