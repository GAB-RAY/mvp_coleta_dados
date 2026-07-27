import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CampoFormulario from '../components/CampoFormulario';
import CampoSelecao from '../components/CampoSelecao';
import CampoSelecaoPesquisavel from '../components/CampoSelecaoPesquisavel';
import MensagemRetorno from '../components/MensagemRetorno';
import {
  TEXTO_AVISO_PRIVACIDADE,
  TEXTO_LIGACOES,
  TEXTO_MENSAGENS
} from '../data/textosConsentimento';
import {
  buscarOpcoesFormulario,
  cadastrarContato,
  inscreverContatoExistenteEvento,
  verificarContatoEvento
} from '../services/contatoService';

const ETAPA_IDENTIFICACAO = 'identificacao';
const ETAPA_CONFIRMACAO = 'confirmacao';
const ETAPA_FORMULARIO_COMPLETO = 'formulario_completo';

const FORMULARIO_INICIAL = {
  nome: '',
  telefone: '',
  idade: '',
  bairro: '',
  problema: '',
  aceitePrivacidade: false,
  autorizacaoMensagens: true,
  autorizacaoLigacoes: true
};

function validarFormulario(dadosFormulario, bairroConfirmado, bairros, categoriasProblema) {
  if (!dadosFormulario.nome.trim()) {
    return 'Informe seu nome.';
  }

  if (dadosFormulario.nome.trim().length < 2) {
    return 'O nome deve ter pelo menos 2 caracteres.';
  }

  if (!dadosFormulario.telefone.trim()) {
    return 'Informe seu telefone.';
  }

  const quantidadeDigitos = dadosFormulario.telefone.replace(/\D/g, '').length;

  if (quantidadeDigitos < 10 || quantidadeDigitos > 15) {
    return 'Informe um telefone válido, com DDD.';
  }

  const idade = Number(dadosFormulario.idade);

  if (!Number.isInteger(idade) || idade < 16 || idade > 120) {
    return 'Informe uma idade válida entre 16 e 120 anos.';
  }

  if (!bairroConfirmado || !bairros.includes(dadosFormulario.bairro)) {
    return 'Digite e selecione seu bairro na lista.';
  }

  if (!categoriasProblema.includes(dadosFormulario.problema)) {
    return 'Selecione a principal necessidade do seu bairro.';
  }

  if (!dadosFormulario.aceitePrivacidade) {
    return 'É necessário autorizar o tratamento dos dados.';
  }

  return '';
}

function validarIdentificacaoEvento(dadosFormulario) {
  if (!dadosFormulario.nome.trim() || dadosFormulario.nome.trim().length < 2) {
    return 'Informe seu nome completo.';
  }

  const quantidadeDigitos = dadosFormulario.telefone.replace(/\D/g, '').length;

  if (quantidadeDigitos < 10 || quantidadeDigitos > 15) {
    return 'Informe um telefone válido, com DDD.';
  }

  return '';
}

function FormularioPublico() {
  const [parametrosBusca] = useSearchParams();
  const eventoQr = parametrosBusca.get('evento') || '';
  const numeroWhatsapp = String(import.meta.env.VITE_WHATSAPP_NUMERO || '').replace(/\D/g, '');
  const linkWhatsapp = numeroWhatsapp.length >= 10 && numeroWhatsapp.length <= 15
    ? 'https://wa.me/' + numeroWhatsapp
    : '';
  const [dadosFormulario, setDadosFormulario] = useState(FORMULARIO_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState('informacao');
  const [bairroConfirmado, setBairroConfirmado] = useState(false);
  const [bairros, setBairros] = useState([]);
  const [categoriasProblema, setCategoriasProblema] = useState([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true);
  const [contextoCadastro, setContextoCadastro] = useState('');
  const [eventoIdExibido, setEventoIdExibido] = useState(null);
  const [etapaFormulario, setEtapaFormulario] = useState(ETAPA_FORMULARIO_COMPLETO);
  const [nomeConfirmacao, setNomeConfirmacao] = useState('');
  const [formularioDisponivel, setFormularioDisponivel] = useState(true);

  function aplicarContextoFormulario(resposta) {
    const eventoAtivo = resposta.eventoAtivo || null;

    setContextoCadastro(
      eventoAtivo ? resposta.contextoCadastro || '' : ''
    );
    setEventoIdExibido(eventoAtivo ? eventoAtivo.id : null);
    setEtapaFormulario(
      eventoAtivo ? ETAPA_IDENTIFICACAO : ETAPA_FORMULARIO_COMPLETO
    );
    setNomeConfirmacao('');
  }

  useEffect(function () {
    let paginaAtiva = true;

    async function carregarOpcoes() {
      try {
        const resposta = await buscarOpcoesFormulario(false, eventoQr);

        const bairrosRecebidos = resposta.bairros;
        const categoriasRecebidas = resposta.categoriasProblema;

        if (
          !Array.isArray(bairrosRecebidos) ||
          bairrosRecebidos.length === 0 ||
          !Array.isArray(categoriasRecebidas) ||
          categoriasRecebidas.length === 0
        ) {
          throw new Error('O catálogo do formulário está indisponível.');
        }

        if (paginaAtiva) {
          setBairros(bairrosRecebidos);
          setCategoriasProblema(categoriasRecebidas);
          setFormularioDisponivel(true);
          aplicarContextoFormulario(resposta);
        }
      } catch (erro) {
        if (paginaAtiva) {
          setTipoMensagem('erro');
          setFormularioDisponivel(erro.statusHttp !== 400 && erro.statusHttp !== 410);
          setMensagem(
            erro.statusHttp === 400 || erro.statusHttp === 410
              ? erro.message
              : 'Não foi possível carregar os bairros. Tente novamente em alguns instantes.'
          );
        }
      } finally {
        if (paginaAtiva) {
          setCarregandoOpcoes(false);
        }
      }
    }

    carregarOpcoes();

    return function () {
      paginaAtiva = false;
    };
  }, [eventoQr]);

  function alterarCampo(evento) {
    const campo = evento.target.name;
    const valor = evento.target.type === 'checkbox'
      ? evento.target.checked
      : evento.target.value;

    setDadosFormulario(Object.assign({}, dadosFormulario, {
      [campo]: valor
    }));
  }

  function alterarBairro(valor) {
    setBairroConfirmado(false);
    setDadosFormulario(Object.assign({}, dadosFormulario, {
      bairro: valor
    }));
  }

  function selecionarBairro(bairro) {
    setBairroConfirmado(true);
    setDadosFormulario(Object.assign({}, dadosFormulario, {
      bairro
    }));
  }

  async function recarregarContextoEvento() {
    try {
      const opcoesAtualizadas = await buscarOpcoesFormulario(true, eventoQr);
      aplicarContextoFormulario(opcoesAtualizadas);
    } catch (erroAtualizacao) {
      setMensagem(
        'O evento do formulário mudou e não foi possível atualizar o contexto. Recarregue a página.'
      );
    }
  }

  async function verificarCadastroNoEvento(evento) {
    evento.preventDefault();
    setMensagem('');

    const mensagemValidacao = validarIdentificacaoEvento(dadosFormulario);

    if (mensagemValidacao) {
      setTipoMensagem('erro');
      setMensagem(mensagemValidacao);
      return;
    }

    setEnviando(true);

    try {
      const resposta = await verificarContatoEvento({
        nome: dadosFormulario.nome.trim(),
        telefone: dadosFormulario.telefone.trim(),
        eventoIdExibido
      });

      if (resposta.situacao === 'novo') {
        setEtapaFormulario(ETAPA_FORMULARIO_COMPLETO);
        setTipoMensagem('informacao');
        setMensagem(resposta.mensagem);
        return;
      }

      if (resposta.situacao === 'ja_inscrito') {
        setTipoMensagem('sucesso');
        setMensagem(resposta.mensagem);
        setDadosFormulario(FORMULARIO_INICIAL);
        return;
      }

      setNomeConfirmacao(dadosFormulario.nome.trim());
      setEtapaFormulario(ETAPA_CONFIRMACAO);
      setTipoMensagem('informacao');
      setMensagem(resposta.mensagem);
    } catch (erro) {
      setTipoMensagem('erro');
      setMensagem(erro.message);

      if (erro.statusHttp === 409) {
        await recarregarContextoEvento();
      }
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarParticipacaoEvento() {
    setMensagem('');
    setEnviando(true);

    try {
      const resposta = await inscreverContatoExistenteEvento({
        nome: nomeConfirmacao,
        telefone: dadosFormulario.telefone.trim(),
        eventoIdExibido
      });

      setTipoMensagem('sucesso');
      setMensagem(resposta.mensagem);
      setDadosFormulario(FORMULARIO_INICIAL);
      setNomeConfirmacao('');
      setEtapaFormulario(ETAPA_IDENTIFICACAO);
    } catch (erro) {
      setTipoMensagem('erro');
      setMensagem(erro.message);

      if (erro.statusHttp === 409) {
        await recarregarContextoEvento();
      }
    } finally {
      setEnviando(false);
    }
  }

  function abrirAtualizacaoDados() {
    setEtapaFormulario(ETAPA_FORMULARIO_COMPLETO);
    setTipoMensagem('informacao');
    setMensagem('Atualize os campos necessários e conclua sua participação no evento.');
  }

  function voltarParaIdentificacao() {
    setEtapaFormulario(ETAPA_IDENTIFICACAO);
    setNomeConfirmacao('');
    setMensagem('');
    setDadosFormulario(FORMULARIO_INICIAL);
    setBairroConfirmado(false);
  }

  async function enviarFormulario(evento) {
    evento.preventDefault();
    setMensagem('');

    const mensagemValidacao = validarFormulario(
      dadosFormulario,
      bairroConfirmado,
      bairros,
      categoriasProblema
    );

    if (mensagemValidacao) {
      setTipoMensagem('erro');
      setMensagem(mensagemValidacao);
      return;
    }

    setEnviando(true);

    try {
      const resposta = await cadastrarContato({
        nome: dadosFormulario.nome.trim(),
        telefone: dadosFormulario.telefone.trim(),
        idade: Number(dadosFormulario.idade),
        bairro: dadosFormulario.bairro.trim(),
        problema: dadosFormulario.problema.trim(),
        eventoIdExibido,
        atualizarDadosEvento: Boolean(nomeConfirmacao),
        nomeConfirmacao: nomeConfirmacao || undefined,
        aceitePrivacidade: dadosFormulario.aceitePrivacidade,
        autorizacaoMensagens: dadosFormulario.autorizacaoMensagens,
        autorizacaoLigacoes: dadosFormulario.autorizacaoLigacoes
      });

      setTipoMensagem('sucesso');
      setMensagem(resposta.mensagem || 'Cadastro realizado com sucesso.');
      setDadosFormulario(FORMULARIO_INICIAL);
      setBairroConfirmado(false);
      setNomeConfirmacao('');
      setEtapaFormulario(
        eventoIdExibido ? ETAPA_IDENTIFICACAO : ETAPA_FORMULARIO_COMPLETO
      );
    } catch (erro) {
      setTipoMensagem('erro');
      setMensagem(erro.message);

      if (erro.statusHttp === 409) {
        await recarregarContextoEvento();
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="pagina-publica">
      <header className="cabecalho-publico">
        <div className="conteudo-cabecalho-publico">
          <div className="identidade-projeto">
            <svg className="simbolo-projeto" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 11v2h4l6 4V7l-6 4H4Z" />
              <path d="M17 9c1.3 1.4 1.3 4.6 0 6M19.5 6.5c3 3 3 8 0 11" />
            </svg>
            <span className="nome-projeto">ACORDA VK</span>
          </div>
          <span className="responsavel-cabecalho-publico">
            Diogo Ventura · Rio de Janeiro
          </span>
        </div>
      </header>

      <section className="apresentacao-publica" aria-labelledby="titulo-formulario">
        <span>Participação cidadã</span>
        <h1 id="titulo-formulario">Sua voz pode ajudar a transformar o seu bairro.</h1>
        <p>
          Informe a principal necessidade da sua região e ajude a identificar
          as demandas dos bairros do Rio de Janeiro.
        </p>
        <p className="promocao-projeto">
          <strong>Projeto de participação cidadã promovido por Diogo Ventura.</strong>
        </p>
      </section>

      <section className="cartao cartao-formulario" aria-labelledby="titulo-formulario">
        {contextoCadastro && (
          <p className="contexto-cadastro-publico">{contextoCadastro}</p>
        )}

        <MensagemRetorno mensagem={mensagem} tipo={tipoMensagem} />

        {formularioDisponivel && eventoIdExibido && etapaFormulario === ETAPA_IDENTIFICACAO && (
          <form
            className="formulario-publico formulario-identificacao-evento"
            onSubmit={verificarCadastroNoEvento}
            noValidate
          >
            <p className="orientacao-etapa-evento">
              Informe seu nome completo e telefone. Se você já estiver em nossa
              base, poderá confirmar a participação sem preencher tudo novamente.
            </p>

            <div className="grade-formulario">
              <CampoFormulario
                id="nome"
                rotulo="Nome completo"
                valor={dadosFormulario.nome}
                aoAlterar={alterarCampo}
                placeholder="Seu nome completo"
                obrigatorio
                desabilitado={enviando}
                tamanhoMinimo={2}
                tamanhoMaximo={150}
                autoComplete="name"
              />

              <CampoFormulario
                id="telefone"
                rotulo="Telefone"
                tipo="tel"
                valor={dadosFormulario.telefone}
                aoAlterar={alterarCampo}
                placeholder="(21) 99999-9999"
                obrigatorio
                desabilitado={enviando}
                tamanhoMaximo={30}
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <div className="acoes-formulario-publico">
              <button
                className="botao botao-primario botao-enviar"
                type="submit"
                disabled={enviando || carregandoOpcoes}
              >
                {enviando ? 'Verificando...' : 'Continuar'}
              </button>

              {linkWhatsapp && (
                <a
                  className="botao-whatsapp-publico"
                  href={linkWhatsapp}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Falar pelo WhatsApp
                </a>
              )}
            </div>
          </form>
        )}

        {formularioDisponivel && eventoIdExibido && etapaFormulario === ETAPA_CONFIRMACAO && (
          <div className="formulario-publico confirmacao-participacao-evento">
            <h2>Confirmar participação</h2>
            <p>
              O cadastro foi confirmado pelo nome completo e telefone informados.
              Nenhum dado pessoal foi exibido ou alterado.
            </p>

            <div className="acoes-formulario-publico">
              <button
                className="botao botao-primario botao-enviar"
                type="button"
                onClick={confirmarParticipacaoEvento}
                disabled={enviando}
              >
                {enviando ? 'Confirmando...' : 'Confirmar participação'}
              </button>
              <button
                className="botao botao-secundario"
                type="button"
                onClick={abrirAtualizacaoDados}
                disabled={enviando}
              >
                Meus dados mudaram
              </button>
              <button
                className="botao botao-secundario"
                type="button"
                onClick={voltarParaIdentificacao}
                disabled={enviando}
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        {formularioDisponivel && etapaFormulario === ETAPA_FORMULARIO_COMPLETO && (
          <form className="formulario-publico" onSubmit={enviarFormulario} noValidate>
            {eventoIdExibido && (
              <p className="orientacao-etapa-evento">
                {nomeConfirmacao
                  ? 'Informe os dados atuais. As alterações serão registradas no histórico antes da participação no evento.'
                  : 'Este telefone ainda não está na base. Complete o cadastro para participar do evento.'}
              </p>
            )}

            <div className="grade-formulario">
              <CampoFormulario
                id="nome"
                rotulo="Nome completo"
                valor={dadosFormulario.nome}
                aoAlterar={alterarCampo}
                placeholder="Seu nome completo"
                obrigatorio
                desabilitado={enviando}
                tamanhoMinimo={2}
                tamanhoMaximo={150}
                autoComplete="name"
              />

              <CampoFormulario
                id="telefone"
                rotulo="Telefone"
                tipo="tel"
                valor={dadosFormulario.telefone}
                aoAlterar={alterarCampo}
                placeholder="(21) 99999-9999"
                obrigatorio
                desabilitado={enviando || Boolean(nomeConfirmacao)}
                tamanhoMaximo={30}
                autoComplete="tel"
                inputMode="tel"
              />

              <CampoFormulario
                id="idade"
                rotulo="Idade"
                tipo="number"
                valor={dadosFormulario.idade}
                aoAlterar={alterarCampo}
                placeholder="Ex.: 35"
                obrigatorio
                desabilitado={enviando}
                minimo={16}
                maximo={120}
                passo={1}
                inputMode="numeric"
              />

              <CampoSelecaoPesquisavel
                id="bairro"
                rotulo="Bairro"
                valor={dadosFormulario.bairro}
                aoAlterar={alterarBairro}
                aoSelecionar={selecionarBairro}
                opcoes={bairros}
                placeholder="Digite para buscar"
                obrigatorio
                desabilitado={enviando || carregandoOpcoes}
              />

              <CampoSelecao
                id="problema"
                rotulo="Principal necessidade"
                valor={dadosFormulario.problema}
                aoAlterar={alterarCampo}
                opcoes={categoriasProblema}
                placeholder="Selecione uma categoria"
                obrigatorio
                desabilitado={enviando}
              />
            </div>

            <fieldset className="grupo-consentimentos" disabled={enviando}>
              <legend>Autorizações</legend>

              <label className="opcao-consentimento" htmlFor="aceitePrivacidade">
                <input
                  id="aceitePrivacidade"
                  name="aceitePrivacidade"
                  type="checkbox"
                  checked={dadosFormulario.aceitePrivacidade}
                  onChange={alterarCampo}
                  required
                />
                <span>
                  {TEXTO_AVISO_PRIVACIDADE}
                  <strong aria-hidden="true"> *</strong>
                </span>
              </label>

              <label className="opcao-consentimento" htmlFor="autorizacaoMensagens">
                <input
                  id="autorizacaoMensagens"
                  name="autorizacaoMensagens"
                  type="checkbox"
                  checked={dadosFormulario.autorizacaoMensagens}
                  onChange={alterarCampo}
                />
                <span>{TEXTO_MENSAGENS}</span>
              </label>

              <label className="opcao-consentimento" htmlFor="autorizacaoLigacoes">
                <input
                  id="autorizacaoLigacoes"
                  name="autorizacaoLigacoes"
                  type="checkbox"
                  checked={dadosFormulario.autorizacaoLigacoes}
                  onChange={alterarCampo}
                />
                <span>{TEXTO_LIGACOES}</span>
              </label>
            </fieldset>

            <p className="aviso-direitos">
              Você poderá solicitar a correção, a exclusão dos seus dados ou a
              revogação das autorizações concedidas.
            </p>

            <p className="legenda-obrigatorios">* Campos obrigatórios</p>

            <div className="acoes-formulario-publico">
              <button
                className="botao botao-primario botao-enviar"
                type="submit"
                disabled={enviando || carregandoOpcoes || bairros.length === 0}
              >
                {carregandoOpcoes
                  ? 'Carregando bairros...'
                  : enviando
                    ? 'Enviando...'
                    : eventoIdExibido
                      ? nomeConfirmacao
                        ? 'Atualizar e participar'
                        : 'Cadastrar e participar'
                      : 'Enviar minha resposta'}
              </button>

              {eventoIdExibido && (
                <button
                  className="botao botao-secundario"
                  type="button"
                  onClick={voltarParaIdentificacao}
                  disabled={enviando}
                >
                  Voltar
                </button>
              )}

              {linkWhatsapp && (
                <a
                  className="botao-whatsapp-publico"
                  href={linkWhatsapp}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Falar pelo WhatsApp
                </a>
              )}
            </div>
          </form>
        )}
      </section>

      <section className="uso-dos-dados" aria-labelledby="titulo-uso-dados">
        <h2 id="titulo-uso-dados">Aviso de Privacidade (LGPD)</h2>
        <div className="conteudo-privacidade">
          <p>
            As respostas serão analisadas em conjunto para identificar necessidades
            por bairro e apoiar iniciativas voltadas à comunidade.
          </p>
          <p>
            <strong>Responsável pelo tratamento dos dados:</strong> Diogo Ventura.
          </p>
          <p>
            Ao enviar este formulário, autorizo o tratamento dos meus dados pessoais
            para participação no projeto <strong>Acorda VK</strong>, promovido
            por <strong>Diogo Ventura</strong>, conforme as finalidades descritas
            neste formulário.
          </p>
        </div>
      </section>

      <footer className="rodape-publico">
        <div className="identificacao-rodape">
          <span>ACORDA VK</span>
          <p>
            <strong>Responsável pela iniciativa e pelo tratamento dos dados:</strong>{' '}
            Diogo Ventura.
          </p>
        </div>
      </footer>
    </main>
  );
}

export default FormularioPublico;
