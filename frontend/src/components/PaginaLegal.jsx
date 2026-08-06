import { Link } from 'react-router-dom';

function obterEmailPrivacidade() {
  return String(import.meta.env.VITE_PRIVACIDADE_EMAIL || '').trim();
}

function PaginaLegal(propriedades) {
  const emailPrivacidade = obterEmailPrivacidade();

  return (
    <main className="pagina-legal">
      <header className="cabecalho-legal">
        <Link className="marca-legal" to="/participar" aria-label="Ir para o formulário público">
          <span aria-hidden="true">AV</span>
          <strong>ACORDA RJ</strong>
        </Link>
        <span>Diogo Ventura · Rio de Janeiro</span>
      </header>

      <article className="conteudo-legal">
        <Link className="voltar-formulario-legal" to="/participar">
          ← Voltar para o formulário
        </Link>
        <span className="etiqueta-legal">{propriedades.etiqueta}</span>
        <h1>{propriedades.titulo}</h1>
        <p className="introducao-legal">{propriedades.introducao}</p>

        {propriedades.children}

        <section className="canal-privacidade-legal" aria-labelledby="titulo-canal-privacidade">
          <h2 id="titulo-canal-privacidade">Canal de atendimento</h2>
          {emailPrivacidade ? (
            <p>
              Envie sua solicitação para{' '}
              <a href={'mailto:' + emailPrivacidade}>{emailPrivacidade}</a>.
            </p>
          ) : (
            <p>
              O e-mail oficial de privacidade está em configuração e será publicado
              nesta página antes do início da coleta oficial e das comunicações.
            </p>
          )}
        </section>
      </article>

      <footer className="rodape-legal">
        <span>Projeto Acorda RJ · Diogo Ventura</span>
        <nav aria-label="Documentos públicos">
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos</Link>
          <Link to="/excluir-dados">Excluir dados</Link>
        </nav>
      </footer>
    </main>
  );
}

export { obterEmailPrivacidade };
export default PaginaLegal;
