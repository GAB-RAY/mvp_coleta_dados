ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS atualizado_por_usuario_id BIGINT;

UPDATE public.campanhas
SET atualizado_por_usuario_id = COALESCE(
  atualizado_por_usuario_id,
  responsavel_usuario_id,
  criado_por_usuario_id
)
WHERE atualizado_por_usuario_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.campanhas
    WHERE atualizado_por_usuario_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Nao foi possivel identificar o atualizador de todas as campanhas existentes.';
  END IF;
END
$$;

ALTER TABLE public.campanhas
  ALTER COLUMN atualizado_por_usuario_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campanhas_atualizador_fkey'
      AND conrelid = 'public.campanhas'::regclass
  ) THEN
    ALTER TABLE public.campanhas
      ADD CONSTRAINT campanhas_atualizador_fkey
      FOREIGN KEY (atualizado_por_usuario_id)
      REFERENCES public.usuarios(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS campanhas_atualizador_indice
  ON public.campanhas (atualizado_por_usuario_id);
