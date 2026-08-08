ALTER TABLE public.backups_banco
  DROP CONSTRAINT backups_banco_formato_valido;

ALTER TABLE public.backups_banco
  ALTER COLUMN formato SET DEFAULT 'sql_dados';

ALTER TABLE public.backups_banco
  ADD CONSTRAINT backups_banco_formato_valido
  CHECK (formato IN ('custom', 'sql_dados'));
