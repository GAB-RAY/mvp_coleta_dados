function normalizarTelefone(telefone) {
  return telefone.replace(/\D/g, '');
}

module.exports = normalizarTelefone;
