import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import Carregando from '../components/Carregando';
import MensagemRetorno from '../components/MensagemRetorno';
import { listarContatos } from '../services/contatoService';
import { buscarResumo } from '../services/relatorioService';
import { removerToken } from '../utils/armazenamentoToken';
import formatarTelefone from '../utils/formatarTelefone';

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

function ordenarPorTotal(itens) {
  return (itens || []).slice().sort(function (primeiro, segundo) {
    return segundo.total - primeiro.total;
  });
}

function limitarItens(itens, limite) {
  return ordenarPorTotal(itens).slice(0, limite);
}

function obterMaiorTotal(itens) {
  return itens.reduce(function (maior, item) {
    return item.total > maior ? item.total : maior;
  }, 0);
}

function obterTotalPorNome(itens, nome) {
  const itemEncontrado = (itens || []).find(function (item) {
    return item.nome === nome;
  });

  return itemEncontrado ? itemEncontrado.total : 0;
}

function criarDestinoFiltro(filtro, valor) {
  const parametros = new URLSearchParams();
  parametros.set(filtro, valor === 'Não informado' ? 'nao_informado' : valor);
  return '/admin/contatos?' + parametros.toString();
}

function formatarData(dataRecebida) {
  const data = new Date(dataRecebida);

  if (Number.isNaN(data.getTime())) {
    return '—';
  }

  return formatadorData.format(data);
}

function IconeIndicador(propriedades) {
  if (propriedades.tipo === 'bairros') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.4" />
      </svg>
    );
  }

  if (propriedades.tipo === 'mensagens') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v12H8l-4 4V5Z" />
        <path d="m8 11 2.3 2.3L16.5 8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.4-3.2 2.2-5 5.5-5s5.1 1.8 5.5 5" />
      <path d="M16 7h5M18.5 4.5v5" />
    </svg>
  );
}

function CartaoIndicador(propriedades) {
  return (
    <article className="cartao cartao-indicador-admin">
      <div className="icone-indicador-admin">
        <IconeIndicador tipo={propriedades.tipo} />
      </div>
      <span>{propriedades.rotulo}</span>
      <strong>{propriedades.valor.toLocaleString('pt-BR')}</strong>
      <small>{propriedades.detalhe}</small>
    </article>
  );
}

function GraficoDistribuicaoDashboard(propriedades) {
  const itens = limitarItens(propriedades.itens, 6);
  const maiorTotal = obterMaiorTotal(itens);
  const total = (propriedades.itens || []).reduce(function (soma, item) {
    return soma + item.total;
  }, 0);
  const itensGrafico = itens.slice(0, 4);

  return (
    <section className="cartao cartao-grafico-admin cartao-distribuicao-dashboard">
      <div className="cabecalho-cartao-dashboard">
        <div>
          <span>{propriedades.subtitulo}</span>
          <h2>{propriedades.titulo}</h2>
        </div>
        <strong className="total-grafico-dashboard">{total.toLocaleString('pt-BR')}</strong>
      </div>

      {itens.length === 0 && <p className="sem-dados-dashboard">Ainda não há dados.</p>}
      {itens.length > 0 && (
        <>
          <div className="visual-grafico-dashboard" aria-label={propriedades.titulo}>
            {itensGrafico.map(function (item) {
              const altura = maiorTotal ? Math.max((item.total / maiorTotal) * 100, 8) : 0;
              return (
                <Link
                  className="barra-vertical-dashboard"
                  key={item.nome}
                  to={criarDestinoFiltro(propriedades.filtro, item.nome)}
                  title={'Mostrar contatos: ' + item.nome}
                >
                  <span className="area-barra-vertical-dashboard">
                    <span style={{ height: altura + '%' }} />
                  </span>
                  <small>{item.nome}</small>
                </Link>
              );
            })}
          </div>

          <div className="legenda-grafico-dashboard">
            {itens.map(function (item) {
              const percentual = total ? Math.round((item.total / total) * 100) : 0;
              return (
                <Link
                  key={item.nome}
                  to={criarDestinoFiltro(propriedades.filtro, item.nome)}
                  title={'Mostrar contatos: ' + item.nome}
                >
                  <span className="marcador-grafico-dashboard" />
                  <span>{item.nome}</span>
                  <strong>{item.total}</strong>
                  <small>{percentual}%</small>
                </Link>
              );
            })}
          </div>

          <Link className="link-detalhes-grafico-dashboard" to={propriedades.destino}>
            Ver relatório completo
          </Link>
        </>
      )}
    </section>
  );
}

function GraficoBarrasHorizontais(propriedades) {
  return (
    <GraficoDistribuicaoDashboard
      titulo={propriedades.titulo}
      subtitulo="Distribuição territorial"
      itens={propriedades.itens}
      destino={propriedades.destino}
      filtro={propriedades.filtro}
    />
  );
}

function GraficoBarrasVerticais(propriedades) {
  return (
    <GraficoDistribuicaoDashboard
      titulo={propriedades.titulo}
      subtitulo="Categorias informadas"
      itens={propriedades.itens}
      destino={propriedades.destino}
      filtro={propriedades.filtro}
    />
  );
}

function TabelaContatosRecentes(propriedades) {
  return (
    <section className="cartao cartao-recentes-admin">
      <div className="cabecalho-cartao-dashboard">
        <div>
          <span>Atualizações</span>
          <h2>Contatos recentes</h2>
        </div>
        <Link to="/admin/contatos">Ver base completa</Link>
      </div>

      {propriedades.contatos.length === 0 && (
        <p className="sem-dados-dashboard">Nenhum contato cadastrado.</p>
      )}

      {propriedades.contatos.length > 0 && (
        <div className="tabela-dashboard-responsiva">
          <table className="tabela-dashboard-admin">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Bairro</th>
                <th>Necessidade</th>
                <th>Cadastro</th>
                <th><span className="apenas-leitor-tela">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {propriedades.contatos.map(function (contato) {
                return (
                  <tr key={contato.id}>
                    <td><strong>{contato.nome}</strong></td>
                    <td>{formatarTelefone(contato.telefone)}</td>
                    <td>{contato.bairro}</td>
                    <td><span className="etiqueta-demanda-admin">{contato.problema}</span></td>
                    <td>{formatarData(contato.criadoEm)}</td>
                    <td><Link className="acao-tabela-dashboard" to={'/admin/contatos/' + contato.id}>Abrir</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ColunaLateralDashboard(propriedades) {
  const autorizacoes = propriedades.resumo.porAutorizacaoMensagens || [];

  return (
    <aside className="coluna-dashboard-lateral">
      <section className="cartao painel-lateral-dashboard">
        <div className="cabecalho-painel-lateral">
          <span className="mini-simbolo-admin">CC</span>
          <div><strong>Central ativa</strong><small>Dados atualizados</small></div>
          <span className="ponto-status-admin" title="Sistema disponível" />
        </div>
      </section>

      <section className="cartao painel-lateral-dashboard">
        <div className="cabecalho-cartao-dashboard">
          <div><span>Operações</span><h2>Acesso rápido</h2></div>
        </div>
        <div className="atalhos-dashboard-admin">
          <Link to="/admin/contatos/novo"><span>+</span><div><strong>Novo contato</strong><small>Cadastro manual</small></div></Link>
          <Link to="/admin/importacoes"><span>↓</span><div><strong>Importar lista</strong><small>Arquivo CSV ou XLSX</small></div></Link>
          <Link to="/admin/relatorios"><span>↗</span><div><strong>Gerar relatório</strong><small>Análises e exportação</small></div></Link>
        </div>
      </section>

      <section className="cartao painel-lateral-dashboard">
        <div className="cabecalho-cartao-dashboard">
          <div><span>Comunicação</span><h2>Autorizações</h2></div>
        </div>
        <ul className="lista-autorizacoes-dashboard">
          {autorizacoes.map(function (item) {
            return (
              <li key={item.nome}>
                <span className="marcador-autorizacao" />
                <span>{item.nome.replaceAll('_', ' ')}</span>
                <strong>{item.total}</strong>
              </li>
            );
          })}
        </ul>
        {autorizacoes.length === 0 && <p className="sem-dados-dashboard">Sem dados.</p>}
      </section>

      <Link className="chamada-lateral-dashboard" to="/participar">
        <span>Formulário público</span>
        <strong>Acorda VK</strong>
        <small>Abrir página de participação →</small>
      </Link>
    </aside>
  );
}

function DashboardAdministrativo() {
  const navegacao = useNavigate();
  const [resumo, setResumo] = useState(null);
  const [contatos, setContatos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState('');

  useEffect(function () {
    const controlador = new AbortController();

    async function carregarDashboard() {
      try {
        const respostas = await Promise.all([
          buscarResumo({}, controlador.signal),
          listarContatos({}, 1, 5, controlador.signal)
        ]);

        setResumo(respostas[0].resumo);
        setContatos(respostas[1].contatos || []);
      } catch (erro) {
        if (erro.name === 'AbortError') {
          return;
        }

        if (erro.statusHttp === 401) {
          removerToken();
          navegacao('/login', {
            replace: true,
            state: { mensagem: 'Sua sessão expirou. Faça login novamente.' }
          });
          return;
        }

        setMensagem(erro.message);
      } finally {
        if (!controlador.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    carregarDashboard();
    return function () { controlador.abort(); };
  }, [navegacao]);

  function sair() {
    removerToken();
    navegacao('/login', { replace: true });
  }

  return (
    <main className="pagina-administrativa">
      <div className="conteudo-administrativo">
        <CabecalhoAdministrativo
          aoSair={sair}
          titulo="Visão geral"
          subtitulo="Bem-vindo à sua Central de Comunicação."
        />

        {mensagem && <MensagemRetorno mensagem={mensagem} tipo="erro" />}
        {carregando && <Carregando mensagem="Carregando visão geral..." />}

        {!carregando && resumo && (
          <div className="grade-dashboard-admin">
            <div className="coluna-dashboard-principal">
              <section className="grade-indicadores-admin" aria-label="Indicadores gerais">
                <CartaoIndicador
                  tipo="contatos"
                  rotulo="Total de contatos"
                  valor={resumo.totalContatos}
                  detalhe="Base consolidada"
                />
                <CartaoIndicador
                  tipo="bairros"
                  rotulo="Bairros alcançados"
                  valor={resumo.porBairro.length}
                  detalhe="Regiões representadas"
                />
                <CartaoIndicador
                  tipo="mensagens"
                  rotulo="Mensagens autorizadas"
                  valor={obterTotalPorNome(resumo.porAutorizacaoMensagens, 'autorizado')}
                  detalhe="Autorizações explícitas"
                />
              </section>

              <div className="grade-graficos-admin">
                <GraficoBarrasHorizontais
                  titulo="Contatos por bairro"
                  itens={resumo.porBairro}
                  destino="/admin/relatorios"
                  filtro="bairro"
                />
                <GraficoBarrasVerticais
                  titulo="Principais necessidades"
                  itens={resumo.porProblema}
                  destino="/admin/relatorios"
                  filtro="problema"
                />
              </div>

              <TabelaContatosRecentes contatos={contatos} />
            </div>

            <ColunaLateralDashboard resumo={resumo} />
          </div>
        )}
      </div>
    </main>
  );
}

export default DashboardAdministrativo;
