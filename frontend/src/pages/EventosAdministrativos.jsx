import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import CampoFormulario from '../components/CampoFormulario';
import Carregando from '../components/Carregando';
import MensagemRetorno from '../components/MensagemRetorno';
import {
  alterarStatusEvento,
  atualizarStatusInscricao,
  criarEvento,
  editarEvento,
  excluirEvento,
  listarEventos,
  listarParticipantesEvento
} from '../services/eventoService';
import { obterUsuario, removerToken } from '../utils/armazenamentoToken';

const FORMULARIO_INICIAL = {
  nome: '',
  descricao: '',
  dataInicial: '',
  dataFinal: ''
};

function paraCampoDataHora(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  const deslocamento = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
}

function EventosAdministrativos() {
  const navegacao = useNavigate();
  const usuario = obterUsuario();
  const usuarioAdministrador = usuario && usuario.perfil === 'administrador';
  const [eventos, setEventos] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [eventoEdicao, setEventoEdicao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [eventoQr, setEventoQr] = useState(null);
  const [eventoParticipantes,setEventoParticipantes]=useState(null);
  const [participantes,setParticipantes]=useState([]);
  const [filtrosParticipantes,setFiltrosParticipantes]=useState({nome:'',telefone:'',statusInscricao:'',statusMensagem:''});

  async function carregar() {
    setCarregando(true);
    try {
      const resposta = await listarEventos();
      setEventos(resposta.eventos || []);
    } catch (erro) {
      if (erro.statusHttp === 401) {
        removerToken();
        navegacao('/login', { replace: true });
      } else {
        setMensagem(erro.message);
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(function () {
    carregar();
  }, []);

  function alterar(evento) {
    setFormulario(Object.assign({}, formulario, {
      [evento.target.name]: evento.target.value
    }));
  }

  function prepararEdicao(evento) {
    setEventoEdicao(evento.id);
    setFormulario({
      nome: evento.nome,
      descricao: evento.descricao,
      dataInicial: paraCampoDataHora(evento.dataInicial),
      dataFinal: paraCampoDataHora(evento.dataFinal)
    });
  }

  async function salvar(evento) {
    evento.preventDefault();
    setMensagem('');
    try {
      const resposta = eventoEdicao
        ? await editarEvento(eventoEdicao, formulario)
        : await criarEvento(formulario);
      setMensagem(resposta.mensagem);
      if (!eventoEdicao) setEventoQr(resposta.evento);
      setEventoEdicao(null);
      setFormulario(FORMULARIO_INICIAL);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function mudarStatus(id, acao) {
    const pergunta = acao === 'ativar'
      ? 'Ativar este evento?'
      : 'Encerrar este evento?';

    if (!window.confirm(pergunta)) {
      return;
    }

    try {
      const resposta = await alterarStatusEvento(id, acao);
      setMensagem(resposta.mensagem);
      if (acao === 'ativar') {
        setEventoQr(resposta.evento);
      } else if (eventoQr && eventoQr.id === id) {
        setEventoQr(null);
      }
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function removerEvento(item) {
    if (!window.confirm(
      'Excluir o evento "' + item.nome + '"? Ele sairá do painel, mas participantes e históricos serão preservados.'
    )) {
      return;
    }
    try {
      const resposta = await excluirEvento(item.id);
      setMensagem(resposta.mensagem);
      if (eventoQr && eventoQr.id === item.id) setEventoQr(null);
      if (eventoParticipantes && eventoParticipantes.id === item.id) {
        setEventoParticipantes(null);
      }
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  function cancelarEdicao() {
    setEventoEdicao(null);
    setFormulario(FORMULARIO_INICIAL);
  }

  function obterLinkEvento(evento) {
    return window.location.origin + '/participar?evento=' + evento.id;
  }

  async function carregarParticipantes(item){try{const resposta=await listarParticipantesEvento(item.id,filtrosParticipantes);setEventoParticipantes(item);setParticipantes(resposta.participantes||[]);}catch(erro){setMensagem(erro.message);}}
  async function alterarInscricao(contatoId,status){try{await atualizarStatusInscricao(eventoParticipantes.id,contatoId,status);await carregarParticipantes(eventoParticipantes);}catch(erro){setMensagem(erro.message);}}

  async function copiarLinkEvento() {
    try {
      await navigator.clipboard.writeText(obterLinkEvento(eventoQr));
      setMensagem('Link exclusivo do evento copiado.');
    } catch (erro) {
      setMensagem('Não foi possível copiar automaticamente. Selecione o link exibido.');
    }
  }

  function baixarQrCode() {
    const elemento = document.getElementById('qr-evento-' + eventoQr.id);

    if (!elemento) {
      setMensagem('Não foi possível gerar o arquivo do QR Code.');
      return;
    }

    const conteudo = new XMLSerializer().serializeToString(elemento);
    const arquivo = new Blob([conteudo], { type: 'image/svg+xml;charset=utf-8' });
    const endereco = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = endereco;
    link.download = 'qr-evento-' + eventoQr.id + '.svg';
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(endereco);
    }, 0);
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
          titulo="Eventos"
          subtitulo={usuarioAdministrador
            ? 'Defina o evento associado automaticamente ao formulário público.'
            : 'Consulte eventos e participantes inscritos.'}
        />

        {mensagem && <MensagemRetorno mensagem={mensagem} tipo="informacao" />}

        {eventoQr && (
          <section className="cartao painel-qr-evento" aria-labelledby="titulo-qr-evento">
            <div className="conteudo-qr-evento">
              <div>
                <span className="etiqueta-pagina">Inscrição pública</span>
                <h2 id="titulo-qr-evento">QR Code — {eventoQr.nome}</h2>
                <p>
                  Este endereço funciona exclusivamente enquanto o evento estiver ativo,
                  até {String(eventoQr.dataFinal).slice(0, 10)}.
                </p>
                <input
                  className="link-qr-evento"
                  type="text"
                  value={obterLinkEvento(eventoQr)}
                  readOnly
                  aria-label="Link exclusivo do evento"
                />
                <div className="acoes-filtros">
                  <button className="botao botao-primario" type="button" onClick={baixarQrCode}>
                    Baixar QR Code
                  </button>
                  <button className="botao botao-secundario" type="button" onClick={copiarLinkEvento}>
                    Copiar link
                  </button>
                  <button className="botao botao-secundario" type="button" onClick={function () { setEventoQr(null); }}>
                    Fechar
                  </button>
                </div>
              </div>
              <div className="imagem-qr-evento">
                <QRCodeSVG
                  id={'qr-evento-' + eventoQr.id}
                  value={obterLinkEvento(eventoQr)}
                  size={220}
                  level="H"
                  marginSize={2}
                  title={'Inscrição no evento ' + eventoQr.nome}
                />
              </div>
            </div>
          </section>
        )}

        {eventoParticipantes&&(
          <section className="cartao painel-resultados"><div className="cabecalho-secao"><div><span className="etiqueta-pagina">Participantes</span><h2>{eventoParticipantes.nome}</h2></div><button className="botao botao-secundario" type="button" onClick={function(){setEventoParticipantes(null);}}>Fechar</button></div><div className="grade-filtros"><label>Nome<input className="campo-input" value={filtrosParticipantes.nome} onChange={function(e){setFiltrosParticipantes(Object.assign({},filtrosParticipantes,{nome:e.target.value}));}}/></label><label>Telefone<input className="campo-input" value={filtrosParticipantes.telefone} onChange={function(e){setFiltrosParticipantes(Object.assign({},filtrosParticipantes,{telefone:e.target.value}));}}/></label><label>Status da inscrição<select className="campo-input" value={filtrosParticipantes.statusInscricao} onChange={function(e){setFiltrosParticipantes(Object.assign({},filtrosParticipantes,{statusInscricao:e.target.value}));}}><option value="">Todos</option><option value="inscrito">Inscrito</option><option value="confirmado">Confirmado</option><option value="presente">Presente</option><option value="cancelado">Cancelado</option></select></label><button className="botao botao-primario" type="button" onClick={function(){carregarParticipantes(eventoParticipantes);}}>Buscar</button></div><div className="tabela-responsiva"><table className="tabela-contatos"><thead><tr><th>Nome</th><th>Telefone</th><th>Inscrição</th><th>Comunicação</th><th>Data</th></tr></thead><tbody>{participantes.map(function(item){return <tr key={item.id}><td>{item.nome}</td><td>{item.telefone}</td><td><select value={item.status_inscricao} onChange={function(e){alterarInscricao(item.id,e.target.value);}}><option value="inscrito">Inscrito</option><option value="confirmado">Confirmado</option><option value="presente">Presente</option><option value="cancelado">Cancelado</option></select></td><td>{item.status_mensagem.replaceAll('_',' ')}</td><td>{new Date(item.cadastrado_em).toLocaleString('pt-BR')}</td></tr>;})}</tbody></table></div></section>
        )}

        {usuarioAdministrador && (
          <section className="cartao painel-filtros">
            <div className="cabecalho-secao">
              <div>
                <span className="etiqueta-pagina">Gestão de eventos</span>
                <h2>{eventoEdicao ? 'Editar evento' : 'Novo evento'}</h2>
              </div>
            </div>
            <form className="formulario-filtros" onSubmit={salvar}>
              <fieldset className="grade-filtros">
                <CampoFormulario id="nome" rotulo="Nome" valor={formulario.nome} aoAlterar={alterar} obrigatorio />
                <CampoFormulario id="descricao" rotulo="Descrição" valor={formulario.descricao} aoAlterar={alterar} obrigatorio />
                <CampoFormulario id="dataInicial" rotulo="Início do evento" tipo="datetime-local" valor={formulario.dataInicial} aoAlterar={alterar} obrigatorio />
                <CampoFormulario id="dataFinal" rotulo="Fim do evento" tipo="datetime-local" valor={formulario.dataFinal} aoAlterar={alterar} obrigatorio />
              </fieldset>
              <div className="acoes-filtros">
                <button className="botao botao-primario" type="submit">
                  {eventoEdicao ? 'Salvar alterações' : 'Cadastrar evento'}
                </button>
                {eventoEdicao && (
                  <button className="botao botao-secundario" type="button" onClick={cancelarEdicao}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        <section className="cartao painel-resultados">
          <div className="cabecalho-resultados">
            <div>
              <h2>Eventos cadastrados</h2>
              <p>Vários eventos podem permanecer ativos simultaneamente.</p>
            </div>
          </div>

          {carregando && <Carregando mensagem="Carregando eventos..." />}
          {!carregando && (
            <div className="tabela-responsiva">
              <table className="tabela-contatos">
                <thead>
                  <tr><th>Nome</th><th>Período</th><th>Status</th><th>Cadastros</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {eventos.map(function (item) {
                    return (
                      <tr key={item.id}>
                        <td><strong>{item.nome}</strong><br /><small>{item.descricao}</small></td>
                        <td>{new Date(item.dataInicial).toLocaleString('pt-BR')} a {new Date(item.dataFinal).toLocaleString('pt-BR')}</td>
                        <td><span className="badge-consentimento consentimento-nao-informado">{item.status}</span></td>
                        <td>{item.totalCadastros || 0}</td>
                        <td className="acoes-tabela">
                          <button
                            className="botao botao-secundario"
                            type="button"
                            onClick={function () {
                              carregarParticipantes(item);
                            }}
                          >
                            Ver participantes
                          </button>
                          {usuarioAdministrador && (
                            <>
                              <button className="botao botao-secundario" type="button" onClick={function () { prepararEdicao(item); }}>Editar</button>
                              <button className="botao botao-primario" type="button" onClick={function () { setEventoQr(item); }}>QR Code</button>
                              {item.status === 'rascunho' && (
                                <button className="botao botao-primario" type="button" onClick={function () { mudarStatus(item.id, 'ativar'); }}>Ativar</button>
                              )}
                              {item.status === 'ativo' && (
                                <>
                                  <button className="botao botao-secundario" type="button" onClick={function () { mudarStatus(item.id, 'encerrar'); }}>Encerrar</button>
                                </>
                              )}
                              <button className="botao botao-perigo" type="button" onClick={function () { removerEvento(item); }}>Excluir</button>
                            </>
                          )}
                        </td>
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

export default EventosAdministrativos;
