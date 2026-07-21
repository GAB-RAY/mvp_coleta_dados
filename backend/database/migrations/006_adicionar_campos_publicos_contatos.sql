ALTER TABLE contatos
  ADD COLUMN idade SMALLINT,
  ADD COLUMN descricao_problema TEXT,
  ADD COLUMN participou_eleicao_anterior VARCHAR(30);

ALTER TABLE contatos
  ADD CONSTRAINT contatos_idade_valida CHECK (
    idade IS NULL OR idade BETWEEN 16 AND 120
  ),
  ADD CONSTRAINT contatos_participou_eleicao_anterior_valida CHECK (
    participou_eleicao_anterior IS NULL
    OR participou_eleicao_anterior IN (
      'sim',
      'nao',
      'prefiro_nao_informar'
    )
  );

COMMENT ON COLUMN contatos.idade IS
  'Idade informada no cadastro. Registros legados permanecem NULL.';

COMMENT ON COLUMN contatos.problema IS
  'Categoria do problema. A coluna foi preservada por compatibilidade.';

COMMENT ON COLUMN contatos.descricao_problema IS
  'Descrição opcional complementar à categoria do problema.';

COMMENT ON COLUMN contatos.participou_eleicao_anterior IS
  'Resposta opcional à pergunta: Você votou na última eleição?';
