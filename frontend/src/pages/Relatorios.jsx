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

const ROTULOS_RELATORIO = {
  autorizado: 'Autorizado',
  nao_informado: 'Não informado',
  recusado: 'Recusado',
  revogado: 'Revogado',
  sim: 'Sim',
  nao: 'Não',
  prefiro_nao_informar: 'Prefiro não informar'
};

function formatarRotulo(nome) {
  if (typeof nome === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nome)) {
    const partes = nome.split('-');
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  return ROTULOS_RELATORIO[nome] || nome || 'Não informado';
}

function ordenarPorTotal(itens) {
  return (itens || []).slice().sort(function (primeiro, segundo) {
    return segundo.total - primeiro.total;
  });
}

function GraficoResumo(propriedades) {
  const itensRecebidos = propriedades.itens || [];
  const itensOrdenados = propriedades.preservarOrdem
    ? itensRecebidos.slice(-propriedades.limite)
    : ordenarPorTotal(itensRecebidos).slice(0, propriedades.limite);
  const total = itensRecebidos.reduce(function (soma, item) {
    return soma + item.total;
  }, 0);
  const maiorTotal = itensOrdenados.reduce(function (maior, item) {
    return item.total > maior ? item.total : maior;
  }, 0);

  return (
    <section className={'cartao grafico-relatorio ' + (propriedades.destaque ? 'grafico-relatorio-destaque' : '')}>
      <div className="cabecalho-grafico-relatorio">
        <div>
          <span>{propriedades.subtitulo}</span>
          <h2>{propriedades.titulo}</h2>
        </div>
        <strong>{total.toLocaleString('pt-BR')}</strong>
      </div>

      {itensOrdenados.length === 0 && (
        <p className="sem-dados-relatorio">Sem dados para os filtros aplicados.</p>
      )}

      <div className="barras-relatorio">
        {itensOrdenados.map(function (item) {
          const largura = maiorTotal ? Math.max((item.total / maiorTotal) * 100, 4) : 0;
          const percentual = total ? Math.round((item.total / total) * 100) : 0;

          return (
            <div className="item-grafico-relatorio" key={item.nome}>
              <div className="rotulo-grafico-relatorio">
                <span title={formatarRotulo(item.nome)}>{formatarRotulo(item.nome)}</span>
                <span><strong>{item.total}</strong><small>{percentual}%</small></span>
              </div>
              <span className="trilho-grafico-relatorio">
                <span style={{ width: largura + '%' }} />
              </span>
            </div>
          );
        })}
      </div>

      {itensRecebidos.length > propriedades.limite && (
        <small className="observacao-grafico-relatorio">
          Exibindo {propriedades.limite} de {itensRecebidos.length} resultados.
        </small>
      )}
    </section>
  );
}

function IndicadorRelatorio(propriedades) {
  return (
    <article className="cartao indicador-relatorio">
      <span>{propriedades.rotulo}</span>
      <strong>{propriedades.valor.toLocaleString('pt-BR')}</strong>
      <small>{propriedades.detalhe}</small>
    </article>
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
        <CabecalhoAdministrativo
          aoSair={sair}
          titulo="Relatórios"
          subtitulo="Analise segmentos e exporte os dados autorizados."
        />
        <Link className="link-voltar" to="/admin/contatos">← Voltar para contatos</Link>

        <section className="cartao painel-filtros">
          <div className="cabecalho-secao">
            <div>
              <span className="etiqueta-pagina">Análise operacional</span>
              <h2>Relatórios e segmentação</h2>
            </div>
          </div>
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
              <button className="botao botao-primario" type="submit">Atualizar gráficos</button>
              <button className="botao botao-secundario" type="button" onClick={exportar}>Exportar CSV</button>
            </div>
          </form>
        </section>

        {mensagem && <MensagemRetorno mensagem={mensagem} tipo="erro" />}
        {carregando && <Carregando mensagem="Gerando relatório..." />}
        {!carregando && resumo && (
          <>
            <section className="grade-indicadores-relatorio" aria-label="Indicadores do relatório">
              <IndicadorRelatorio rotulo="Total filtrado" valor={resumo.totalContatos} detalhe="Contatos encontrados" />
              <IndicadorRelatorio rotulo="Bairros" valor={resumo.porBairro.length} detalhe="Regiões representadas" />
              <IndicadorRelatorio rotulo="Categorias" valor={resumo.porProblema.length} detalhe="Necessidades diferentes" />
              <IndicadorRelatorio rotulo="Origens" valor={resumo.porOrigem.length} detalhe="Fontes de cadastro" />
            </section>

            <div className="grade-graficos-relatorio grade-graficos-relatorio-principal">
              <GraficoResumo titulo="Contatos por bairro" subtitulo="Distribuição territorial" itens={resumo.porBairro} limite={10} destaque />
              <GraficoResumo titulo="Principais necessidades" subtitulo="Categorias informadas" itens={resumo.porProblema} limite={10} destaque />
            </div>

            <div className="grade-graficos-relatorio">
              <GraficoResumo titulo="Faixa etária" subtitulo="Perfil dos contatos" itens={resumo.porFaixaEtaria} limite={8} />
              <GraficoResumo titulo="Participação eleitoral" subtitulo="Última eleição" itens={resumo.porParticipacaoEleitoral} limite={8} />
              <GraficoResumo titulo="Origem dos contatos" subtitulo="Canais de entrada" itens={resumo.porOrigem} limite={8} />
              <GraficoResumo titulo="Mensagens" subtitulo="Autorizações" itens={resumo.porAutorizacaoMensagens} limite={8} />
              <GraficoResumo titulo="Ligações" subtitulo="Autorizações" itens={resumo.porAutorizacaoLigacoes} limite={8} />
              <GraficoResumo titulo="Cadastros por dia" subtitulo="Evolução recente" itens={resumo.porPeriodo} limite={12} preservarOrdem />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default Relatorios;
