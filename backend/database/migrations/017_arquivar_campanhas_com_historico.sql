ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS arquivada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivada_por_usuario_id BIGINT;

ALTER TABLE public.campanhas
  DROP CONSTRAINT IF EXISTS campanhas_arquivador_fkey,
  ADD CONSTRAINT campanhas_arquivador_fkey
    FOREIGN KEY (arquivada_por_usuario_id) REFERENCES public.usuarios(id);

CREATE INDEX IF NOT EXISTS campanhas_arquivadas_indice
  ON public.campanhas (arquivada_em, criado_em DESC);
