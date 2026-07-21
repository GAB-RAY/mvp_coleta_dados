import { useState } from 'react';
import { Link } from 'react-router-dom';
import CampoFormulario from '../components/CampoFormulario';
import CampoSelecao from '../components/CampoSelecao';
import CampoSelecaoPesquisavel from '../components/CampoSelecaoPesquisavel';
import MensagemRetorno from '../components/MensagemRetorno';
import { BAIRROS_RIO, PROBLEMAS } from '../data/opcoesFormulario';
import {
  TEXTO_LIGACOES,
  TEXTO_TRATAMENTO_DADOS,
  TEXTO_WHATSAPP
} from '../data/textosConsentimento';
import { cadastrarContato } from '../services/contatoService';

const FORMULARIO_INICIAL = {
  nome: '',
  telefone: '',
  bairro: '',
  problema: '',
  consentimentoTratamentoDados: false,
  consentimentoWhatsapp: false,
  consentimentoLigacoes: false
};

function validarFormulario(dadosFormulario, bairroConfirmado) {
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

  if (!bairroConfirmado || !BAIRROS_RIO.includes(dadosFormulario.bairro)) {
    return 'Digite e selecione seu bairro na lista.';
  }

  if (!PROBLEMAS.includes(dadosFormulario.problema)) {
    return 'Selecione a principal necessidade do seu bairro.';
  }

  if (!dadosFormulario.consentimentoTratamentoDados) {
    return 'É necessário autorizar o tratamento dos dados.';
  }

  return '';
}

function FormularioPublico() {
  const [dadosFormulario, setDadosFormulario] = useState(FORMULARIO_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState('informacao');
  const [bairroConfirmado, setBairroConfirmado] = useState(false);

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

    const mensagemValidacao = validarFormulario(dadosFormulario, bairroConfirmado);

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
        bairro: dadosFormulario.bairro.trim(),
        problema: dadosFormulario.problema.trim(),
        consentimentoTratamentoDados: dadosFormulario.consentimentoTratamentoDados,
        consentimentoWhatsapp: dadosFormulario.consentimentoWhatsapp,
        consentimentoLigacoes: dadosFormulario.consentimentoLigacoes
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
              rotulo="Telefone ou WhatsApp"
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
              opcoes={BAIRROS_RIO}
              placeholder="Digite para buscar"
              obrigatorio
              desabilitado={enviando}
            />

            <CampoSelecao
              id="problema"
              rotulo="Principal necessidade"
              valor={dadosFormulario.problema}
              aoAlterar={alterarCampo}
              opcoes={PROBLEMAS}
              placeholder="Selecione uma categoria"
              obrigatorio
              desabilitado={enviando}
            />
          </div>

          <fieldset className="grupo-consentimentos" disabled={enviando}>
            <legend>Autorizações</legend>

            <label className="opcao-consentimento" htmlFor="consentimentoTratamentoDados">
              <input
                id="consentimentoTratamentoDados"
                name="consentimentoTratamentoDados"
                type="checkbox"
                checked={dadosFormulario.consentimentoTratamentoDados}
                onChange={alterarCampo}
                required
              />
              <span>
                {TEXTO_TRATAMENTO_DADOS}
                <strong aria-hidden="true"> *</strong>
              </span>
            </label>

            <label className="opcao-consentimento" htmlFor="consentimentoWhatsapp">
              <input
                id="consentimentoWhatsapp"
                name="consentimentoWhatsapp"
                type="checkbox"
                checked={dadosFormulario.consentimentoWhatsapp}
                onChange={alterarCampo}
              />
              <span>{TEXTO_WHATSAPP}</span>
            </label>

            <label className="opcao-consentimento" htmlFor="consentimentoLigacoes">
              <input
                id="consentimentoLigacoes"
                name="consentimentoLigacoes"
                type="checkbox"
                checked={dadosFormulario.consentimentoLigacoes}
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

          <button className="botao botao-primario botao-enviar" type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar minha resposta'}
          </button>
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
        <Link className="link-administrativo" to="/login">Acesso administrativo</Link>
      </footer>
    </main>
  );
}

export default FormularioPublico;
