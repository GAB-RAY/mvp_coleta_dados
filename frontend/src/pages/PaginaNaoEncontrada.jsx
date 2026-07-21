import { Link } from 'react-router-dom';

function PaginaNaoEncontrada() {
  return (
    <main className="pagina-nao-encontrada">
      <section className="cartao cartao-nao-encontrado" aria-labelledby="titulo-nao-encontrado">
        <span className="codigo-erro">404</span>
        <h1 id="titulo-nao-encontrado">Página não encontrada</h1>
        <p>O endereço informado não existe neste sistema.</p>
        <Link className="botao botao-primario" to="/">Voltar ao formulário</Link>
      </section>
    </main>
  );
}

export default PaginaNaoEncontrada;
