CREATE TRIGGER campanha_lotes_atualizar_data
BEFORE UPDATE ON public.campanha_lotes
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_data_modificacao();

CREATE TRIGGER campanha_participacoes_atualizar_data
BEFORE UPDATE ON public.campanha_participacoes
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_data_modificacao();
