CREATE TABLE public.sincronizacoes_limite_meta (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  limite_anterior INTEGER,
  limite_novo INTEGER,
  tier_anterior VARCHAR(40),
  tier_novo VARCHAR(40),
  origem VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL,
  codigo_erro VARCHAR(80),
  usuario_id BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sincronizacoes_limite_meta_limite_anterior_valido CHECK (
    limite_anterior IS NULL OR limite_anterior > 0
  ),
  CONSTRAINT sincronizacoes_limite_meta_limite_novo_valido CHECK (
    limite_novo IS NULL OR limite_novo > 0
  ),
  CONSTRAINT sincronizacoes_limite_meta_origem_valida CHECK (
    origem IN ('consulta_api', 'webhook')
  ),
  CONSTRAINT sincronizacoes_limite_meta_status_valido CHECK (
    status IN ('sucesso', 'falha')
  ),
  CONSTRAINT sincronizacoes_limite_meta_sucesso_valido CHECK (
    status <> 'sucesso' OR tier_novo IS NOT NULL
  )
);

CREATE INDEX sincronizacoes_limite_meta_sucesso_indice
  ON public.sincronizacoes_limite_meta (id DESC)
  WHERE status = 'sucesso';
