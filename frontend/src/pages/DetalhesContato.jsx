import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import Carregando from '../components/Carregando';
import MensagemRetorno from '../components/MensagemRetorno';
import {
  buscarDetalhesContato,
  revogarConsentimentos,
  solicitarExclusaoContato
} from '../services/contatoService';
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
  const [acaoEmAndamento, setAcaoEmAndamento] = useState('');
  const [mensagemAcao, setMensagemAcao] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [motivoRevogacao, setMotivoRevogacao] = useState('');

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

  function tratarErroDeAcao(erroRecebido) {
    if (erroRecebido.statusHttp === 401) {
      removerToken();
      navegacao('/login', { replace: true });
      return;
    }

    setErroAcao(erroRecebido.message);
  }

  async function atualizarDetalhes() {
    const resposta = await buscarDetalhesContato(parametros.id);
    setDados(resposta);
  }

  async function executarRevogacao(tipo, descricao) {
    const confirmado = window.confirm(
      'Confirma a revogação do consentimento para ' + descricao + '?'
    );

    if (!confirmado) {
      return;
    }

    setAcaoEmAndamento('revogacao');
    setMensagemAcao('');
    setErroAcao('');

    try {
      const resposta = await revogarConsentimentos(
        parametros.id,
        tipo,
        motivoRevogacao
      );
      setMensagemAcao(resposta.mensagem);
      setMotivoRevogacao('');
      await atualizarDetalhes();
    } catch (erroRecebido) {
      tratarErroDeAcao(erroRecebido);
    } finally {
      setAcaoEmAndamento('');
    }
  }

  async function registrarSolicitacaoExclusao() {
    const confirmado = window.confirm(
      'Confirma o registro do pedido de exclusão? O contato ficará bloqueado para campanhas.'
    );

    if (!confirmado) {
      return;
    }

    setAcaoEmAndamento('exclusao');
    setMensagemAcao('');
    setErroAcao('');

    try {
      const resposta = await solicitarExclusaoContato(parametros.id);
      setMensagemAcao(resposta.mensagem);
      await atualizarDetalhes();
    } catch (erroRecebido) {
      tratarErroDeAcao(erroRecebido);
    } finally {
      setAcaoEmAndamento('');
    }
  }

  return (
    <main className="pagina-administrativa">
      <div className="conteudo-administrativo">
        <CabecalhoAdministrativo
          aoSair={sair}
          titulo="Detalhes do contato"
          subtitulo="Consulte os dados, autorizações e o histórico deste cadastro."
        />
        <Link className="link-voltar" to="/admin/contatos">← Voltar para contatos</Link>

        {carregando && <Carregando mensagem="Carregando detalhes..." />}
        {!carregando && erro && <MensagemRetorno mensagem={erro} tipo="erro" />}

        {!carregando && dados && (
          <div className="grade-detalhes">
            <section className="cartao painel-detalhes">
              <div className="cabecalho-painel-detalhes">
                <h2>Dados do contato</h2>
                <Link
                  className="botao botao-secundario"
                  to={'/admin/contatos/novo?contatoId=' + dados.contato.id}
                >
                  Editar contato
                </Link>
              </div>
              <dl className="lista-detalhes">
                <div><dt>Nome</dt><dd>{formatarValor(dados.contato.nome)}</dd></div>
                <div><dt>Telefone</dt><dd>{formatarTelefone(dados.contato.telefone)}</dd></div>
                <div><dt>Idade</dt><dd>{formatarValor(dados.contato.idade)}</dd></div>
                <div><dt>Bairro</dt><dd>{formatarValor(dados.contato.bairro)}</dd></div>
                <div><dt>Categoria</dt><dd>{formatarValor(dados.contato.problema)}</dd></div>
                <div><dt>Descrição</dt><dd>{formatarValor(dados.contato.descricaoProblema)}</dd></div>
                <div><dt>Origem</dt><dd>{formatarValor(dados.contato.origemAtual)}</dd></div>
                <div><dt>Evento(s)</dt><dd>{dados.contato.eventos && dados.contato.eventos.length > 0 ? dados.contato.eventos.map(function (evento) { return evento.nome + ' (' + formatarData(evento.cadastradoEm) + ')'; }).join(', ') : 'Cadastro geral, sem evento'}</dd></div>
                <div><dt>Status</dt><dd>{formatarValor(dados.contato.statusContato)}</dd></div>
                <div><dt>Cadastrado em</dt><dd>{formatarData(dados.contato.criadoEm)}</dd></div>
              </dl>
            </section>

            <section className="cartao painel-detalhes painel-acoes-privacidade">
              <h2>Privacidade e bloqueios</h2>
              <dl className="lista-detalhes lista-bloqueios">
                <div>
                  <dt>Mensagens</dt>
                  <dd>{dados.contato.bloqueadoParaMensagens ? 'Bloqueadas' : 'Sem bloqueio administrativo'}</dd>
                </div>
                <div>
                  <dt>Ligações</dt>
                  <dd>{dados.contato.bloqueadoParaLigacoes ? 'Bloqueadas' : 'Sem bloqueio administrativo'}</dd>
                </div>
                <div>
                  <dt>Campanhas</dt>
                  <dd>{dados.contato.bloqueadoParaCampanhas ? 'Bloqueadas' : 'Sem bloqueio administrativo'}</dd>
                </div>
                <div>
                  <dt>Pedido de exclusão</dt>
                  <dd>{formatarData(dados.contato.exclusaoSolicitadaEm)}</dd>
                </div>
                {dados.contato.exclusaoSolicitadaPor && (
                  <div>
                    <dt>Responsável</dt>
                    <dd>{formatarValor(dados.contato.exclusaoSolicitadaPor.nome)}</dd>
                  </div>
                )}
              </dl>

              <div className="grupo-campo campo-motivo-revogacao">
                <label htmlFor="motivoRevogacao">Motivo da revogação (opcional)</label>
                <textarea
                  className="campo-textarea"
                  disabled={acaoEmAndamento !== ''}
                  id="motivoRevogacao"
                  maxLength={500}
                  onChange={function (evento) {
                    setMotivoRevogacao(evento.target.value);
                  }}
                  placeholder="Ex.: solicitação feita pela própria pessoa"
                  rows={3}
                  value={motivoRevogacao}
                />
                <small>{motivoRevogacao.length}/500 caracteres</small>
              </div>

              <div className="acoes-privacidade">
                <button
                  className="botao botao-secundario"
                  disabled={acaoEmAndamento !== '' || dados.contato.autorizacaoMensagens !== 'autorizado'}
                  onClick={function () {
                    executarRevogacao('mensagens', 'mensagens');
                  }}
                  type="button"
                >
                  Revogar mensagens
                </button>
                <button
                  className="botao botao-secundario"
                  disabled={acaoEmAndamento !== '' || dados.contato.autorizacaoLigacoes !== 'autorizado'}
                  onClick={function () {
                    executarRevogacao('ligacoes', 'ligações');
                  }}
                  type="button"
                >
                  Revogar ligações
                </button>
                <button
                  className="botao botao-secundario"
                  disabled={
                    acaoEmAndamento !== '' ||
                    (
                      dados.contato.autorizacaoMensagens !== 'autorizado' &&
                      dados.contato.autorizacaoLigacoes !== 'autorizado'
                    )
                  }
                  onClick={function () {
                    executarRevogacao('ambos', 'mensagens e ligações');
                  }}
                  type="button"
                >
                  Revogar ambos
                </button>
                <button
                  className="botao botao-perigo"
                  disabled={acaoEmAndamento !== '' || Boolean(dados.contato.exclusaoSolicitadaEm)}
                  onClick={registrarSolicitacaoExclusao}
                  type="button"
                >
                  Registrar pedido de exclusão
                </button>
              </div>

              {acaoEmAndamento && <p className="texto-acao-privacidade">Registrando ação...</p>}
              <MensagemRetorno mensagem={mensagemAcao} tipo="sucesso" />
              <MensagemRetorno mensagem={erroAcao} tipo="erro" />
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
                    {consentimento.motivoRevogacao && (
                      <p><strong>Motivo:</strong> {consentimento.motivoRevogacao}</p>
                    )}
                    <small>
                      {formatarData(consentimento.criadoEm)} · {consentimento.canal}
                      {consentimento.registradoPor ? ' · ' + consentimento.registradoPor : ''}
                    </small>
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
                    <small>
                      {formatarData(historico.criadoEm)} · {formatarValor(historico.origem)}
                      {historico.usuario ? ' · ' + historico.usuario : ''}
                    </small>
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
