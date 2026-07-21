import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import CampoFormulario from '../components/CampoFormulario';
import CampoSelecao from '../components/CampoSelecao';
import CampoSelecaoPesquisavel from '../components/CampoSelecaoPesquisavel';
import MensagemRetorno from '../components/MensagemRetorno';
import { BAIRROS_RIO, PROBLEMAS } from '../data/opcoesFormulario';
import {
  cadastrarContatoManual,
  listarOrigens
} from '../services/contatoService';
import { removerToken } from '../utils/armazenamentoToken';

const DADOS_INICIAIS = {
  nome: '',
  telefone: '',
  bairro: '',
  idade: '',
  problema: '',
  descricaoProblema: '',
  participouEleicaoAnterior: '',
  origemId: '',
  status: 'ativo',
  aceitePrivacidade: false,
  autorizacaoMensagens: 'nao_informado',
  autorizacaoLigacoes: 'nao_informado'
};

const OPCOES_ELEICAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'prefiro_nao_informar', rotulo: 'Prefiro não informar' }
];

const OPCOES_AUTORIZACAO = [
  { valor: 'nao_informado', rotulo: 'Não informado' },
  { valor: 'autorizado', rotulo: 'Autorizado' },
  { valor: 'recusado', rotulo: 'Recusado explicitamente' }
];

function CadastroManual() {
  const navegacao = useNavigate();
  const [dados, setDados] = useState(DADOS_INICIAIS);
  const [origens, setOrigens] = useState([]);
  const [bairroConfirmado, setBairroConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState('informacao');

  useEffect(function () {
    const controlador = new AbortController();

    async function carregarOrigens() {
      try {
        const resposta = await listarOrigens(controlador.signal);
        const opcoes = (resposta.origens || []).map(function (origem) {
          return { valor: String(origem.id), rotulo: origem.nome };
        });
        setOrigens(opcoes);

        const origemManual = (resposta.origens || []).find(function (origem) {
          return origem.slug === 'cadastro-manual';
        });

        if (origemManual) {
          setDados(Object.assign({}, DADOS_INICIAIS, {
            origemId: String(origemManual.id)
          }));
        }
      } catch (erro) {
        if (erro.statusHttp === 401) {
          removerToken();
          navegacao('/login', { replace: true });
        } else if (erro.name !== 'AbortError') {
          setTipoMensagem('erro');
          setMensagem(erro.message);
        }
      }
    }

    carregarOrigens();

    return function () {
      controlador.abort();
    };
  }, [navegacao]);

  function alterar(evento) {
    const campo = evento.target.name;
    const valor = evento.target.type === 'checkbox'
      ? evento.target.checked
      : evento.target.value;
    setDados(Object.assign({}, dados, { [campo]: valor }));
  }

  function alterarBairro(valor) {
    setBairroConfirmado(false);
    setDados(Object.assign({}, dados, { bairro: valor }));
  }

  function selecionarBairro(valor) {
    setBairroConfirmado(true);
    setDados(Object.assign({}, dados, { bairro: valor }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setMensagem('');

    if (!bairroConfirmado || !BAIRROS_RIO.includes(dados.bairro)) {
      setTipoMensagem('erro');
      setMensagem('Digite e selecione o bairro na lista.');
      return;
    }

    setEnviando(true);

    try {
      const resposta = await cadastrarContatoManual(Object.assign({}, dados, {
        idade: Number(dados.idade),
        origemId: Number(dados.origemId),
        descricaoProblema: dados.descricaoProblema.trim() || null,
        participouEleicaoAnterior: dados.participouEleicaoAnterior || null
      }));
      navegacao('/admin/contatos/' + resposta.contatoId, { replace: true });
    } catch (erro) {
      if (erro.statusHttp === 401) {
        removerToken();
        navegacao('/login', { replace: true });
        return;
      }

      setTipoMensagem('erro');
      setMensagem(erro.message);
    } finally {
      setEnviando(false);
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
            <div><span className="etiqueta-pagina">Operação interna</span><h2>Cadastro manual</h2></div>
            <p>Dados existentes somente serão alterados com registro no histórico.</p>
          </div>
          <MensagemRetorno mensagem={mensagem} tipo={tipoMensagem} />

          <form className="formulario-filtros" onSubmit={enviar}>
            <fieldset className="grade-filtros" disabled={enviando}>
              <CampoFormulario id="nome" rotulo="Nome" valor={dados.nome} aoAlterar={alterar} obrigatorio />
              <CampoFormulario id="telefone" rotulo="Telefone" tipo="tel" valor={dados.telefone} aoAlterar={alterar} obrigatorio />
              <CampoFormulario id="idade" rotulo="Idade" tipo="number" valor={dados.idade} aoAlterar={alterar} minimo={16} maximo={120} passo={1} obrigatorio />
              <CampoSelecaoPesquisavel id="bairro" rotulo="Bairro" valor={dados.bairro} aoAlterar={alterarBairro} aoSelecionar={selecionarBairro} opcoes={BAIRROS_RIO} obrigatorio />
              <CampoSelecao id="problema" rotulo="Categoria" valor={dados.problema} aoAlterar={alterar} opcoes={PROBLEMAS} placeholder="Selecione" obrigatorio />
              <CampoFormulario id="descricaoProblema" rotulo="Descrição opcional" valor={dados.descricaoProblema} aoAlterar={alterar} multilinha linhas={3} tamanhoMaximo={1000} />
              <CampoSelecao id="participouEleicaoAnterior" rotulo="Votou na última eleição" valor={dados.participouEleicaoAnterior} aoAlterar={alterar} opcoes={OPCOES_ELEICAO} placeholder="Não informado" />
              <CampoSelecao id="origemId" rotulo="Origem" valor={dados.origemId} aoAlterar={alterar} opcoes={origens} placeholder="Selecione" obrigatorio />
              <CampoFormulario id="status" rotulo="Status" valor={dados.status} aoAlterar={alterar} obrigatorio />
              <CampoSelecao id="autorizacaoMensagens" rotulo="Autorização de mensagens" valor={dados.autorizacaoMensagens} aoAlterar={alterar} opcoes={OPCOES_AUTORIZACAO} />
              <CampoSelecao id="autorizacaoLigacoes" rotulo="Autorização de ligações" valor={dados.autorizacaoLigacoes} aoAlterar={alterar} opcoes={OPCOES_AUTORIZACAO} />
              <label className="opcao-consentimento opcao-consentimento-admin" htmlFor="aceitePrivacidade">
                <input id="aceitePrivacidade" name="aceitePrivacidade" type="checkbox" checked={dados.aceitePrivacidade} onChange={alterar} />
                <span>A pessoa aceitou expressamente o Aviso de Privacidade apresentado.</span>
              </label>
            </fieldset>
            <button className="botao botao-primario" type="submit" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar contato'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default CadastroManual;
