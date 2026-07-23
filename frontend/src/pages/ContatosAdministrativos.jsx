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
import { listarEventos } from '../services/eventoService';
import { removerToken } from '../utils/armazenamentoToken';

const FILTROS_INICIAIS = {
  nome: '',
  telefone: '',
  bairro: '',
  problema: '',
  origem: '',
  status: '',
  idadeMinima: '',
  idadeMaxima: '',
  participouEleicaoAnterior: '',
  autorizacaoMensagens: '',
  autorizacaoLigacoes: '',
  dataInicial: '',
  dataFinal: '',
  ordenacao: 'mais_recentes',
  eventoId: ''
};

const OPCOES_CONSENTIMENTO = [
  { valor: 'autorizado', rotulo: 'Autorizado' },
  { valor: 'nao_informado', rotulo: 'Não informado' },
  { valor: 'recusado', rotulo: 'Recusado' },
  { valor: 'revogado', rotulo: 'Revogado' }
];

const OPCOES_ELEICAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'prefiro_nao_informar', rotulo: 'Prefiro não informar' }
];

const OPCOES_ORDENACAO = [
  { valor: 'mais_recentes', rotulo: 'Mais recentes' },
  { valor: 'mais_antigos', rotulo: 'Mais antigos' },
  { valor: 'nome_asc', rotulo: 'Nome: A a Z' },
  { valor: 'nome_desc', rotulo: 'Nome: Z a A' }
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
    origem: filtros.origem.trim(),
    status: filtros.status.trim(),
    idadeMinima: filtros.idadeMinima,
    idadeMaxima: filtros.idadeMaxima,
    participouEleicaoAnterior: filtros.participouEleicaoAnterior,
    autorizacaoMensagens: filtros.autorizacaoMensagens,
    autorizacaoLigacoes: filtros.autorizacaoLigacoes,
    dataInicial: filtros.dataInicial,
    dataFinal: filtros.dataFinal,
    ordenacao: filtros.ordenacao,
    eventoId: filtros.eventoId
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
  const [eventos, setEventos] = useState([]);

  useEffect(function () {
    listarEventos().then(function (resposta) {
      setEventos(resposta.eventos || []);
    }).catch(function () {
      setEventos([]);
    });
  }, []);

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
        <CabecalhoAdministrativo
          aoSair={sair}
          titulo="Contatos"
          subtitulo="Consulte, filtre e acompanhe os cadastros da base."
        />

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

              <CampoFormulario
                id="filtro-idade-minima"
                nome="idadeMinima"
                rotulo="Idade mínima"
                tipo="number"
                valor={filtrosFormulario.idadeMinima}
                aoAlterar={alterarFiltro}
                minimo={16}
                maximo={120}
                desabilitado={carregando}
              />

              <CampoFormulario
                id="filtro-idade-maxima"
                nome="idadeMaxima"
                rotulo="Idade máxima"
                tipo="number"
                valor={filtrosFormulario.idadeMaxima}
                aoAlterar={alterarFiltro}
                minimo={16}
                maximo={120}
                desabilitado={carregando}
              />

              <CampoSelecao
                id="filtro-eleicao"
                nome="participouEleicaoAnterior"
                rotulo="Votou na última eleição"
                valor={filtrosFormulario.participouEleicaoAnterior}
                aoAlterar={alterarFiltro}
                opcoes={OPCOES_ELEICAO}
                placeholder="Todos"
                desabilitado={carregando}
              />

              <CampoSelecao
                id="filtro-autorizacao-mensagens"
                nome="autorizacaoMensagens"
                rotulo="Autorização de mensagens"
                valor={filtrosFormulario.autorizacaoMensagens}
                aoAlterar={alterarFiltro}
                opcoes={OPCOES_CONSENTIMENTO}
                placeholder="Todos"
                desabilitado={carregando}
              />

              <CampoSelecao
                id="filtro-autorizacao-ligacoes"
                nome="autorizacaoLigacoes"
                rotulo="Autorização de ligações"
                valor={filtrosFormulario.autorizacaoLigacoes}
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
                id="filtro-data-inicial"
                nome="dataInicial"
                rotulo="Cadastro a partir de"
                tipo="date"
                valor={filtrosFormulario.dataInicial}
                aoAlterar={alterarFiltro}
                desabilitado={carregando}
              />

              <CampoFormulario
                id="filtro-data-final"
                nome="dataFinal"
                rotulo="Cadastro até"
                tipo="date"
                valor={filtrosFormulario.dataFinal}
                aoAlterar={alterarFiltro}
                desabilitado={carregando}
              />

              <CampoSelecao
                id="filtro-ordenacao"
                nome="ordenacao"
                rotulo="Ordenação"
                valor={filtrosFormulario.ordenacao}
                aoAlterar={alterarFiltro}
                opcoes={OPCOES_ORDENACAO}
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

              <CampoSelecao
                id="filtro-evento"
                nome="eventoId"
                rotulo="Evento"
                valor={filtrosFormulario.eventoId}
                aoAlterar={alterarFiltro}
                opcoes={[{ valor: 'sem_evento', rotulo: 'Cadastro geral (sem evento)' }].concat(eventos.map(function (item) { return { valor: String(item.id), rotulo: item.nome }; }))}
                placeholder="Todos"
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
