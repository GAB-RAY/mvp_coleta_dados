UPDATE public.contatos AS contato
SET telefone = CASE
  WHEN LENGTH(dados.numeros) = 13 AND LEFT(dados.numeros, 2) = '55'
    THEN '(' || SUBSTRING(dados.numeros FROM 3 FOR 2) || ') ' ||
      SUBSTRING(dados.numeros FROM 5 FOR 5) || '-' ||
      SUBSTRING(dados.numeros FROM 10 FOR 4)
  WHEN LENGTH(dados.numeros) = 12 AND LEFT(dados.numeros, 2) = '55'
    THEN '(' || SUBSTRING(dados.numeros FROM 3 FOR 2) || ') ' ||
      SUBSTRING(dados.numeros FROM 5 FOR 4) || '-' ||
      SUBSTRING(dados.numeros FROM 9 FOR 4)
  WHEN LENGTH(dados.numeros) = 11
    THEN '(' || SUBSTRING(dados.numeros FROM 1 FOR 2) || ') ' ||
      SUBSTRING(dados.numeros FROM 3 FOR 5) || '-' ||
      SUBSTRING(dados.numeros FROM 8 FOR 4)
  WHEN LENGTH(dados.numeros) = 10
    THEN '(' || SUBSTRING(dados.numeros FROM 1 FOR 2) || ') ' ||
      SUBSTRING(dados.numeros FROM 3 FOR 4) || '-' ||
      SUBSTRING(dados.numeros FROM 7 FOR 4)
  ELSE '+' || dados.numeros
END
FROM (
  SELECT
    id,
    REGEXP_REPLACE(telefone_normalizado, '[^0-9]', '', 'g') AS numeros
  FROM public.contatos
  WHERE telefone_normalizado IS NOT NULL
) AS dados
WHERE contato.id = dados.id
  AND dados.numeros <> '';
