import { useState } from 'react';

const LIMITE_SUGESTOES = 8;

function normalizarTexto(valor) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function filtrarOpcoes(opcoes, pesquisa) {
  const pesquisaNormalizada = normalizarTexto(pesquisa.trim());

  if (!pesquisaNormalizada) {
    return opcoes.slice(0, LIMITE_SUGESTOES);
  }

  return opcoes.filter(function (opcao) {
    return normalizarTexto(opcao).includes(pesquisaNormalizada);
  }).slice(0, LIMITE_SUGESTOES);
}

function CampoSelecaoPesquisavel(propriedades) {
  const [listaAberta, setListaAberta] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(-1);
  const idLista = propriedades.id + '-opcoes';
  const opcoesFiltradas = filtrarOpcoes(propriedades.opcoes, propriedades.valor);

  function abrirLista() {
    setListaAberta(true);
  }

  function fecharLista() {
    setListaAberta(false);
    setIndiceAtivo(-1);
  }

  function alterarPesquisa(evento) {
    setListaAberta(true);
    setIndiceAtivo(-1);
    propriedades.aoAlterar(evento.target.value);
  }

  function selecionarOpcao(opcao) {
    propriedades.aoSelecionar(opcao);
    fecharLista();
  }

  function navegarPelasOpcoes(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setListaAberta(true);
      setIndiceAtivo(Math.min(indiceAtivo + 1, opcoesFiltradas.length - 1));
      return;
    }

    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setIndiceAtivo(Math.max(indiceAtivo - 1, 0));
      return;
    }

    if (evento.key === 'Enter' && listaAberta && opcoesFiltradas.length > 0) {
      evento.preventDefault();
      selecionarOpcao(opcoesFiltradas[indiceAtivo >= 0 ? indiceAtivo : 0]);
      return;
    }

    if (evento.key === 'Escape') {
      fecharLista();
    }
  }

  return (
    <div className="grupo-campo campo-pesquisavel">
      <label htmlFor={propriedades.id}>
        {propriedades.rotulo}
        {propriedades.obrigatorio && (
          <span className="indicador-obrigatorio" aria-hidden="true"> *</span>
        )}
      </label>

      <div className="controle-pesquisavel">
        <input
          id={propriedades.id}
          name={propriedades.nome || propriedades.id}
          type="text"
          className="campo-input"
          value={propriedades.valor}
          onChange={alterarPesquisa}
          onFocus={abrirLista}
          onClick={abrirLista}
          onBlur={fecharLista}
          onKeyDown={navegarPelasOpcoes}
          placeholder={propriedades.placeholder}
          required={propriedades.obrigatorio}
          disabled={propriedades.desabilitado}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listaAberta}
          aria-controls={idLista}
          aria-activedescendant={
            listaAberta && indiceAtivo >= 0
              ? idLista + '-' + indiceAtivo
              : undefined
          }
        />
        <span className="icone-pesquisa-campo" aria-hidden="true" />

        {listaAberta && (
          <div className="lista-sugestoes" id={idLista} role="listbox">
            {opcoesFiltradas.length > 0 ? (
              opcoesFiltradas.map(function (opcao, indice) {
                function selecionarComPonteiro(evento) {
                  evento.preventDefault();
                  selecionarOpcao(opcao);
                }

                return (
                  <button
                    id={idLista + '-' + indice}
                    key={opcao}
                    type="button"
                    className={indiceAtivo === indice ? 'sugestao sugestao-ativa' : 'sugestao'}
                    role="option"
                    aria-selected={indiceAtivo === indice}
                    onMouseDown={selecionarComPonteiro}
                  >
                    {opcao}
                  </button>
                );
              })
            ) : (
              <p className="sem-sugestoes">Nenhum bairro encontrado.</p>
            )}
          </div>
        )}
      </div>
      <small className="ajuda-campo">Digite e selecione um bairro da lista.</small>
    </div>
  );
}

export default CampoSelecaoPesquisavel;
