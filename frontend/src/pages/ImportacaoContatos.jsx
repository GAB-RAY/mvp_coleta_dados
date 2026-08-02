import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import CampoSelecao from '../components/CampoSelecao';
import MensagemRetorno from '../components/MensagemRetorno';
import {
  confirmarImportacao,
  excluirImportacao,
  listarImportacoes,
  listarOrigens,
  preVisualizarImportacao
} from '../services/contatoService';
import { obterUsuario, removerToken } from '../utils/armazenamentoToken';

const NOVA_ORIGEM = '__nova_origem__';

const ROTULOS_STATUS = {
  pre_visualizada: 'Pré-visualizada',
  processando: 'Processando',
  concluida: 'Concluída',
  falhou: 'Falhou'
};

function formatarData(data) {
  if (!data) {
    return 'Não confirmado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(data));
}

function ImportacaoContatos() {
  const navegacao = useNavigate();
  const usuario = obterUsuario();
  const usuarioAdministrador = usuario && usuario.perfil === 'administrador';
  const [arquivo, setArquivo] = useState(null);
  const [origem, setOrigem] = useState('');
  const [novaOrigem, setNovaOrigem] = useState('');
  const [origensImportacao, setOrigensImportacao] = useState([]);
  const [importacoes, setImportacoes] = useState([]);
  const [preVisualizacao, setPreVisualizacao] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState('informacao');

  async function carregarListas() {
    try {
      const respostas = await Promise.all([listarOrigens(), listarImportacoes()]);
      setOrigensImportacao((respostas[0].origens || []).filter(function (item) {
        return item.tipo === 'importacao';
      }));
      setImportacoes(respostas[1].importacoes || []);
    } catch (erro) {
      tratarErro(erro);
    }
  }

  useEffect(function () {
    carregarListas();
  }, []);

  function tratarErro(erro) {
    if (erro.statusHttp === 401) {
      removerToken();
      navegacao('/login', { replace: true });
      return;
    }

    setTipoMensagem('erro');
    setMensagem(erro.message);
  }

  async function visualizar(evento) {
    evento.preventDefault();
    setMensagem('');
    setRelatorio(null);

    const origemInformada = origem === NOVA_ORIGEM ? novaOrigem.trim() : origem;

    if (!arquivo || !origemInformada) {
      setTipoMensagem('erro');
      setMensagem('Selecione o arquivo e a origem da lista.');
      return;
    }

    setProcessando(true);
    try {
      const resposta = await preVisualizarImportacao(arquivo, origemInformada);
      setPreVisualizacao(resposta.importacao);
      setTipoMensagem('sucesso');
      setMensagem(resposta.mensagem);
      await carregarListas();
    } catch (erro) {
      tratarErro(erro);
    } finally {
      setProcessando(false);
    }
  }

  async function confirmar() {
    setProcessando(true);
    setMensagem('');
    try {
      const resposta = await confirmarImportacao(preVisualizacao.importacaoId);
      setRelatorio(resposta.relatorio);
      setTipoMensagem('sucesso');
      setMensagem(resposta.mensagem);
      await carregarListas();
    } catch (erro) {
      tratarErro(erro);
    } finally {
      setProcessando(false);
    }
  }

  async function excluir(item) {
    const confirmado = window.confirm(
      'Excluir o registro da importação "' + item.origem.nome + '"? ' +
      'Os contatos já importados serão preservados.'
    );

    if (!confirmado) {
      return;
    }

    setProcessando(true);
    setMensagem('');

    try {
      const resposta = await excluirImportacao(item.id);
      setTipoMensagem('sucesso');
      setMensagem(resposta.mensagem);

      if (preVisualizacao && String(preVisualizacao.importacaoId) === String(item.id)) {
        setPreVisualizacao(null);
        setRelatorio(null);
      }

      await carregarListas();
    } catch (erro) {
      tratarErro(erro);
    } finally {
      setProcessando(false);
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
          titulo="Importações"
          subtitulo="Valide e importe listas de contatos com segurança."
        />
        <Link className="link-voltar" to="/admin/contatos">← Voltar para contatos</Link>

        <section className="cartao painel-filtros">
          <div className="cabecalho-secao">
            <div><span className="etiqueta-pagina">Operação interna</span><h2>Importar contatos</h2></div>
            <p>CSV ou XLSX, até 5 MB e 20.000 linhas.</p>
          </div>
          <MensagemRetorno mensagem={mensagem} tipo={tipoMensagem} />
          <form className="formulario-importacao" onSubmit={visualizar}>
            <CampoSelecao
              id="origem-importacao"
              nome="origem"
              rotulo="Origem da lista"
              valor={origem}
              aoAlterar={function (evento) { setOrigem(evento.target.value); }}
              opcoes={origensImportacao.map(function (item) {
                return { valor: item.nome, rotulo: item.nome };
              }).concat([{ valor: NOVA_ORIGEM, rotulo: 'Cadastrar nova origem' }])}
              placeholder="Selecione uma origem"
              obrigatorio
              desabilitado={processando}
            />
            {origem === NOVA_ORIGEM && (
              <div className="grupo-campo">
                <label htmlFor="nova-origem-importacao">Nome da nova origem *</label>
                <input
                  id="nova-origem-importacao"
                  className="campo-input"
                  value={novaOrigem}
                  onChange={function (evento) { setNovaOrigem(evento.target.value); }}
                  placeholder="Ex.: Lista reunião comunitária"
                  required
                  disabled={processando}
                />
              </div>
            )}
            <div className="grupo-campo grupo-arquivo-importacao">
              <span>Arquivo *</span>
              <input id="arquivo-importacao" className="input-arquivo-oculto" type="file" accept=".csv,.xlsx" onChange={function (evento) { setArquivo(evento.target.files[0] || null); }} />
              <label className="seletor-arquivo" htmlFor="arquivo-importacao">
                <span className="icone-seletor-arquivo" aria-hidden="true">↑</span>
                <span><strong>{arquivo ? arquivo.name : 'Escolher arquivo'}</strong><small>CSV ou XLSX, até 5 MB</small></span>
              </label>
            </div>
            <button className="botao botao-primario" disabled={processando} type="submit">
              {processando ? 'Validando...' : 'Pré-visualizar'}
            </button>
          </form>
        </section>

        {preVisualizacao && !relatorio && (
          <section className="cartao painel-resultados">
            <h2>Pré-visualização</h2>
            <p>{preVisualizacao.totalRecebido} linhas: {preVisualizacao.validos} válidas e {preVisualizacao.invalidos} inválidas.</p>
            <div className="tabela-responsiva">
              <table className="tabela-contatos tabela-importacao">
                <thead><tr><th>Linha</th><th>Telefone</th><th>Nome</th><th>Bairro</th><th>Situação</th></tr></thead>
                <tbody>
                  {preVisualizacao.linhas.map(function (linha) {
                    return (
                      <tr key={linha.numeroLinha}>
                        <td>{linha.numeroLinha}</td>
                        <td>{linha.dados.telefone || 'Não informado'}</td>
                        <td>{linha.dados.nome || 'Não informado'}</td>
                        <td>{linha.dados.bairro || 'Não informado'}</td>
                        <td>{linha.valida ? 'Válida' : linha.erro}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button className="botao botao-primario botao-confirmar-importacao" type="button" onClick={confirmar} disabled={processando}>
              {processando ? 'Importando...' : 'Confirmar importação'}
            </button>
          </section>
        )}

        {relatorio && (
          <section className="cartao painel-resultados">
            <h2>Relatório final</h2>
            <div className="resumo-importacao">
              <span>Total: {relatorio.totalRecebido}</span>
              <span>Criados: {relatorio.criados}</span>
              <span>Complementados: {relatorio.complementados}</span>
              <span>Ignorados: {relatorio.ignorados}</span>
              <span>Duplicados: {relatorio.duplicados}</span>
              <span>Inválidos: {relatorio.invalidos}</span>
            </div>
          </section>
        )}

        <section className="cartao painel-resultados historico-importacoes">
          <div className="cabecalho-resultados">
            <div>
              <h2>Importações realizadas</h2>
              <p>Histórico dos arquivos processados, sem exibir os dados dos contatos.</p>
            </div>
          </div>

          {importacoes.length === 0 && (
            <p className="estado-vazio-importacoes">Nenhuma importação registrada.</p>
          )}

          {importacoes.length > 0 && (
            <div className="tabela-responsiva">
              <table className="tabela-contatos tabela-historico-importacoes">
                <thead>
                  <tr>
                    <th>Origem</th>
                    <th>Arquivo</th>
                    <th>Status</th>
                    <th>Linhas</th>
                    <th>Responsável</th>
                    <th>Data</th>
                    {usuarioAdministrador && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {importacoes.map(function (item) {
                    return (
                      <tr key={item.id}>
                        <td>{item.origem.nome}</td>
                        <td>{item.nomeArquivo}</td>
                        <td>{ROTULOS_STATUS[item.status] || item.status}</td>
                        <td>{item.totalRecebido}</td>
                        <td>{item.responsavel}</td>
                        <td>{formatarData(item.confirmadoEm || item.criadoEm)}</td>
                        {usuarioAdministrador && (
                          <td>
                            <button
                              className="botao botao-perigo botao-excluir-importacao"
                              type="button"
                              onClick={function () { excluir(item); }}
                              disabled={processando || item.status === 'processando'}
                            >
                              Excluir
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default ImportacaoContatos;
