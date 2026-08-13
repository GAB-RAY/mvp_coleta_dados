ALTER TABLE public.modelos_mensagem
  ALTER COLUMN criado_por_usuario_id DROP NOT NULL,
  ALTER COLUMN atualizado_por_usuario_id DROP NOT NULL;

ALTER TABLE public.historico_modelos_mensagem_meta
  DROP CONSTRAINT IF EXISTS historico_modelos_mensagem_meta_acao_valida,
  DROP CONSTRAINT IF EXISTS historico_modelos_mensagem_meta_origem_valida;

ALTER TABLE public.historico_modelos_mensagem_meta
  ADD CONSTRAINT historico_modelos_mensagem_meta_acao_valida CHECK (
    acao IN ('rascunho_criado', 'rascunho_atualizado', 'configuracao_envio', 'submissao',
      'sincronizacao', 'vinculo_inicial', 'webhook_status')
  ),
  ADD CONSTRAINT historico_modelos_mensagem_meta_origem_valida CHECK (
    origem IN ('sistema', 'api_meta', 'sincronizacao_meta', 'webhook_meta')
  );
