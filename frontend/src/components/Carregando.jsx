function Carregando(propriedades) {
  return (
    <div className="estado-carregando" role="status" aria-live="polite">
      <span className="indicador-carregando" aria-hidden="true" />
      <span>{propriedades.mensagem || 'Carregando...'}</span>
    </div>
  );
}

export default Carregando;
