LOCK TABLE public.campanhas IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.campanhas
  DROP CONSTRAINT IF EXISTS campanhas_status_valido,
  DROP CONSTRAINT IF EXISTS campanhas_status_novo_valido;

UPDATE public.campanhas
SET status = 'pronta',
    pronta_em = COALESCE(pronta_em, atualizado_em, criado_em),
    atualizado_em = CURRENT_TIMESTAMP
WHERE status = 'agendada';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.campanhas
    WHERE status NOT IN (
      'rascunho', 'pronta', 'ativa', 'pausada', 'concluida', 'cancelada'
    )
  ) THEN
    RAISE EXCEPTION 'Existem campanhas com status desconhecido; migration cancelada.';
  END IF;
END
$$;

ALTER TABLE public.campanhas
  ADD CONSTRAINT campanhas_status_valido CHECK (
    status IN ('rascunho','pronta','ativa','pausada','concluida','cancelada')
  );
