DO $$
DECLARE
  estruturas_ausentes TEXT;
BEGIN
  WITH esperadas(tabela, coluna) AS (
    VALUES
      ('aceites_privacidade', 'contato_id'),
      ('backups_banco', 'id'),
      ('bairros', 'ativo'),
      ('campanhas', 'ativo'),
      ('comunicacoes', 'status'),
      ('consentimentos', 'estado'),
      ('contato_eventos', 'evento_id'),
      ('contatos', 'telefone_normalizado'),
      ('eventos', 'status'),
      ('historico_comunicacoes', 'comunicacao_id'),
      ('historico_contatos', 'contato_id'),
      ('historico_eventos', 'evento_id'),
      ('importacao_linhas', 'importacao_id'),
      ('importacoes', 'status'),
      ('modelos_mensagem', 'ativo'),
      ('numeros_whatsapp', 'ativo'),
      ('origens', 'ativa'),
      ('solicitacoes_exclusao', 'status'),
      ('tentativas_login', 'email_informado'),
      ('textos_formulario', 'ativo'),
      ('usuarios', 'ativo')
  )
  SELECT STRING_AGG(esperadas.tabela || '.' || esperadas.coluna, ', ' ORDER BY esperadas.tabela)
  INTO estruturas_ausentes
  FROM esperadas
  LEFT JOIN information_schema.columns AS atual
    ON atual.table_schema = 'public'
    AND atual.table_name = esperadas.tabela
    AND atual.column_name = esperadas.coluna
  WHERE atual.column_name IS NULL;

  IF estruturas_ausentes IS NOT NULL THEN
    RAISE EXCEPTION
      'Estrutura atual divergente. Tabelas ou colunas ausentes: %',
      estruturas_ausentes;
  END IF;

  IF to_regprocedure('public.atualizar_data_modificacao()') IS NULL THEN
    RAISE EXCEPTION
      'Estrutura atual divergente. Funcao atualizar_data_modificacao ausente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS restricao
    INNER JOIN pg_catalog.pg_class AS tabela
      ON tabela.oid = restricao.conrelid
    INNER JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = tabela.relnamespace
    WHERE namespace.nspname = 'public'
      AND tabela.relname = 'contato_eventos'
      AND restricao.conname = 'contato_eventos_contato_evento_unicos'
      AND restricao.contype = 'u'
  ) THEN
    RAISE EXCEPTION
      'Estrutura atual divergente. Unicidade entre contato e evento ausente.';
  END IF;
END;
$$;
