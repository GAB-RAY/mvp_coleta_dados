import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import Carregando from '../components/Carregando';
import MensagemRetorno from '../components/MensagemRetorno';
import { buscarDetalhesContato } from '../services/contatoService';
import { removerToken } from '../utils/armazenamentoToken';
import formatarTelefone from '../utils/formatarTelefone';

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
});

function formatarData(valor) {
  if (!valor) {
    return 'Não informado';
  }

  const data = new Date(valor);

  return Number.isNaN(data.getTime()) ? 'Não informado' : formatadorData.format(data);
}

function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 'Não informado';
  }

  if (valor === true) {
    return 'Sim';
  }

  if (valor === false) {
    return 'Não';
  }

  return String(valor);
}

function DetalhesContato() {
  const parametros = useParams();
  const navegacao = useNavigate();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(function () {
    const controlador = new AbortController();

    async function carregar() {
      try {
        const resposta = await buscarDetalhesContato(parametros.id, controlador.signal);
        setDados(resposta);
      } catch (erroRecebido) {
        if (erroRecebido.name === 'AbortError') {
          return;
        }

        if (erroRecebido.statusHttp === 401) {
          removerToken();
          navegacao('/login', { replace: true });
          return;
        }

        setErro(erroRecebido.message);
      } finally {
        if (!controlador.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    carregar();

    return function () {
      controlador.abort();
    };
  }, [parametros.id, navegacao]);

  function sair() {
    removerToken();
    navegacao('/login', { replace: true });
  }

  return (
    <main className="pagina-administrativa">
      <div className="conteudo-administrativo">
        <CabecalhoAdministrativo aoSair={sair} />
        <Link className="link-voltar" to="/admin/contatos">← Voltar para contatos</Link>

        {carregando && <Carregando mensagem="Carregando detalhes..." />}
        {!carregando && erro && <MensagemRetorno mensagem={erro} tipo="erro" />}

        {!carregando && dados && (
          <div className="grade-detalhes">
            <section className="cartao painel-detalhes">
              <h2>Dados do contato</h2>
              <dl className="lista-detalhes">
                <div><dt>Nome</dt><dd>{dados.contato.nome}</dd></div>
                <div><dt>Telefone</dt><dd>{formatarTelefone(dados.contato.telefone)}</dd></div>
                <div><dt>Idade</dt><dd>{formatarValor(dados.contato.idade)}</dd></div>
                <div><dt>Bairro</dt><dd>{dados.contato.bairro}</dd></div>
                <div><dt>Categoria</dt><dd>{dados.contato.problema}</dd></div>
                <div><dt>Descrição</dt><dd>{formatarValor(dados.contato.descricaoProblema)}</dd></div>
                <div><dt>Votou na última eleição</dt><dd>{formatarValor(dados.contato.participouEleicaoAnterior)}</dd></div>
                <div><dt>Origem</dt><dd>{formatarValor(dados.contato.origemAtual)}</dd></div>
                <div><dt>Status</dt><dd>{formatarValor(dados.contato.statusContato)}</dd></div>
                <div><dt>Cadastrado em</dt><dd>{formatarData(dados.contato.criadoEm)}</dd></div>
              </dl>
            </section>

            <section className="cartao painel-detalhes">
              <h2>Aceites de privacidade</h2>
              {dados.aceitesPrivacidade.length === 0 && <p>Nenhum aceite registrado.</p>}
              {dados.aceitesPrivacidade.map(function (aceite) {
                return (
                  <article className="registro-historico" key={aceite.id}>
                    <strong>{aceite.versaoTexto}</strong>
                    <p>{aceite.textoApresentado}</p>
                    <small>{formatarData(aceite.criadoEm)} · {formatarValor(aceite.origem)}</small>
                  </article>
                );
              })}
            </section>

            <section className="cartao painel-detalhes">
              <h2>Autorizações e consentimentos</h2>
              {dados.consentimentos.length === 0 && <p>Nenhum registro.</p>}
              {dados.consentimentos.map(function (consentimento) {
                return (
                  <article className="registro-historico" key={consentimento.id}>
                    <strong>{consentimento.tipo}: {consentimento.estado}</strong>
                    <p>{consentimento.textoApresentado}</p>
                    <small>{formatarData(consentimento.criadoEm)} · {consentimento.canal}</small>
                  </article>
                );
              })}
            </section>

            <section className="cartao painel-detalhes">
              <h2>Histórico de alterações</h2>
              {dados.historico.length === 0 && <p>Nenhuma alteração registrada.</p>}
              {dados.historico.map(function (historico) {
                return (
                  <article className="registro-historico" key={historico.id}>
                    <strong>{historico.tipoEvento}</strong>
                    <p>Novos dados: {JSON.stringify(historico.dadosNovos)}</p>
                    <small>{formatarData(historico.criadoEm)} · {formatarValor(historico.origem)}</small>
                  </article>
                );
              })}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

export default DetalhesContato;
