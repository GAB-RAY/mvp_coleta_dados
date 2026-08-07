import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import MensagemRetorno from '../components/MensagemRetorno';
import {
  buscarDetalhesContato,
  buscarOpcoesFormulario
} from '../services/contatoService';
import { listarEventos } from '../services/eventoService';
import {
  atualizarComunicacao,
  cancelarComunicacao,
  cancelarComunicacoesPreparadas,
  confirmarComunicacoesPreparadas,
  confirmarEnvio,
  excluirNumero,
  listarCampanhas,
  listarComunicacoes,
  listarContatosComunicacao,
  listarModelos,
  listarNumeros,
  listarOperadores,
  prepararComunicacoes,
  salvarCampanha,
  salvarModelo,
  salvarNumero
} from '../services/comunicacaoService';
import { obterUsuario, removerToken } from '../utils/armazenamentoToken';
import formatarTelefone from '../utils/formatarTelefone';

const STATUS = [
  ['preparada', 'Mensagem preparada'],
  ['enviada', 'Mensagem enviada'],
  ['aguardando_resposta', 'Aguardando resposta'],
  ['respondido', 'Respondeu'],
  ['sem_resposta', 'Sem resposta'],
  ['recusou_atendimento', 'Recusou atendimento'],
  ['numero_invalido', 'Telefone inválido'],
  ['concluido', 'Concluído']
];

const NUMERO_INICIAL = {
  nome: '', numero: '', responsavel: '', ativo: true
};
const MODELO_INICIAL = {
  nome: '', categoria: '', texto: '', eventoId: '', ativo: true
};
const CAMPANHA_INICIAL = { nome: '', descricao: '', ativo: true };
const FILTROS_CONTATOS_INICIAIS = {
  situacao: '', bairro: '', problema: '', consentimento: '',
  campanhaNaoRecebidaId: '', cadastroIncompleto: false
};

const LIMITE_CONTATOS_POR_PAGINA = 50;
const PAGINACAO_CONTATOS_INICIAL = {
  paginaAtual: 1,
  limite: LIMITE_CONTATOS_POR_PAGINA,
  totalRegistros: 0,
  totalPaginas: 0
};

function normalizarId(valor) {
  return String(valor);
}

function ComunicacoesAdministrativas() {
  const navegacao = useNavigate();
  const [parametrosBusca] = useSearchParams();
  const contatoIdInicial = parametrosBusca.get('contatoId') || '';
  const contatoInicialProcessado = useRef(false);
  const usuario = obterUsuario();
  const administrador = usuario && usuario.perfil === 'administrador';
  const [numeros, setNumeros] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [categoriasProblema, setCategoriasProblema] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [comunicacoes, setComunicacoes] = useState([]);
  const [numero, setNumero] = useState(NUMERO_INICIAL);
  const [modelo, setModelo] = useState(MODELO_INICIAL);
  const [campanha, setCampanha] = useState(CAMPANHA_INICIAL);
  const [numeroEdicao, setNumeroEdicao] = useState(null);
  const [modeloEdicao, setModeloEdicao] = useState(null);
  const [campanhaEdicao, setCampanhaEdicao] = useState(null);
  const [selecionados, setSelecionados] = useState([]);
  const [buscaContatos, setBuscaContatos] = useState('');
  const [filtrosContatos, setFiltrosContatos] = useState(FILTROS_CONTATOS_INICIAIS);
  const [filtrandoContatos, setFiltrandoContatos] = useState(false);
  const [paginacaoContatos, setPaginacaoContatos] = useState(PAGINACAO_CONTATOS_INICIAL);
  const [consultaContatosAplicada, setConsultaContatosAplicada] = useState({
    pagina: 1, limite: LIMITE_CONTATOS_POR_PAGINA
  });
  const [filaManual, setFilaManual] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [duplicidade, setDuplicidade] = useState(false);
  const [filtrosHistorico, setFiltrosHistorico] = useState({
    eventoId: '', status: '', campanhaId: '', modeloId: '',
    operadorId: '', numeroId: '', bairro: '', problema: '',
    ultimoContatoInicio: '', ultimoContatoFim: ''
  });
  const [preparo, setPreparo] = useState({
    eventoId: '', modeloId: '', campanhaId: '', numeroId: '', texto: '',
    motivoReenvio: ''
  });

  async function carregar(filtrosRecebidos) {
    try {
      const filtros = filtrosRecebidos || filtrosHistorico;
      const deveCarregarContatoInicial = contatoIdInicial && !contatoInicialProcessado.current;
      const resultados = await Promise.all([
        listarNumeros(),
        listarModelos(),
        listarCampanhas(),
        listarOperadores(),
        listarEventos(),
        listarContatosComunicacao({ pagina: 1, limite: LIMITE_CONTATOS_POR_PAGINA }),
        listarComunicacoes(filtros),
        deveCarregarContatoInicial
          ? buscarDetalhesContato(contatoIdInicial)
          : Promise.resolve(null),
        buscarOpcoesFormulario().catch(function () {
          return { bairros: [], categoriasProblema: [] };
        })
      ]);
      setNumeros(resultados[0].numeros || []);
      setModelos(resultados[1].modelos || []);
      setCampanhas(resultados[2].campanhas || []);
      setOperadores(resultados[3].operadores || []);
      setEventos(resultados[4].eventos || []);
      setBairros(resultados[8].bairros || []);
      setCategoriasProblema(resultados[8].categoriasProblema || []);
      const contatosDisponiveis = resultados[5].contatos || [];
      setPaginacaoContatos(resultados[5].paginacao || PAGINACAO_CONTATOS_INICIAL);
      setConsultaContatosAplicada({ pagina: 1, limite: LIMITE_CONTATOS_POR_PAGINA });
      const detalhesContatoInicial = resultados[7];

      if (deveCarregarContatoInicial) {
        contatoInicialProcessado.current = true;
      }

      if (detalhesContatoInicial) {
        const contatoInicial = detalhesContatoInicial.contato;
        const podeReceberMensagem = contatoInicial.bloqueadoParaMensagens !== true;

        if (podeReceberMensagem) {
          const contatoJaListado = contatosDisponiveis.some(function (item) {
            return String(item.id) === String(contatoInicial.id);
          });

          setContatos(contatoJaListado
            ? contatosDisponiveis
            : [contatoInicial].concat(contatosDisponiveis));
          setSelecionados([normalizarId(contatoInicial.id)]);
          setMensagem('Contato selecionado. Escolha o número remetente e escreva a mensagem.');
        } else {
          setContatos(contatosDisponiveis);
          setSelecionados([]);
          setMensagem('Este contato está bloqueado para receber mensagens.');
        }
      } else {
        setContatos(contatosDisponiveis);
      }
      setComunicacoes(resultados[6].comunicacoes || []);
    } catch (erro) {
      if (erro.statusHttp === 401) {
        removerToken();
        navegacao('/login', { replace: true });
      } else {
        setMensagem(erro.message);
      }
    }
  }

  useEffect(function () {
    carregar({ eventoId: '', status: '' });
  }, []);

  function alterarEstado(funcao, estado) {
    return function (evento) {
      funcao(Object.assign({}, estado, {
        [evento.target.name]: evento.target.type === 'checkbox'
          ? evento.target.checked
          : evento.target.value
      }));
    };
  }

  function aplicarRespostaContatos(resposta, consulta) {
    setContatos(resposta.contatos || []);
    setPaginacaoContatos(resposta.paginacao || PAGINACAO_CONTATOS_INICIAL);
    setConsultaContatosAplicada(consulta);
  }

  async function consultarContatos(consulta, limparSelecionados) {
    setFiltrandoContatos(true);
    setMensagem('');
    try {
      const resposta = await listarContatosComunicacao(consulta);
      aplicarRespostaContatos(resposta, consulta);
      if (limparSelecionados) {
        setSelecionados([]);
      }
      return resposta;
    } catch (erro) {
      setMensagem(erro.message);
      return null;
    } finally {
      setFiltrandoContatos(false);
    }
  }

  async function filtrarContatosPorEvento(eventoId) {
    const consulta = Object.assign({}, filtrosContatos, {
      eventoId: eventoId || '',
      busca: buscaContatos.trim(),
      pagina: 1,
      limite: LIMITE_CONTATOS_POR_PAGINA
    });
    await consultarContatos(consulta, true);
  }

  async function buscarSegmento() {
    const consulta = Object.assign({}, filtrosContatos, {
      eventoId: preparo.eventoId || '',
      busca: buscaContatos.trim(),
      pagina: 1,
      limite: LIMITE_CONTATOS_POR_PAGINA
    });
    const resposta = await consultarContatos(consulta, true);
    if (resposta) {
      setMensagem(resposta.paginacao.totalRegistros + ' contato(s) encontrado(s) com os filtros selecionados.');
    }
  }

  async function buscarContatoNoBanco(evento) {
    evento.preventDefault();
    const consulta = Object.assign({}, consultaContatosAplicada, {
      busca: buscaContatos.trim(),
      pagina: 1,
      limite: LIMITE_CONTATOS_POR_PAGINA
    });
    await consultarContatos(consulta, false);
  }

  async function mudarPaginaContatos(novaPagina) {
    if (novaPagina < 1 || novaPagina > paginacaoContatos.totalPaginas || filtrandoContatos) {
      return;
    }
    await consultarContatos(Object.assign({}, consultaContatosAplicada, {
      pagina: novaPagina,
      limite: LIMITE_CONTATOS_POR_PAGINA
    }), false);
  }

  async function limparFiltrosPublico() {
    const consulta = {
      eventoId: preparo.eventoId || '',
      busca: '',
      pagina: 1,
      limite: LIMITE_CONTATOS_POR_PAGINA
    };
    setFiltrosContatos(FILTROS_CONTATOS_INICIAIS);
    setBuscaContatos('');
    const resposta = await consultarContatos(consulta, true);
    if (resposta) {
      setMensagem('Filtros removidos.');
    }
  }

  function selecionarContato(id) {
    const idNormalizado = normalizarId(id);
    setSelecionados(function (selecionadosAtuais) {
      if (selecionadosAtuais.includes(idNormalizado)) {
        return selecionadosAtuais.filter(function (item) { return item !== idNormalizado; });
      }
      if (selecionadosAtuais.length >= 500) {
        setMensagem('O limite por preparacao e de 500 contatos.');
        return selecionadosAtuais;
      }
      return selecionadosAtuais.concat(idNormalizado);
    });
  }

  function selecionarContatosVisiveis(contatosVisiveis) {
    const idsVisiveis = contatosVisiveis.map(function (item) {
      return normalizarId(item.id);
    });

    setSelecionados(function (selecionadosAtuais) {
      const combinados = Array.from(new Set(selecionadosAtuais.concat(idsVisiveis)));
      if (combinados.length > 500) {
        setMensagem('Foram mantidos os primeiros 500 contatos selecionados.');
      }
      return combinados.slice(0, 500);
    });
  }

  function limparSelecao() {
    setSelecionados([]);
  }

  async function enviarNumero(evento) {
    evento.preventDefault();
    try {
      const resposta = await salvarNumero(numeroEdicao, numero);
      setMensagem(resposta.mensagem);
      setPreparo(function (estadoAtual) {
        return Object.assign({}, estadoAtual, {
          numeroId: String(resposta.numero.id)
        });
      });
      setNumero(NUMERO_INICIAL);
      setNumeroEdicao(null);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function removerNumero(item) {
    const confirmou = window.confirm(
      'Excluir o número "' + item.nome + '"? Esta ação só será permitida se ele ainda não possuir histórico.'
    );

    if (!confirmou) {
      return;
    }

    try {
      const resposta = await excluirNumero(item.id);
      setMensagem(resposta.mensagem);
      if (String(preparo.numeroId) === String(item.id)) {
        setPreparo(Object.assign({}, preparo, { numeroId: '' }));
      }
      if (String(numeroEdicao) === String(item.id)) {
        setNumeroEdicao(null);
        setNumero(NUMERO_INICIAL);
      }
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function enviarModelo(evento) {
    evento.preventDefault();
    try {
      const resposta = await salvarModelo(modeloEdicao, modelo);
      setMensagem(resposta.mensagem);
      setModelo(MODELO_INICIAL);
      setModeloEdicao(null);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function enviarCampanha(evento) {
    evento.preventDefault();
    try {
      const resposta = await salvarCampanha(campanhaEdicao, campanha);
      setMensagem(resposta.mensagem);
      setCampanha(CAMPANHA_INICIAL);
      setCampanhaEdicao(null);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function preparar(confirmarReenvio) {
    try {
      const resposta = await prepararComunicacoes(Object.assign({}, preparo, {
        contatoIds: selecionados,
        confirmarReenvio: confirmarReenvio === true
      }));
      if (resposta.requerConfirmacao) {
        setDuplicidade(true);
        setMensagem(resposta.mensagem);
        return;
      }
      setDuplicidade(false);
      setMensagem(resposta.mensagem);
      setFilaManual(resposta.comunicacoes || []);
      setSelecionados([]);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function confirmar(item) {
    try {
      const resposta = await confirmarEnvio(item.id, {});
      setFilaManual(filaManual.filter(function (registro) {
        return registro.id !== item.id;
      }));
      setMensagem(resposta.mensagem);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function cancelar(item) {
    if (!window.confirm('Cancelar esta mensagem preparada?')) return;
    try {
      const resposta = await cancelarComunicacao(item.id);
      setFilaManual(filaManual.filter(function (registro) {
        return registro.id !== item.id;
      }));
      setMensagem(resposta.mensagem);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function confirmarTodasPreparadas() {
    if (!window.confirm('Confirmar como enviadas todas as mensagens preparadas pendentes? Use somente depois de enviar manualmente pelo WhatsApp.')) {
      return;
    }

    try {
      const resposta = await confirmarComunicacoesPreparadas();
      setFilaManual([]);
      setSelecionados([]);
      setMensagem(resposta.mensagem);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function cancelarTodasPreparadas() {
    if (!window.confirm('Cancelar todas as mensagens preparadas pendentes? Mensagens já confirmadas não serão alteradas.')) {
      return;
    }

    try {
      const resposta = await cancelarComunicacoesPreparadas();
      setFilaManual([]);
      setSelecionados([]);
      setMensagem(resposta.mensagem);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function copiarMensagem(item) {
    try {
      await navigator.clipboard.writeText(item.texto_preparado);
      setMensagem('Mensagem copiada. O envio ainda deve ser feito manualmente.');
    } catch (erro) {
      setMensagem('Não foi possível copiar automaticamente. Selecione o texto e copie.');
    }
  }

  async function mudarStatus(item, status) {
    try {
      await atualizarComunicacao(item.id, {
        status,
        observacoes: null,
        proximaAcao: item.proxima_acao || null
      });
      setMensagem('Andamento atualizado com sucesso.');
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  function sair() {
    removerToken();
    navegacao('/login', { replace: true });
  }

  const contatosVisiveis = contatos;
  const primeiroContatoExibido = paginacaoContatos.totalRegistros === 0
    ? 0
    : ((paginacaoContatos.paginaAtual - 1) * paginacaoContatos.limite) + 1;
  const ultimoContatoExibido = Math.min(
    paginacaoContatos.paginaAtual * paginacaoContatos.limite,
    paginacaoContatos.totalRegistros
  );

  return (
    <main className="pagina-administrativa">
      <div className="conteudo-administrativo">
        <CabecalhoAdministrativo
          aoSair={sair}
          titulo="Mensagens"
          subtitulo="Organize contatos manuais sem automação nem disparos pelo sistema."
        />
        {mensagem && <MensagemRetorno mensagem={mensagem} tipo="informacao" />}

        <section className="resumo-fluxo-mensagens" aria-label="Etapas do envio manual">
          <div><span>1</span><strong>Prepare o atendimento</strong><small>Escolha um texto pronto ou escreva outro.</small></div>
          <div><span>2</span><strong>Escolha os contatos</strong><small>Pesquise ou use os filtros.</small></div>
          <div><span>3</span><strong>Envie e confirme</strong><small>O envio acontece no WhatsApp.</small></div>
        </section>

        {administrador && (
          <details className="cartao configuracao-comunicacao">
            <summary><span>Números da equipe</span><small>Configuração administrativa</small></summary>
            <div className="conteudo-configuracao-comunicacao">
            <p>Cadastre somente os números usados para abrir as conversas no WhatsApp.</p>
            <form className="formulario-filtros" onSubmit={enviarNumero}>
              <fieldset className="grade-filtros">
                <label>Identificação<input className="campo-input" name="nome" value={numero.nome} onChange={alterarEstado(setNumero, numero)} required /></label>
                <label>Número<input className="campo-input" name="numero" value={numero.numero} onChange={alterarEstado(setNumero, numero)} required /></label>
                <label>Responsável<select className="campo-input" name="responsavel" value={numero.responsavel} onChange={alterarEstado(setNumero, numero)} required><option value="">Selecione uma pessoa</option>{numero.responsavel && !operadores.some(function (item) { return item.nome === numero.responsavel; }) && <option value={numero.responsavel}>{numero.responsavel}</option>}{operadores.map(function (item) { return <option key={item.id} value={item.nome}>{item.nome} — {item.perfil === 'administrador' ? 'Administrador' : 'Operador'}</option>; })}</select></label>
                <label><input type="checkbox" name="ativo" checked={numero.ativo} onChange={alterarEstado(setNumero, numero)} /> Ativo</label>
              </fieldset>
              <div className="acoes-filtros">
                <button className="botao botao-primario">{numeroEdicao ? 'Salvar alterações' : 'Cadastrar número'}</button>
                {numeroEdicao && <button className="botao botao-secundario" type="button" onClick={function () { setNumeroEdicao(null); setNumero(NUMERO_INICIAL); }}>Cancelar edição</button>}
              </div>
            </form>
            <div className="lista-numeros-equipe">
              {numeros.map(function (item) {
                return <article className="numero-equipe-item" key={item.id}><div><strong>{item.nome}</strong><span>{formatarTelefone(item.numero)}</span><small>{item.responsavel} · {item.ativo ? 'Ativo' : 'Inativo'}</small></div><div className="acoes-filtros"><button className="botao botao-secundario" type="button" onClick={function () { setNumeroEdicao(item.id); setNumero({ nome: item.nome, numero: item.numero, responsavel: item.responsavel, ativo: item.ativo }); }}>Editar</button><button className="botao botao-perigo" type="button" onClick={function () { removerNumero(item); }}>Excluir</button></div></article>;
              })}
              {numeros.length === 0 && <p>Nenhum número cadastrado.</p>}
            </div>
            </div>
          </details>
        )}

        {administrador && (
          <details className="cartao configuracao-comunicacao">
            <summary><span>Textos prontos reutilizáveis</span><small>Configuração administrativa</small></summary>
            <div className="conteudo-configuracao-comunicacao">
            <p>Um texto pronto é apenas um conteúdo salvo para reutilização. Ele não envia nenhuma mensagem.</p>
            <form className="formulario-filtros" onSubmit={enviarModelo}>
              <fieldset className="grade-filtros">
                <label>Nome<input className="campo-input" name="nome" value={modelo.nome} onChange={alterarEstado(setModelo, modelo)} required /></label>
                <label>Categoria<input className="campo-input" name="categoria" value={modelo.categoria} onChange={alterarEstado(setModelo, modelo)} required /></label>
                <label>Evento<select className="campo-input" name="eventoId" value={modelo.eventoId || ''} onChange={alterarEstado(setModelo, modelo)}><option value="">Geral</option>{eventos.map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
                <label className="grupo-campo-largo">Texto<textarea className="campo-textarea" name="texto" value={modelo.texto} onChange={alterarEstado(setModelo, modelo)} placeholder="Olá, {{nome}}!" required /></label>
                <label><input type="checkbox" name="ativo" checked={modelo.ativo} onChange={alterarEstado(setModelo, modelo)} /> Ativo</label>
              </fieldset>
              <button className="botao botao-primario">{modeloEdicao ? 'Salvar modelo' : 'Cadastrar modelo'}</button>
            </form>
            <div className="acoes-filtros">
              {modelos.map(function (item) {
                return <button className="botao botao-secundario" type="button" key={item.id} onClick={function () { setModeloEdicao(item.id); setModelo({ nome: item.nome, categoria: item.categoria, texto: item.texto, eventoId: item.evento_id || '', ativo: item.ativo }); }}>{item.nome}</button>;
              })}
            </div>
            </div>
          </details>
        )}

        {administrador && (
          <details className="cartao configuracao-comunicacao">
            <summary><span>Campanhas</span><small>Cadastrar ou editar segmentações</small></summary>
            <div className="conteudo-configuracao-comunicacao">
            <p>A campanha organiza a segmentação e impede confirmações repetidas sem justificativa.</p>
            <form className="formulario-filtros" onSubmit={enviarCampanha}>
              <fieldset className="grade-filtros">
                <label>Nome<input className="campo-input" name="nome" value={campanha.nome} onChange={alterarEstado(setCampanha, campanha)} required /></label>
                <label className="grupo-campo-largo">Descrição<textarea className="campo-textarea" name="descricao" value={campanha.descricao || ''} onChange={alterarEstado(setCampanha, campanha)} /></label>
                <label><input type="checkbox" name="ativo" checked={campanha.ativo} onChange={alterarEstado(setCampanha, campanha)} /> Ativa</label>
              </fieldset>
              <button className="botao botao-primario">{campanhaEdicao ? 'Salvar campanha' : 'Cadastrar campanha'}</button>
            </form>
            <div className="acoes-filtros">
              {campanhas.map(function (item) {
                return <button className="botao botao-secundario" type="button" key={item.id} onClick={function () { setCampanhaEdicao(item.id); setCampanha({ nome: item.nome, descricao: item.descricao || '', ativo: item.ativo }); }}>{item.nome}</button>;
              })}
            </div>
            </div>
          </details>
        )}

        <section className="cartao painel-resultados painel-envio-whatsapp">
          <div className="cabecalho-envio-whatsapp">
            <div><span>ATENDIMENTO MANUAL</span><h2>Preparar conversa no WhatsApp</h2><p>Escolha um texto pronto, selecione os contatos e abra cada conversa no WhatsApp.</p></div>
            <strong>{selecionados.length} contato(s) selecionado(s)</strong>
          </div>
          <div className="cabecalho-etapa-mensagem"><span>1</span><div><strong>Escolha o texto pronto</strong><small>O conteúdo é criado uma vez nas configurações e reutilizado nos atendimentos.</small></div></div>
          <div className="grade-filtros">
            <label>Evento<select className="campo-input" value={preparo.eventoId} onChange={function (evento) { setPreparo(Object.assign({}, preparo, { eventoId: evento.target.value })); filtrarContatosPorEvento(evento.target.value); }}><option value="">Sem evento</option>{eventos.map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
            <label>Número remetente<select className="campo-input" name="numeroId" value={preparo.numeroId} onChange={alterarEstado(setPreparo, preparo)} required><option value="">{numeros.some(function (item) { return item.ativo; }) ? 'Selecione o número que fará o atendimento' : 'Nenhum número ativo cadastrado'}</option>{numeros.filter(function (item) { return item.ativo; }).map(function (item) { return <option key={item.id} value={item.id}>{item.nome} — {formatarTelefone(item.numero)} — {item.responsavel}</option>; })}</select></label>
            <label>Texto pronto<select className="campo-input" name="modeloId" value={preparo.modeloId} onChange={function (evento) { const escolhido = modelos.find(function (item) { return String(item.id) === evento.target.value; }); setPreparo(Object.assign({}, preparo, { modeloId: evento.target.value, texto: escolhido ? escolhido.texto : '' })); }} required><option value="">Selecione um texto pronto</option>{modelos.filter(function (item) { return item.ativo; }).map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
            <label>Campanha<select className="campo-input" name="campanhaId" value={preparo.campanhaId} onChange={alterarEstado(setPreparo, preparo)}><option value="">Sem campanha</option>{campanhas.filter(function (item) { return item.ativo; }).map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
            <div className="grupo-campo-largo"><span className="rotulo-previa-template">Prévia do texto</span><div className="previa-template-mensagem">{preparo.texto || 'Selecione um texto pronto para visualizar o conteúdo.'}</div><small>Campos como {'{{nome}}'} serão preenchidos individualmente para cada contato.</small></div>
            {duplicidade && <label className="grupo-campo-largo">Motivo obrigatório do reenvio<textarea className="campo-textarea" name="motivoReenvio" value={preparo.motivoReenvio} onChange={alterarEstado(setPreparo, preparo)} required /></label>}
          </div>
          <details className="filtros-avancados-mensagens">
            <summary>Filtros avançados de público</summary>
            <div className="grade-filtros">
            <label>Situação<select className="campo-input" name="situacao" value={filtrosContatos.situacao} onChange={alterarEstado(setFiltrosContatos, filtrosContatos)}><option value="">Todas</option><option value="nunca_enviado">Nunca recebeu mensagem</option>{STATUS.filter(function (item) { return item[0] !== 'preparada' && item[0] !== 'enviada'; }).map(function (item) { return <option key={item[0]} value={item[0]}>{item[1]}</option>; })}<option value="enviada">Mensagem enviada</option></select></label>
            <label>Bairro<select className="campo-input" name="bairro" value={filtrosContatos.bairro} onChange={alterarEstado(setFiltrosContatos, filtrosContatos)}><option value="">Todos</option><option value="nao_informado">Não informado</option>{bairros.map(function (item) { return <option key={item} value={item}>{item}</option>; })}</select></label>
            <label>Problema<select className="campo-input" name="problema" value={filtrosContatos.problema} onChange={alterarEstado(setFiltrosContatos, filtrosContatos)}><option value="">Todos</option><option value="nao_informado">Não informado</option>{categoriasProblema.map(function (item) { return <option key={item} value={item}>{item}</option>; })}</select></label>
            <label>Consentimento<select className="campo-input" name="consentimento" value={filtrosContatos.consentimento} onChange={alterarEstado(setFiltrosContatos, filtrosContatos)}><option value="">Todos</option><option value="autorizado">Autorizado</option><option value="nao_informado">Não informado</option><option value="recusado">Recusado ou revogado</option></select></label>
            <label>Não recebeu campanha<select className="campo-input" name="campanhaNaoRecebidaId" value={filtrosContatos.campanhaNaoRecebidaId} onChange={alterarEstado(setFiltrosContatos, filtrosContatos)}><option value="">Qualquer</option>{campanhas.map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
            <label><input type="checkbox" name="cadastroIncompleto" checked={filtrosContatos.cadastroIncompleto} onChange={alterarEstado(setFiltrosContatos, filtrosContatos)} /> Cadastro incompleto</label>
            </div>
            <div className="acoes-filtros acoes-filtros-publico">
              <button className="botao botao-primario" type="button" onClick={buscarSegmento} disabled={filtrandoContatos}>{filtrandoContatos ? 'Buscando...' : 'Aplicar filtros'}</button>
              <button className="botao botao-secundario" type="button" onClick={limparFiltrosPublico} disabled={filtrandoContatos}>Limpar filtros</button>
            </div>
          </details>
          <div className="cabecalho-etapa-mensagem"><span>2</span><div><strong>Escolha os contatos</strong><small>Pesquise pelo nome ou telefone e marque quem será atendido.</small></div></div>
          <div className="seletor-contatos-comunicacao">
            <div className="cabecalho-seletor-contatos">
              <div>
                <h3>Contatos disponíveis</h3>
                <p>Use a busca rápida ou selecione todos os contatos exibidos.</p>
              </div>
              <strong>{selecionados.length} selecionado{selecionados.length === 1 ? '' : 's'}</strong>
            </div>

            <div className="ferramentas-seletor-contatos">
              <form className="busca-paginada-contatos" onSubmit={buscarContatoNoBanco}>
                <label className="busca-contatos-comunicacao">
                  <span>Buscar contato em toda a base</span>
                  <input
                    className="campo-input"
                    type="search"
                    value={buscaContatos}
                    onChange={function (evento) { setBuscaContatos(evento.target.value); }}
                    placeholder="Digite nome ou telefone"
                  />
                </label>
                <button className="botao botao-primario botao-buscar-contatos" type="submit" disabled={filtrandoContatos}>
                  {filtrandoContatos ? 'Buscando...' : 'Buscar'}
                </button>
              </form>
              <div className="acoes-seletor-contatos">
                <button
                  className="botao botao-secundario"
                  type="button"
                  onClick={function () { selecionarContatosVisiveis(contatosVisiveis); }}
                  disabled={contatosVisiveis.length === 0}
                >
                  Selecionar esta página
                </button>
                <button
                  className="botao botao-secundario"
                  type="button"
                  onClick={limparSelecao}
                  disabled={selecionados.length === 0}
                >
                  Limpar seleção
                </button>
              </div>
            </div>

            <div className="lista-selecao-comunicacoes">
              {contatosVisiveis.length === 0 && (
                <p className="sem-contatos-comunicacao">Nenhum contato encontrado.</p>
              )}
              {contatosVisiveis.map(function (item) {
                const selecionado = selecionados.includes(normalizarId(item.id));

                return (
                  <label
                    className={selecionado
                      ? 'item-selecao-comunicacao item-selecao-comunicacao-ativo'
                      : 'item-selecao-comunicacao'}
                    key={item.id}
                  >
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={function () { selecionarContato(item.id); }}
                    />
                    <span>
                      <strong>{item.nome || 'Nome não informado'}</strong>
                      <small>{formatarTelefone(item.telefone)}</small>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="rodape-seletor-contatos">
              <small className="resumo-seletor-contatos">
                Exibindo {primeiroContatoExibido}-{ultimoContatoExibido} de {paginacaoContatos.totalRegistros} contatos.
              </small>
              <nav className="paginacao-contatos" aria-label="Paginas de contatos">
                <button
                  className="botao-pagina-contatos"
                  type="button"
                  onClick={function () { mudarPaginaContatos(paginacaoContatos.paginaAtual - 1); }}
                  disabled={paginacaoContatos.paginaAtual <= 1 || filtrandoContatos}
                  aria-label="Pagina anterior"
                >
                  &lsaquo;
                </button>
                <span>Página <strong>{paginacaoContatos.paginaAtual}</strong> de {Math.max(paginacaoContatos.totalPaginas, 1)}</span>
                <button
                  className="botao-pagina-contatos"
                  type="button"
                  onClick={function () { mudarPaginaContatos(paginacaoContatos.paginaAtual + 1); }}
                  disabled={paginacaoContatos.paginaAtual >= paginacaoContatos.totalPaginas || filtrandoContatos}
                  aria-label="Proxima pagina"
                >
                  &rsaquo;
                </button>
              </nav>
            </div>
          </div>
          <div className="rodape-preparo-mensagens">
            <div><strong>Pronto para preparar?</strong><small>Nenhuma mensagem será enviada automaticamente.</small></div>
            <button
              className="botao botao-primario botao-preparar-comunicacoes"
              type="button"
              onClick={function () { preparar(duplicidade); }}
              disabled={selecionados.length === 0 || !preparo.numeroId || !preparo.modeloId || (duplicidade && !preparo.motivoReenvio.trim())}
            >
              {duplicidade ? 'Confirmar reenvio com motivo' : 'Preparar ' + selecionados.length + ' mensagem(ns)'}
            </button>
          </div>
        </section>

        {filaManual.length > 0 && (
          <section className="cartao painel-resultados">
            <div className="cabecalho-envio-whatsapp"><div><span>ETAPA FINAL</span><h2>Mensagens prontas para envio</h2><p>Abra, envie no WhatsApp e volte para confirmar.</p></div><div className="acoes-cabecalho-mensagens"><strong>{filaManual.length} pendente(s)</strong><button className="botao botao-confirmar-envio" type="button" onClick={confirmarTodasPreparadas}>Confirmar todas</button><button className="botao botao-perigo" type="button" onClick={cancelarTodasPreparadas}>Cancelar todas</button></div></div>
            {filaManual.map(function (item, indice) {
              return <article className="registro-historico cartao-envio-manual" key={item.id}><span className="numero-fila-mensagem">{indice + 1}</span><div><strong>Mensagem preparada</strong><p>{item.texto_preparado}</p><div className="acoes-filtros"><button className="botao botao-secundario" type="button" onClick={function () { copiarMensagem(item); }}>Copiar texto</button><a className="botao botao-whatsapp" href={item.linkWhatsapp} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">↗</span> Abrir WhatsApp</a><button className="botao botao-confirmar-envio" type="button" onClick={function () { confirmar(item); }}>Confirmar que enviei</button><button className="botao botao-perigo" type="button" onClick={function () { cancelar(item); }}>Cancelar mensagem</button></div></div></article>;
            })}
          </section>
        )}

        <section className="cartao painel-resultados">
          <div className="cabecalho-envio-whatsapp"><div><span>ACOMPANHAMENTO</span><h2>Hist&oacute;rico de comunica&ccedil;&otilde;es</h2><p>Consulte envios e atualize o andamento de cada atendimento.</p></div><div className="acoes-cabecalho-mensagens"><strong>{comunicacoes.length} registro(s)</strong>{comunicacoes.some(function (item) { return item.status === 'preparada'; }) && <><button className="botao botao-confirmar-envio" type="button" onClick={confirmarTodasPreparadas}>Confirmar preparadas</button><button className="botao botao-perigo" type="button" onClick={cancelarTodasPreparadas}>Cancelar preparadas</button></>}</div></div>
          <details className="filtros-avancados-mensagens">
            <summary>Filtrar histórico</summary>
            <div className="grade-filtros">
            <label>Evento<select className="campo-input" name="eventoId" value={filtrosHistorico.eventoId} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)}><option value="">Todos</option>{eventos.map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
            <label>Status<select className="campo-input" name="status" value={filtrosHistorico.status} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)}><option value="">Todos</option>{STATUS.map(function (item) { return <option key={item[0]} value={item[0]}>{item[1]}</option>; })}</select></label>
            <label>Campanha<select className="campo-input" name="campanhaId" value={filtrosHistorico.campanhaId} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)}><option value="">Todas</option>{campanhas.map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
            <label>Template<select className="campo-input" name="modeloId" value={filtrosHistorico.modeloId} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)}><option value="">Todos</option>{modelos.map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
            <label>Operador<select className="campo-input" name="operadorId" value={filtrosHistorico.operadorId} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)}><option value="">Todos</option>{operadores.map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
            <label>WhatsApp utilizado<select className="campo-input" name="numeroId" value={filtrosHistorico.numeroId} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)}><option value="">Todos</option>{numeros.map(function (item) { return <option key={item.id} value={item.id}>{item.nome}</option>; })}</select></label>
            <label>Bairro<select className="campo-input" name="bairro" value={filtrosHistorico.bairro} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)}><option value="">Todos</option><option value="nao_informado">Não informado</option>{bairros.map(function (item) { return <option key={item} value={item}>{item}</option>; })}</select></label>
            <label>Problema<select className="campo-input" name="problema" value={filtrosHistorico.problema} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)}><option value="">Todos</option><option value="nao_informado">Não informado</option>{categoriasProblema.map(function (item) { return <option key={item} value={item}>{item}</option>; })}</select></label>
            <label>Último contato a partir de<input className="campo-input" type="date" name="ultimoContatoInicio" value={filtrosHistorico.ultimoContatoInicio} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)} /></label>
            <label>Último contato até<input className="campo-input" type="date" name="ultimoContatoFim" value={filtrosHistorico.ultimoContatoFim} onChange={alterarEstado(setFiltrosHistorico, filtrosHistorico)} /></label>
            </div>
            <button className="botao botao-primario" type="button" onClick={function () { carregar(filtrosHistorico); }}>Aplicar filtros</button>
          </details>
          <div className="tabela-responsiva">
            <table className="tabela-contatos"><thead><tr><th>Contato</th><th>Campanha / texto pronto</th><th>WhatsApp / operador</th><th>Status</th><th>Data</th></tr></thead><tbody>{comunicacoes.map(function (item) { return <tr key={item.id}><td>{item.contato_nome}<br /><small>{formatarTelefone(item.telefone)}</small></td><td>{item.campanha_nome || 'Sem campanha'}<br /><small>{item.modelo_nome || 'Texto pronto'}</small></td><td>{item.numero_nome}<br /><small>{item.operador_nome}</small></td><td>{item.status === 'preparada' ? <div className="acoes-status-preparada"><button className="botao botao-primario" type="button" onClick={function () { confirmar(item); }}>Confirmar envio</button><button className="botao botao-secundario" type="button" onClick={function () { cancelar(item); }}>Cancelar</button></div> : <select value={item.status} onChange={function (evento) { mudarStatus(item, evento.target.value); }}><option value="enviada">Mensagem enviada</option>{STATUS.filter(function (status) { return status[0] !== 'preparada' && status[0] !== 'enviada'; }).map(function (status) { return <option key={status[0]} value={status[0]}>{status[1]}</option>; })}</select>}</td><td>{new Date(item.criado_em).toLocaleString('pt-BR')}</td></tr>; })}</tbody></table>
          </div>
        </section>
      </div>
    </main>
  );
}

export default ComunicacoesAdministrativas;
