import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import CampoFormulario from '../components/CampoFormulario';
import Carregando from '../components/Carregando';
import MensagemRetorno from '../components/MensagemRetorno';
import {
  alterarStatusEvento,
  criarEvento,
  editarEvento,
  listarEventos
} from '../services/eventoService';
import { obterUsuario, removerToken } from '../utils/armazenamentoToken';

const FORMULARIO_INICIAL = {
  nome: '',
  motivo: '',
  dataInicial: '',
  dataFinal: ''
};

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
      motivo: evento.motivo,
      dataInicial: String(evento.dataInicial).slice(0, 10),
      dataFinal: String(evento.dataFinal).slice(0, 10)
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

  function cancelarEdicao() {
    setEventoEdicao(null);
    setFormulario(FORMULARIO_INICIAL);
  }

  function obterLinkEvento(evento) {
    return window.location.origin + '/participar?evento=' + evento.id;
  }

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
                <CampoFormulario id="motivo" rotulo="Motivo" valor={formulario.motivo} aoAlterar={alterar} obrigatorio />
                <CampoFormulario id="dataInicial" rotulo="Data inicial" tipo="date" valor={formulario.dataInicial} aoAlterar={alterar} obrigatorio />
                <CampoFormulario id="dataFinal" rotulo="Data final" tipo="date" valor={formulario.dataFinal} aoAlterar={alterar} obrigatorio />
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
              <p>Somente um evento pode permanecer ativo.</p>
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
                        <td><strong>{item.nome}</strong><br /><small>{item.motivo}</small></td>
                        <td>{String(item.dataInicial).slice(0, 10)} a {String(item.dataFinal).slice(0, 10)}</td>
                        <td><span className="badge-consentimento consentimento-nao-informado">{item.status}</span></td>
                        <td>{item.totalCadastros || 0}</td>
                        <td className="acoes-tabela">
                          <button
                            className="botao botao-secundario"
                            type="button"
                            onClick={function () {
                              navegacao('/admin/contatos?eventoId=' + item.id);
                            }}
                          >
                            Ver participantes
                          </button>
                          {usuarioAdministrador && (
                            <>
                              <button className="botao botao-secundario" type="button" onClick={function () { prepararEdicao(item); }}>Editar</button>
                              {item.status === 'rascunho' && (
                                <button className="botao botao-primario" type="button" onClick={function () { mudarStatus(item.id, 'ativar'); }}>Ativar</button>
                              )}
                              {item.status === 'ativo' && (
                                <>
                                  <button className="botao botao-primario" type="button" onClick={function () { setEventoQr(item); }}>QR Code</button>
                                  <button className="botao botao-secundario" type="button" onClick={function () { mudarStatus(item.id, 'encerrar'); }}>Encerrar</button>
                                </>
                              )}
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
