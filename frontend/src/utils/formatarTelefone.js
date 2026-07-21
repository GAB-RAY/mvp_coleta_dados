function formatarTelefone(telefone) {
  if (typeof telefone !== 'string') {
    return '';
  }

  const numeros = telefone.replace(/\D/g, '');

  if (numeros.length === 10) {
    return numeros.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }

  if (numeros.length === 11) {
    return numeros.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }

  return telefone;
}

export default formatarTelefone;
