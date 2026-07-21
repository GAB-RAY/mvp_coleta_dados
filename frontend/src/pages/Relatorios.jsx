import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import CampoFormulario from '../components/CampoFormulario';
import CampoSelecao from '../components/CampoSelecao';
import Carregando from '../components/Carregando';
import MensagemRetorno from '../components/MensagemRetorno';
import { baixarCsv, buscarResumo } from '../services/relatorioService';
import { removerToken } from '../utils/armazenamentoToken';

const FILTROS_INICIAIS = {
  bairro: '',
  problema: '',
  origem: '',
  idadeMinima: '',
  idadeMaxima: '',
  participouEleicaoAnterior: '',
  dataInicial: '',
  dataFinal: ''
};

const OPCOES_ELEICAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'prefiro_nao_informar', rotulo: 'Prefiro não informar' }
];

function ListaResumo(propriedades) {
  return (
    <section className="cartao painel-detalhes">
      <h2>{propriedades.titulo}</h2>
      {propriedades.itens.length === 0 && <p>Sem dados.</p>}
      <ul className="lista-resumo">
        {propriedades.itens.map(function (item) {
          return <li key={item.nome}><span>{item.nome}</span><strong>{item.total}</strong></li>;
        })}
      </ul>
    </section>
  );
}

function Relatorios() {
  const navegacao = useNavigate();
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_INICIAIS);
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState('');

  useEffect(function () {
    const controlador = new AbortController();

    async function carregar() {
      setCarregando(true);
      try {
        const resposta = await buscarResumo(filtrosAplicados, controlador.signal);
        setResumo(resposta.resumo);
        setMensagem('');
      } catch (erro) {
        if (erro.name === 'AbortError') {
          return;
        }
        if (erro.statusHttp === 401) {
          removerToken();
          navegacao('/login', { replace: true });
          return;
        }
        setMensagem(erro.message);
      } finally {
        if (!controlador.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    carregar();
    return function () { controlador.abort(); };
  }, [filtrosAplicados, navegacao]);

  function alterar(evento) {
    setFiltros(Object.assign({}, filtros, { [evento.target.name]: evento.target.value }));
  }

  function aplicar(evento) {
    evento.preventDefault();
    setFiltrosAplicados(Object.assign({}, filtros));
  }

  async function exportar() {
    try {
      const arquivo = await baixarCsv(filtrosAplicados);
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'contatos-a-voz-do-bairro.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (erro) {
      if (erro.statusHttp === 401) {
        removerToken();
        navegacao('/login', { replace: true });
      } else {
        setMensagem(erro.message);
      }
    }
  }

  function sair() {
    removerToken();
    navegacao('/login', { replace: true });
  }

  return (
    <main className="pagina-administrativa">
      <div className="conteudo-administrativo">
        <CabecalhoAdministrativo aoSair={sair} />
        <Link className="link-voltar" to="/admin/contatos">← Voltar para contatos</Link>

        <section className="cartao painel-filtros">
          <div className="cabecalho-secao"><div><span className="etiqueta-pagina">Análise operacional</span><h2>Relatórios e segmentação</h2></div></div>
          <form className="formulario-filtros" onSubmit={aplicar}>
            <fieldset className="grade-filtros">
              <CampoFormulario id="bairro" rotulo="Bairro" valor={filtros.bairro} aoAlterar={alterar} />
              <CampoFormulario id="problema" rotulo="Categoria" valor={filtros.problema} aoAlterar={alterar} />
              <CampoFormulario id="origem" rotulo="Origem" valor={filtros.origem} aoAlterar={alterar} />
              <CampoFormulario id="idadeMinima" rotulo="Idade mínima" tipo="number" valor={filtros.idadeMinima} aoAlterar={alterar} minimo={16} maximo={120} />
              <CampoFormulario id="idadeMaxima" rotulo="Idade máxima" tipo="number" valor={filtros.idadeMaxima} aoAlterar={alterar} minimo={16} maximo={120} />
              <CampoSelecao id="participouEleicaoAnterior" rotulo="Votou na última eleição" valor={filtros.participouEleicaoAnterior} aoAlterar={alterar} opcoes={OPCOES_ELEICAO} placeholder="Todos" />
              <CampoFormulario id="dataInicial" rotulo="Data inicial" tipo="date" valor={filtros.dataInicial} aoAlterar={alterar} />
              <CampoFormulario id="dataFinal" rotulo="Data final" tipo="date" valor={filtros.dataFinal} aoAlterar={alterar} />
            </fieldset>
            <div className="acoes-filtros">
              <button className="botao botao-primario" type="submit">Atualizar</button>
              <button className="botao botao-secundario" type="button" onClick={exportar}>Exportar CSV</button>
            </div>
          </form>
        </section>

        {mensagem && <MensagemRetorno mensagem={mensagem} tipo="erro" />}
        {carregando && <Carregando mensagem="Gerando relatório..." />}
        {!carregando && resumo && (
          <>
            <section className="cartao total-relatorio"><span>Total filtrado</span><strong>{resumo.totalContatos}</strong></section>
            <div className="grade-detalhes">
              <ListaResumo titulo="Por bairro" itens={resumo.porBairro} />
              <ListaResumo titulo="Por categoria" itens={resumo.porProblema} />
              <ListaResumo titulo="Por faixa etária" itens={resumo.porFaixaEtaria} />
              <ListaResumo titulo="Participação eleitoral" itens={resumo.porParticipacaoEleitoral} />
              <ListaResumo titulo="Por origem" itens={resumo.porOrigem} />
              <ListaResumo titulo="Autorização de mensagens" itens={resumo.porAutorizacaoMensagens} />
              <ListaResumo titulo="Autorização de ligações" itens={resumo.porAutorizacaoLigacoes} />
              <ListaResumo titulo="Cadastros por dia" itens={resumo.porPeriodo} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default Relatorios;
