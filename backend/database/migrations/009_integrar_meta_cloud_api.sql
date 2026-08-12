ALTER TABLE public.modelos_mensagem
  ADD COLUMN IF NOT EXISTS meta_nome VARCHAR(512),
  ADD COLUMN IF NOT EXISTS meta_idioma VARCHAR(35),
  ADD COLUMN IF NOT EXISTS meta_categoria VARCHAR(50),
  ADD COLUMN IF NOT EXISTS meta_status VARCHAR(20) NOT NULL DEFAULT 'rascunho';

ALTER TABLE public.modelos_mensagem
  DROP CONSTRAINT IF EXISTS modelos_mensagem_meta_status_valido;

ALTER TABLE public.modelos_mensagem
  ADD CONSTRAINT modelos_mensagem_meta_status_valido
  CHECK (meta_status IN ('rascunho', 'em_analise', 'aprovado', 'rejeitado'));

CREATE INDEX IF NOT EXISTS modelos_mensagem_meta_status_indice
  ON public.modelos_mensagem (meta_status, ativo);
