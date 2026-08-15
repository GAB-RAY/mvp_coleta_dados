const EXEMPLOS_PREVIA = {
  nome_contato: 'João',
  bairro: 'Copacabana',
  problema: 'Saneamento básico'
};

function valorExemploPrevia(configuracao) {
  if (!configuracao || !configuracao.origem) return null;
  if (configuracao.origem === 'fixo') {
    const valor = String(configuracao.valor || '').trim();
    return valor || null;
  }
  return EXEMPLOS_PREVIA[configuracao.origem] || null;
}

function substituirVariaveisPrevia(texto, configuracoes) {
  const lista = Array.isArray(configuracoes) ? configuracoes : [];
  return String(texto || '').replace(/\{\{(\d+)\}\}/g, function (marcador, numeroRecebido) {
    const indice = Number(numeroRecebido) - 1;
    const exemplo = valorExemploPrevia(lista[indice]);
    return exemplo || marcador;
  });
}

export { EXEMPLOS_PREVIA, substituirVariaveisPrevia, valorExemploPrevia };
