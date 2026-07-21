import requisitar from './api';

async function cadastrarContato(dadosDoContato) {
  return requisitar('/api/publico/contatos', {
    method: 'POST',
    body: JSON.stringify(dadosDoContato)
  });
}

async function listarContatos(filtros, pagina, limite, sinal) {
  const parametros = new URLSearchParams();

  if (filtros.nome) {
    parametros.set('nome', filtros.nome);
  }

  if (filtros.telefone) {
    parametros.set('telefone', filtros.telefone);
  }

  if (filtros.bairro) {
    parametros.set('bairro', filtros.bairro);
  }

  if (filtros.problema) {
    parametros.set('problema', filtros.problema);
  }

  if (filtros.consentimentoWhatsapp) {
    parametros.set('consentimentoWhatsapp', filtros.consentimentoWhatsapp);
  }

  if (filtros.consentimentoLigacoes) {
    parametros.set('consentimentoLigacoes', filtros.consentimentoLigacoes);
  }

  if (filtros.origem) {
    parametros.set('origem', filtros.origem);
  }

  if (filtros.status) {
    parametros.set('status', filtros.status);
  }

  parametros.set('pagina', String(pagina));
  parametros.set('limite', String(limite));

  return requisitar('/api/admin/contatos?' + parametros.toString(), {
    method: 'GET',
    autenticado: true,
    signal: sinal
  });
}

export {
  cadastrarContato,
  listarContatos
};
