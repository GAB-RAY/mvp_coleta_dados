function normalizarNomePessoa(nomeRecebido) {
  if (typeof nomeRecebido !== 'string') {
    return null;
  }

  const nome = nomeRecebido.trim().replace(/\s+/g, ' ');

  if (!nome || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(nome)) {
    return null;
  }

  return nome;
}

module.exports = normalizarNomePessoa;
