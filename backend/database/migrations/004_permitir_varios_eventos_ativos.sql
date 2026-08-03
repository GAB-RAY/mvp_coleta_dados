DROP INDEX IF EXISTS public.eventos_apenas_um_ativo;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS restricao
    INNER JOIN pg_catalog.pg_class AS tabela
      ON tabela.oid = restricao.conrelid
    INNER JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = tabela.relnamespace
    WHERE namespace.nspname = 'public'
      AND tabela.relname = 'eventos'
      AND restricao.conname = 'eventos_apenas_um_ativo'
  ) THEN
    ALTER TABLE public.eventos
      DROP CONSTRAINT eventos_apenas_um_ativo;
  END IF;
END;
$$;
