function CabecalhoAdministrativo(propriedades) {
  return (
    <header className="cabecalho-administrativo">
      <div>
        <span className="marca-sistema">A Voz do Bairro</span>
        <h1>Contatos cadastrados</h1>
      </div>

      <button
        type="button"
        className="botao botao-secundario botao-logout"
        onClick={propriedades.aoSair}
      >
        Sair
      </button>
    </header>
  );
}

export default CabecalhoAdministrativo;
