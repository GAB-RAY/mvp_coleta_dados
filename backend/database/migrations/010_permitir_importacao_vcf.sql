ALTER TABLE public.importacoes
  DROP CONSTRAINT importacoes_formato_valido;

ALTER TABLE public.importacoes
  ADD CONSTRAINT importacoes_formato_valido
  CHECK (formato IN ('csv', 'xlsx', 'vcf'));
