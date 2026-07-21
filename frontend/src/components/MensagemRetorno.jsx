function MensagemRetorno(propriedades) {
  if (!propriedades.mensagem) {
    return null;
  }

  const tipo = propriedades.tipo || 'informacao';
  const papel = tipo === 'erro' ? 'alert' : 'status';

  return (
    <div
      className={'mensagem-retorno mensagem-' + tipo}
      role={papel}
      aria-live={tipo === 'erro' ? 'assertive' : 'polite'}
    >
      {propriedades.mensagem}
    </div>
  );
}

export default MensagemRetorno;
