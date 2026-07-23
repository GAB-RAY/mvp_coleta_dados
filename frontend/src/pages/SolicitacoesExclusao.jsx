import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import Carregando from '../components/Carregando';
import MensagemRetorno from '../components/MensagemRetorno';
import { analisarSolicitacao, listarSolicitacoes } from '../services/exclusaoService';
import { removerToken } from '../utils/armazenamentoToken';

function formatarData(valor) {
  return valor ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor)) : '—';
}

function SolicitacoesExclusao() {
  const navegacao = useNavigate();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState('');

  async function carregar() {
    setCarregando(true);
    try {
      const resposta = await listarSolicitacoes('');
      setSolicitacoes(resposta.solicitacoes || []);
    } catch (erro) {
      setMensagem(erro.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(function () { carregar(); }, []);

  async function analisar(id, decisao) {
    const texto = decisao === 'aprovar'
      ? 'A aprovação excluirá fisicamente o contato. Deseja continuar?'
      : 'Deseja rejeitar esta solicitação?';
    if (!window.confirm(texto)) {
      return;
    }
    try {
      const resposta = await analisarSolicitacao(id, decisao, null);
      setMensagem(resposta.mensagem);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  function sair() { removerToken(); navegacao('/login', { replace: true }); }

  return (
    <main className="pagina-administrativa"><div className="conteudo-administrativo">
      <CabecalhoAdministrativo aoSair={sair} titulo="Pedidos de exclusão" subtitulo="Aprove ou rejeite solicitações registradas pelos usuários do sistema." />
      {mensagem && <MensagemRetorno mensagem={mensagem} tipo="informacao" />}
      <section className="cartao painel-resultados">
        <div className="cabecalho-resultados"><div><h2>Solicitações</h2><p>A aprovação apaga fisicamente os dados pessoais do contato.</p></div></div>
        {carregando && <Carregando mensagem="Carregando solicitações..." />}
        {!carregando && <div className="tabela-responsiva"><table className="tabela-contatos"><thead><tr><th>Contato</th><th>Solicitante</th><th>Solicitada em</th><th>Status</th><th>Análise</th></tr></thead><tbody>{solicitacoes.map(function (item) { return <tr key={item.id}><td>{item.contatoNome || 'Contato excluído'}<br /><small>{item.contatoTelefone || 'ID original ' + item.contatoIdOriginal}</small></td><td>{item.solicitadaPor}</td><td>{formatarData(item.solicitadaEm)}</td><td>{item.status}</td><td>{item.status === 'pendente' ? <span className="acoes-tabela"><button className="botao botao-primario" type="button" onClick={function () { analisar(item.id, 'aprovar'); }}>Aprovar e excluir</button><button className="botao botao-secundario" type="button" onClick={function () { analisar(item.id, 'rejeitar'); }}>Rejeitar</button></span> : (item.analisadaPor || '—') + ' · ' + formatarData(item.analisadaEm)}</td></tr>; })}</tbody></table></div>}
      </section>
    </div></main>
  );
}

export default SolicitacoesExclusao;
