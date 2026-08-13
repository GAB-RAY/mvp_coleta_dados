ALTER TABLE public.sincronizacoes_limite_meta
  DROP CONSTRAINT sincronizacoes_limite_meta_origem_valida;

ALTER TABLE public.sincronizacoes_limite_meta
  ADD CONSTRAINT sincronizacoes_limite_meta_origem_valida CHECK (
    origem IN ('consulta_api', 'webhook', 'webhook_meta')
  );
