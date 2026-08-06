function obterNumerosBrasileiros(numeros) {
  if (numeros.startsWith('55') && (numeros.length === 12 || numeros.length === 13)) {
    return numeros.slice(2);
  }

  return numeros;
}

function formatarTelefone(telefone) {
  if (telefone === null || telefone === undefined || telefone === '') {
    return '';
  }

  const numeros = String(telefone).replace(/\D/g, '');
  const numerosBrasileiros = obterNumerosBrasileiros(numeros);

  if (numerosBrasileiros.length === 10) {
    return numerosBrasileiros.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }

  if (numerosBrasileiros.length === 11) {
    return numerosBrasileiros.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }

  if (numeros.length > 0) {
    return '+' + numeros;
  }

  return String(telefone);
}

module.exports = formatarTelefone;
