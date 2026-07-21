import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import MensagemRetorno from '../components/MensagemRetorno';
import {
  confirmarImportacao,
  preVisualizarImportacao
} from '../services/contatoService';
import { removerToken } from '../utils/armazenamentoToken';

function ImportacaoContatos() {
  const navegacao = useNavigate();
  const [arquivo, setArquivo] = useState(null);
  const [origem, setOrigem] = useState('');
  const [preVisualizacao, setPreVisualizacao] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState('informacao');

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

    if (!arquivo || !origem.trim()) {
      setTipoMensagem('erro');
      setMensagem('Selecione o arquivo e informe a origem da lista.');
      return;
    }

    setProcessando(true);
    try {
      const resposta = await preVisualizarImportacao(arquivo, origem.trim());
      setPreVisualizacao(resposta.importacao);
      setTipoMensagem('sucesso');
      setMensagem(resposta.mensagem);
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
        <CabecalhoAdministrativo aoSair={sair} />
        <Link className="link-voltar" to="/admin/contatos">← Voltar para contatos</Link>

        <section className="cartao painel-filtros">
          <div className="cabecalho-secao">
            <div><span className="etiqueta-pagina">Operação interna</span><h2>Importar contatos</h2></div>
            <p>CSV ou XLSX, até 5 MB e 5000 linhas.</p>
          </div>
          <MensagemRetorno mensagem={mensagem} tipo={tipoMensagem} />
          <form className="formulario-importacao" onSubmit={visualizar}>
            <div className="grupo-campo">
              <label htmlFor="origem-importacao">Origem da lista *</label>
              <input id="origem-importacao" className="campo-input" value={origem} onChange={function (evento) { setOrigem(evento.target.value); }} placeholder="Ex.: Lista reunião comunitária" />
            </div>
            <div className="grupo-campo">
              <label htmlFor="arquivo-importacao">Arquivo *</label>
              <input id="arquivo-importacao" className="campo-input" type="file" accept=".csv,.xlsx" onChange={function (evento) { setArquivo(evento.target.files[0] || null); }} />
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
                        <td>{linha.dados.telefone || '—'}</td>
                        <td>{linha.dados.nome || '—'}</td>
                        <td>{linha.dados.bairro || '—'}</td>
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
      </div>
    </main>
  );
}

export default ImportacaoContatos;
