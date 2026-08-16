LOCK TABLE public.contatos IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  quantidade_colisoes INTEGER;
BEGIN
  SELECT COUNT(*)::integer
  INTO quantidade_colisoes
  FROM (
    SELECT telefone_canonico
    FROM (
      SELECT CASE
        WHEN numeros LIKE '0055%' AND LENGTH(numeros) IN (14, 15)
          THEN SUBSTRING(numeros FROM 5)
        WHEN numeros LIKE '55%' AND LENGTH(numeros) IN (12, 13)
          THEN SUBSTRING(numeros FROM 3)
        ELSE numeros
      END AS telefone_canonico
      FROM (
        SELECT REGEXP_REPLACE(
          COALESCE(telefone_normalizado, telefone, ''),
          '[^0-9]',
          '',
          'g'
        ) AS numeros
        FROM public.contatos
      ) AS telefones
    ) AS canonicos
    GROUP BY telefone_canonico
    HAVING COUNT(*) > 1
  ) AS colisoes;

  IF quantidade_colisoes > 0 THEN
    RAISE EXCEPTION
      'Existem % grupos de contatos com o mesmo telefone canonico. Revise-os individualmente antes de aplicar esta migration.',
      quantidade_colisoes;
  END IF;
END $$;

WITH telefones AS (
  SELECT
    id,
    REGEXP_REPLACE(
      COALESCE(telefone_normalizado, telefone, ''),
      '[^0-9]',
      '',
      'g'
    ) AS numeros
  FROM public.contatos
), canonicos AS (
  SELECT
    id,
    CASE
      WHEN numeros LIKE '0055%' AND LENGTH(numeros) IN (14, 15)
        THEN SUBSTRING(numeros FROM 5)
      WHEN numeros LIKE '55%' AND LENGTH(numeros) IN (12, 13)
        THEN SUBSTRING(numeros FROM 3)
      ELSE numeros
    END AS telefone_canonico
  FROM telefones
)
UPDATE public.contatos AS contato
SET telefone_normalizado = canonicos.telefone_canonico
FROM canonicos
WHERE contato.id = canonicos.id
  AND contato.telefone_normalizado IS DISTINCT FROM canonicos.telefone_canonico;

CREATE UNIQUE INDEX IF NOT EXISTS contatos_telefone_normalizado_unico
  ON public.contatos (telefone_normalizado);
