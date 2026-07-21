import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import CampoFormulario from '../components/CampoFormulario';
import CampoSelecao from '../components/CampoSelecao';
import Carregando from '../components/Carregando';
import MensagemRetorno from '../components/MensagemRetorno';
import Paginacao from '../components/Paginacao';
import TabelaContatos from '../components/TabelaContatos';
import { listarContatos } from '../services/contatoService';
import { removerToken } from '../utils/armazenamentoToken';

const FILTROS_INICIAIS = {
  nome: '',
  telefone: '',
  bairro: '',
  problema: '',
  consentimentoWhatsapp: '',
  consentimentoLigacoes: '',
  origem: '',
  status: ''
};

const OPCOES_CONSENTIMENTO = [
  { valor: 'true', rotulo: 'Sim' },
  { valor: 'false', rotulo: 'Não' },
  { valor: 'null', rotulo: 'Não informado' }
];

const PAGINACAO_INICIAL = {
  paginaAtual: 1,
  limite: 20,
  totalRegistros: 0,
  totalPaginas: 0
};

function prepararFiltros(filtros) {
  return {
    nome: filtros.nome.trim(),
    telefone: filtros.telefone.trim(),
    bairro: filtros.bairro.trim(),
    problema: filtros.problema.trim(),
    consentimentoWhatsapp: filtros.consentimentoWhatsapp,
    consentimentoLigacoes: filtros.consentimentoLigacoes,
    origem: filtros.origem.trim(),
    status: filtros.status.trim()
  };
}

function ContatosAdministrativos() {
  const navegacao = useNavigate();
  const secaoResultados = useRef(null);
  const [filtrosFormulario, setFiltrosFormulario] = useState(FILTROS_INICIAIS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_INICIAIS);
  const [pagina, setPagina] = useState(1);
  const [paginacao, setPaginacao] = useState(PAGINACAO_INICIAL);
  const [contatos, setContatos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagemErro, setMensagemErro] = useState('');
  const [versaoConsulta, setVersaoConsulta] = useState(0);

  useEffect(function () {
    const controlador = new AbortController();

    async function carregarContatos() {
      setCarregando(true);
      setMensagemErro('');

      try {
        const resposta = await listarContatos(
          filtrosAplicados,
          pagina,
          PAGINACAO_INICIAL.limite,
          controlador.signal
        );

        setContatos(resposta.contatos || []);
        setPaginacao(resposta.paginacao || PAGINACAO_INICIAL);
      } catch (erro) {
        if (erro.name === 'AbortError') {
          return;
        }

        if (erro.statusHttp === 401) {
          removerToken();
          navegacao('/login', {
            replace: true,
            state: {
              mensagem: 'Sua sessão expirou. Faça login novamente.'
            }
          });
          return;
        }

        setContatos([]);
        setMensagemErro(erro.message);
      } finally {
        if (!controlador.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    carregarContatos();

    return function () {
      controlador.abort();
    };
  }, [filtrosAplicados, pagina, navegacao, versaoConsulta]);

  function alterarFiltro(evento) {
    const campo = evento.target.name;
    const valor = evento.target.value;

    setFiltrosFormulario(Object.assign({}, filtrosFormulario, {
      [campo]: valor
    }));
  }

  function buscar(evento) {
    evento.preventDefault();
    setPagina(1);
    setFiltrosAplicados(prepararFiltros(filtrosFormulario));
  }

  function limparFiltros() {
    setFiltrosFormulario(FILTROS_INICIAIS);
    setFiltrosAplicados(FILTROS_INICIAIS);
    setPagina(1);
  }

  function mudarPagina(novaPagina) {
    setPagina(novaPagina);

    if (secaoResultados.current) {
      secaoResultados.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function tentarNovamente() {
    setVersaoConsulta(versaoConsulta + 1);
  }

  function sair() {
    removerToken();
    navegacao('/login', { replace: true });
  }

  return (
    <main className="pagina-administrativa">
      <div className="conteudo-administrativo">
        <CabecalhoAdministrativo aoSair={sair} />

        <section className="cartao painel-filtros" aria-labelledby="titulo-filtros">
          <div className="cabecalho-secao">
            <div>
              <span className="etiqueta-pagina">Consulta administrativa</span>
              <h2 id="titulo-filtros">Filtros de busca</h2>
            </div>
            <p>Preencha um ou mais campos para localizar contatos.</p>
          </div>

          <form className="formulario-filtros" onSubmit={buscar}>
            <fieldset className="grade-filtros" disabled={carregando}>
              <legend className="apenas-leitor-tela">Filtros dos contatos</legend>

              <CampoFormulario
                id="filtro-nome"
                nome="nome"
                rotulo="Nome"
                valor={filtrosFormulario.nome}
                aoAlterar={alterarFiltro}
                placeholder="Nome ou parte dele"
                desabilitado={carregando}
              />

              <CampoFormulario
                id="filtro-telefone"
                nome="telefone"
                rotulo="Telefone"
                tipo="tel"
                valor={filtrosFormulario.telefone}
                aoAlterar={alterarFiltro}
                placeholder="(21) 99999-9999"
                desabilitado={carregando}
                inputMode="tel"
              />

              <CampoFormulario
                id="filtro-bairro"
                nome="bairro"
                rotulo="Bairro"
                valor={filtrosFormulario.bairro}
                aoAlterar={alterarFiltro}
                placeholder="Bairro ou parte dele"
                desabilitado={carregando}
              />

              <CampoFormulario
                id="filtro-problema"
                nome="problema"
                rotulo="Problema"
                valor={filtrosFormulario.problema}
                aoAlterar={alterarFiltro}
                placeholder="Categoria ou parte dela"
                desabilitado={carregando}
              />

              <CampoSelecao
                id="filtro-consentimento-whatsapp"
                nome="consentimentoWhatsapp"
                rotulo="Mensagens no WhatsApp"
                valor={filtrosFormulario.consentimentoWhatsapp}
                aoAlterar={alterarFiltro}
                opcoes={OPCOES_CONSENTIMENTO}
                placeholder="Todos"
                desabilitado={carregando}
              />

              <CampoSelecao
                id="filtro-consentimento-ligacoes"
                nome="consentimentoLigacoes"
                rotulo="Ligações"
                valor={filtrosFormulario.consentimentoLigacoes}
                aoAlterar={alterarFiltro}
                opcoes={OPCOES_CONSENTIMENTO}
                placeholder="Todos"
                desabilitado={carregando}
              />

              <CampoFormulario
                id="filtro-origem"
                nome="origem"
                rotulo="Origem"
                valor={filtrosFormulario.origem}
                aoAlterar={alterarFiltro}
                placeholder="Origem ou parte dela"
                desabilitado={carregando}
              />

              <CampoFormulario
                id="filtro-status"
                nome="status"
                rotulo="Status"
                valor={filtrosFormulario.status}
                aoAlterar={alterarFiltro}
                placeholder="Status ou parte dele"
                desabilitado={carregando}
              />
            </fieldset>

            <div className="acoes-filtros">
              <button className="botao botao-primario" type="submit" disabled={carregando}>
                Buscar
              </button>
              <button
                className="botao botao-secundario"
                type="button"
                onClick={limparFiltros}
                disabled={carregando}
              >
                Limpar filtros
              </button>
            </div>
          </form>
        </section>

        <section
          className="cartao painel-resultados"
          aria-labelledby="titulo-resultados"
          ref={secaoResultados}
        >
          <div className="cabecalho-resultados">
            <div>
              <h2 id="titulo-resultados">Resultados</h2>
              {!carregando && !mensagemErro && (
                <p>
                  {paginacao.totalRegistros === 1
                    ? '1 contato encontrado'
                    : paginacao.totalRegistros + ' contatos encontrados'}
                </p>
              )}
            </div>
          </div>

          {carregando && <Carregando mensagem="Carregando contatos..." />}

          {!carregando && mensagemErro && (
            <div className="estado-erro-listagem">
              <MensagemRetorno mensagem={mensagemErro} tipo="erro" />
              <button className="botao botao-secundario" type="button" onClick={tentarNovamente}>
                Tentar novamente
              </button>
            </div>
          )}

          {!carregando && !mensagemErro && contatos.length === 0 && (
            <div className="estado-vazio" role="status">
              <h3>Nenhum contato encontrado</h3>
              <p>Revise os filtros informados ou aguarde novos cadastros.</p>
            </div>
          )}

          {!carregando && !mensagemErro && contatos.length > 0 && (
            <TabelaContatos contatos={contatos} />
          )}

          {!carregando && !mensagemErro && (
            <Paginacao
              paginaAtual={paginacao.paginaAtual}
              totalPaginas={paginacao.totalPaginas}
              aoMudarPagina={mudarPagina}
              desabilitado={carregando}
            />
          )}
        </section>
      </div>
    </main>
  );
}

export default ContatosAdministrativos;
