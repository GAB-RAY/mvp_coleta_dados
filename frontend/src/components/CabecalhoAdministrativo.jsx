import { Link } from 'react-router-dom';

function CabecalhoAdministrativo(propriedades) {
  return (
    <header className="cabecalho-administrativo">
      <div>
        <span className="marca-sistema">A Voz do Bairro</span>
        <h1>Contatos cadastrados</h1>
      </div>

      <div className="acoes-cabecalho-admin">
        <Link className="botao botao-secundario" to="/admin/contatos">Contatos</Link>
        <Link className="botao botao-secundario" to="/admin/contatos/novo">Novo contato</Link>
        <Link className="botao botao-secundario" to="/admin/importacoes">Importar</Link>
        <Link className="botao botao-secundario" to="/admin/relatorios">Relatórios</Link>
        <button
          type="button"
          className="botao botao-secundario botao-logout"
          onClick={propriedades.aoSair}
        >
          Sair
        </button>
      </div>
    </header>
  );
}

export default CabecalhoAdministrativo;
