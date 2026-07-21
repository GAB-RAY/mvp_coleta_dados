function Paginacao(propriedades) {
  const paginaAtual = Number(propriedades.paginaAtual) || 1;
  const totalPaginas = Number(propriedades.totalPaginas) || 0;

  if (totalPaginas < 1) {
    return null;
  }

  function irParaPaginaAnterior() {
    if (paginaAtual > 1) {
      propriedades.aoMudarPagina(paginaAtual - 1);
    }
  }

  function irParaProximaPagina() {
    if (paginaAtual < totalPaginas) {
      propriedades.aoMudarPagina(paginaAtual + 1);
    }
  }

  return (
    <nav className="paginacao" aria-label="Paginação dos contatos">
      <button
        type="button"
        className="botao botao-secundario"
        onClick={irParaPaginaAnterior}
        disabled={paginaAtual <= 1 || propriedades.desabilitado}
      >
        Anterior
      </button>

      <span aria-current="page">
        Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
      </span>

      <button
        type="button"
        className="botao botao-secundario"
        onClick={irParaProximaPagina}
        disabled={paginaAtual >= totalPaginas || propriedades.desabilitado}
      >
        Próxima
      </button>
    </nav>
  );
}

export default Paginacao;
