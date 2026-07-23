import { useEffect, useState } from 'react';
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
  cadastrarContato
} from '../services/contatoService';

const FORMULARIO_INICIAL = {
  nome: '',
  telefone: '',
  idade: '',
  bairro: '',
  problema: '',
  aceitePrivacidade: false,
  autorizacaoMensagens: false,
  autorizacaoLigacoes: false
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

function FormularioPublico() {
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

  useEffect(function () {
    let paginaAtiva = true;

    async function carregarOpcoes() {
      try {
        const resposta = await buscarOpcoesFormulario();

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
          setContextoCadastro(resposta.contextoCadastro || 'Cadastro geral do projeto A Voz do Bairro.');
        }
      } catch (erro) {
        if (paginaAtiva) {
          setTipoMensagem('erro');
          setMensagem('Não foi possível carregar os bairros. Tente novamente em alguns instantes.');
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
  }, []);

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
        aceitePrivacidade: dadosFormulario.aceitePrivacidade,
        autorizacaoMensagens: dadosFormulario.autorizacaoMensagens,
        autorizacaoLigacoes: dadosFormulario.autorizacaoLigacoes
      });

      setTipoMensagem('sucesso');
      setMensagem(resposta.mensagem || 'Cadastro realizado com sucesso.');
      setDadosFormulario(FORMULARIO_INICIAL);
      setBairroConfirmado(false);
    } catch (erro) {
      setTipoMensagem('erro');
      setMensagem(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="pagina-publica">
      <header className="cabecalho-publico">
        <div className="identidade-projeto">
          <span className="simbolo-projeto" aria-hidden="true" />
          <span className="nome-projeto">A VOZ DO BAIRRO</span>
        </div>
      </header>

      <section className="cartao cartao-formulario" aria-labelledby="titulo-formulario">
        <div className="introducao-formulario">
          <h1 id="titulo-formulario">Sua voz pode ajudar a transformar o seu bairro.</h1>
          <p className="promocao-projeto">
            <strong>Projeto de participação cidadã promovido por Diogo Ventura.</strong>
          </p>
          <p>
            Informe a principal necessidade da sua região e ajude a identificar
            as demandas dos bairros do Rio de Janeiro.
          </p>
        </div>

        {contextoCadastro && (
          <p className="contexto-cadastro-publico">{contextoCadastro}</p>
        )}

        <MensagemRetorno mensagem={mensagem} tipo={tipoMensagem} />

        <form className="formulario-publico" onSubmit={enviarFormulario} noValidate>
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
                  : 'Enviar minha resposta'}
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
            para participação no projeto <strong>A Voz do Bairro</strong>, promovido
            por <strong>Diogo Ventura</strong>, conforme as finalidades descritas
            neste formulário.
          </p>
        </div>
      </section>

      <footer className="rodape-publico">
        <div className="identificacao-rodape">
          <span>A VOZ DO BAIRRO</span>
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
