function normalizarTelefone(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  let numeroBrasileiro = digitos;

  if (numeroBrasileiro.startsWith('0055') && [14, 15].includes(numeroBrasileiro.length)) {
    numeroBrasileiro = numeroBrasileiro.slice(4);
  } else if (numeroBrasileiro.startsWith('55') && [12, 13].includes(numeroBrasileiro.length)) {
    numeroBrasileiro = numeroBrasileiro.slice(2);
  }

  return numeroBrasileiro;
}

module.exports = normalizarTelefone;
