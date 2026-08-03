INSERT INTO public.historico_contatos (
  contato_id,
  tipo_evento,
  dados_anteriores,
  dados_novos,
  origem_id,
  registrado_por_usuario_id
)
SELECT
  contato.id,
  'normalizacao_nome_importado',
  jsonb_build_object('nome', contato.nome),
  jsonb_build_object('nome', NULL),
  contato.origem_id,
  NULL
FROM public.contatos AS contato
WHERE contato.nome IS NOT NULL
  AND TRIM(contato.nome) !~ '[[:alpha:]]';

UPDATE public.contatos
SET nome = NULL
WHERE nome IS NOT NULL
  AND TRIM(nome) !~ '[[:alpha:]]';

ALTER TABLE public.contatos
  DROP CONSTRAINT contatos_nome_nao_vazio;

ALTER TABLE public.contatos
  ADD CONSTRAINT contatos_nome_valido CHECK (
    nome IS NULL
    OR (
      LENGTH(TRIM(nome)) >= 2
      AND TRIM(nome) ~ '[[:alpha:]]'
    )
  );
