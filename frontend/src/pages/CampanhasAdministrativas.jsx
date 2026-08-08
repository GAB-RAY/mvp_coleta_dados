import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import MensagemRetorno from '../components/MensagemRetorno';
import Carregando from '../components/Carregando';
import { obterUsuario, removerToken } from '../utils/armazenamentoToken';
import { buscarOpcoesFormulario } from '../services/contatoService';
import { listarEventos } from '../services/eventoService';
import {
  alterarStatusCampanha,
  atualizarLimite,
  atualizarTemplate,
  criarCampanha,
  criarLoteCampanha,
  criarTemplate,
  listarCampanhas,
  listarContatosLote,
  listarFalhasCampanha,
  listarLotesCampanha,
  listarTemplates,
  obterCapacidade,
  reprocessarTentativa,
  visualizarPreviaFiltros,
  visualizarPublicoCampanha
} from '../services/campanhaService';

const CAMPANHA_INICIAL={nome:'',modeloId:'',bairro:'',problema:'',eventoId:'',autorizacaoMensagens:'',cadastroIncompleto:false};
const TEMPLATE_INICIAL={nome:'',categoria:'Geral',conteudo:'',ativo:true};

function textoStatus(status){return String(status||'').replaceAll('_',' ');}
function telefoneMascarado(valor){return String(valor||'Nao informado').replaceAll('*','•');}

function ListaContatosCampanha({contatos,vazia}){
  if(!contatos||contatos.length===0)return <div className="estado-vazio-campanha"><strong>{vazia||'Nenhum contato disponível.'}</strong></div>;
  return <div className="lista-contatos-campanha">{contatos.map(function(contato,indice){return <article className="contato-previa-campanha" key={contato.nome+'-'+contato.telefoneMascarado+'-'+indice}>
    <div><strong>{contato.nome}</strong><span>{telefoneMascarado(contato.telefoneMascarado)}</span></div>
    <dl><div><dt>Bairro</dt><dd>{contato.bairro}</dd></div><div><dt>Problema</dt><dd>{contato.problema}</dd></div>{contato.status&&<div><dt>Status</dt><dd>{textoStatus(contato.status)}</dd></div>}</dl>
  </article>;})}</div>;
}

function CampanhasAdministrativas(){
  const navegacao=useNavigate();
  const usuario=obterUsuario();
  const administrador=usuario&&usuario.perfil==='administrador';
  const [campanhas,setCampanhas]=useState([]);
  const [templates,setTemplates]=useState([]);
  const [capacidade,setCapacidade]=useState(null);
  const [bairros,setBairros]=useState([]);
  const [problemas,setProblemas]=useState([]);
  const [eventos,setEventos]=useState([]);
  const [formulario,setFormulario]=useState(CAMPANHA_INICIAL);
  const [previaCriacao,setPreviaCriacao]=useState(null);
  const [mostrarCriacao,setMostrarCriacao]=useState(false);
  const [template,setTemplate]=useState(TEMPLATE_INICIAL);
  const [templateEdicao,setTemplateEdicao]=useState(null);
  const [selecionada,setSelecionada]=useState(null);
  const [publico,setPublico]=useState(null);
  const [lotes,setLotes]=useState([]);
  const [falhas,setFalhas]=useState([]);
  const [tamanho,setTamanho]=useState(250);
  const [loteAberto,setLoteAberto]=useState(null);
  const [contatosLote,setContatosLote]=useState([]);
  const [carregandoLote,setCarregandoLote]=useState(false);
  const [criandoLote,setCriandoLote]=useState(false);
  const [mensagem,setMensagem]=useState('');
  const [carregando,setCarregando]=useState(true);

  async function carregar(){
    setCarregando(true);
    try{
      const respostas=await Promise.all([listarCampanhas(),listarTemplates(),obterCapacidade(),buscarOpcoesFormulario(),listarEventos()]);
      setCampanhas(respostas[0].campanhas||[]);
      setTemplates(respostas[1].templates||[]);
      setCapacidade(respostas[2].capacidade);
      setBairros(respostas[3].bairros||[]);
      setProblemas(respostas[3].categoriasProblema||[]);
      setEventos(respostas[4].eventos||[]);
      return respostas[0].campanhas||[];
    }catch(erro){
      if(erro.statusHttp===401){removerToken();navegacao('/login',{replace:true});}
      else setMensagem(erro.message);
      return [];
    }finally{setCarregando(false);}
  }

  useEffect(function(){carregar();},[]);
  useEffect(function(){
    if(!selecionada||!['rascunho','pronta','ativa'].includes(selecionada.status))return undefined;
    const quantidade=Number(tamanho);
    if(!Number.isInteger(quantidade)||quantidade<1||quantidade>10000)return undefined;
    let ativo=true;
    const temporizador=window.setTimeout(function(){
      visualizarPublicoCampanha(selecionada.id,quantidade).then(function(resposta){if(ativo)setPublico(resposta.publico);}).catch(function(erro){if(ativo)setMensagem(erro.message);});
    },350);
    return function(){ativo=false;window.clearTimeout(temporizador);};
  },[tamanho,selecionada]);

  function sair(){removerToken();navegacao('/login',{replace:true});}
  function montarFiltros(){
    const filtros={};
    if(formulario.bairro)filtros.bairro=formulario.bairro;
    if(formulario.problema)filtros.problema=formulario.problema;
    if(formulario.eventoId)filtros.eventoId=formulario.eventoId;
    if(formulario.autorizacaoMensagens)filtros.autorizacaoMensagens=formulario.autorizacaoMensagens;
    if(formulario.cadastroIncompleto)filtros.cadastroIncompleto='true';
    return filtros;
  }
  function alterar(evento){
    const alvo=evento.target;
    setFormulario(Object.assign({},formulario,{[alvo.name]:alvo.type==='checkbox'?alvo.checked:alvo.value}));
    setPreviaCriacao(null);
  }

  async function verPreviaCriacao(){
    try{
      const resposta=await visualizarPreviaFiltros(montarFiltros());
      setPreviaCriacao(resposta.publico);
      setMensagem('Prévia atualizada. Revise o público antes de criar a campanha.');
    }catch(erro){setMensagem(erro.message);}
  }

  async function salvarCampanha(evento){
    evento.preventDefault();
    if(!previaCriacao){setMensagem('Veja a prévia do público antes de criar a campanha.');return;}
    try{
      const resposta=await criarCampanha({
        nome:formulario.nome,
        finalidade:'Campanha criada pelo painel administrativo.',
        modeloId:formulario.modeloId,
        filtros:montarFiltros()
      });
      setMensagem(resposta.mensagem);
      setFormulario(CAMPANHA_INICIAL);
      setPreviaCriacao(null);
      setMostrarCriacao(false);
      const atualizadas=await carregar();
      const item=atualizadas.find(function(campanha){return campanha.id===resposta.campanha.id;})||resposta.campanha;
      await abrirCampanha(item,250);
    }catch(erro){setMensagem(erro.message);}
  }

  async function salvarTemplate(evento){
    evento.preventDefault();
    try{
      const resposta=templateEdicao?await atualizarTemplate(templateEdicao,template):await criarTemplate(template);
      setMensagem(resposta.mensagem);
      setTemplate(TEMPLATE_INICIAL);
      setTemplateEdicao(null);
      await carregar();
    }catch(erro){setMensagem(erro.message);}
  }
  function editarTemplate(item){setTemplateEdicao(item.id);setTemplate({nome:item.nome,categoria:item.categoria,conteudo:item.texto,ativo:item.ativo});}

  async function abrirCampanha(item,quantidade){
    const quantidadePrevia=Number(quantidade||tamanho||250);
    try{
      const respostas=await Promise.all([
        visualizarPublicoCampanha(item.id,quantidadePrevia),
        listarLotesCampanha(item.id),
        listarFalhasCampanha(item.id)
      ]);
      setSelecionada(item);
      setPublico(respostas[0].publico);
      setLotes(respostas[1].lotes||[]);
      setFalhas(respostas[2].falhas||[]);
      setTamanho(quantidadePrevia);
      setLoteAberto(null);
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(erro){setMensagem(erro.message);}
  }

  async function atualizarPreviaLote(){
    if(!selecionada)return;
    const quantidade=Number(tamanho);
    if(!Number.isInteger(quantidade)||quantidade<1){setMensagem('Informe uma quantidade válida para o lote.');return;}
    try{
      const resposta=await visualizarPublicoCampanha(selecionada.id,quantidade);
      setPublico(resposta.publico);
    }catch(erro){setMensagem(erro.message);}
  }

  async function abrirLote(lote){
    setLoteAberto(lote);
    setContatosLote([]);
    setCarregandoLote(true);
    try{const resposta=await listarContatosLote(selecionada.id,lote.id);setContatosLote(resposta.contatos||[]);}
    catch(erro){setMensagem(erro.message);setLoteAberto(null);}
    finally{setCarregandoLote(false);}
  }

  async function reprocessar(item){
    if(!window.confirm('Criar nova tentativa para esta falha?'))return;
    try{const resposta=await reprocessarTentativa(item.id);setMensagem(resposta.mensagem);await abrirCampanha(selecionada,tamanho);}
    catch(erro){setMensagem(erro.message);}
  }

  async function mudarStatus(status){
    try{
      const resposta=await alterarStatusCampanha(selecionada.id,status);
      setMensagem(resposta.mensagem);
      const atualizadas=await carregar();
      const item=atualizadas.find(function(campanha){return campanha.id===selecionada.id;})||resposta.campanha;
      await abrirCampanha(item,tamanho);
    }catch(erro){setMensagem(erro.message);}
  }

  async function criarLote(){
    if(criandoLote||!publico||publico.quantidadeEfetiva<1)return;
    setCriandoLote(true);
    try{
      const chave=crypto.randomUUID();
      const resposta=await criarLoteCampanha(selecionada.id,Number(tamanho),chave);
      setMensagem(resposta.mensagem+' Foram reservados '+resposta.resultado.lote.tamanho_efetivo+' contatos.');
      const atualizadas=await carregar();
      const item=atualizadas.find(function(campanha){return campanha.id===selecionada.id;})||selecionada;
      await abrirCampanha(item,tamanho);
    }catch(erro){setMensagem(erro.message);}
    finally{setCriandoLote(false);}
  }

  async function salvarLimite(){
    const valor=window.prompt('Novo limite móvel de 24 horas:',String(capacidade&&capacidade.limite||250));
    if(!valor)return;
    const motivo=window.prompt('Informe o motivo da alteração:');
    if(!motivo)return;
    try{const resposta=await atualizarLimite(Number(valor),motivo);setCapacidade(resposta.capacidade);setMensagem(resposta.mensagem);}
    catch(erro){setMensagem(erro.message);}
  }

  const capacidadeInsuficiente=Boolean(publico&&Number(tamanho)>Number(publico.capacidade&&publico.capacidade.disponivel||0));
  const podeCriarLote=Boolean(selecionada&&['pronta','ativa'].includes(selecionada.status)&&publico&&publico.quantidadeEfetiva>0&&!capacidadeInsuficiente&&!criandoLote);
  const restantes=publico?Number(publico.restantes||0):0;

  return <main className="pagina-administrativa"><div className="conteudo-administrativo campanhas-pagina">
    <CabecalhoAdministrativo aoSair={sair} titulo="Campanhas" subtitulo="Crie campanhas, confira o público e organize os próximos lotes."/>
    {mensagem&&<MensagemRetorno mensagem={mensagem} tipo="informacao"/>}

    <section className="resumo-capacidade-campanha">
      <div><span>Capacidade nas últimas 24 horas</span><strong>{capacidade?capacidade.disponivel:'—'} disponíveis</strong><small>{capacidade?capacidade.utilizado+' de '+capacidade.limite+' utilizados':'Carregando capacidade...'}</small></div>
      {administrador&&<button className="botao botao-secundario" type="button" onClick={salvarLimite}>Alterar limite</button>}
    </section>

    <section className="cartao campanhas-listagem">
      <div className="cabecalho-resultados"><div><span className="etiqueta-pagina">1. Escolha</span><h2>Campanhas</h2><p>Abra uma campanha para acompanhar seu público e seus lotes.</p></div>{administrador&&<button className="botao botao-primario" type="button" onClick={function(){setMostrarCriacao(!mostrarCriacao);setSelecionada(null);}}>{mostrarCriacao?'Fechar criação':'Nova campanha'}</button>}</div>
      {carregando?<Carregando mensagem="Carregando campanhas..."/>:campanhas.length===0?<div className="estado-vazio-campanha"><strong>Nenhuma campanha cadastrada.</strong><span>Crie a primeira campanha para começar.</span></div>:<div className="grade-campanhas">{campanhas.map(function(item){return <article className={'cartao-campanha-resumo '+(selecionada&&selecionada.id===item.id?'ativo':'')} key={item.id}>
        <div><span className={'status-campanha status-'+item.status}>{textoStatus(item.status)}</span><h3>{item.nome}</h3><p>{item.modelo_nome||'Template não informado'}</p></div>
        <div className="rodape-cartao-campanha"><span>{item.quantidade_lotes||0} lote(s)</span><button className="botao botao-secundario" type="button" onClick={function(){abrirCampanha(item,250);}}>Abrir campanha</button></div>
      </article>;})}</div>}
    </section>

    {mostrarCriacao&&administrador&&<section className="cartao campanha-criacao">
      <div className="cabecalho-secao"><div><span className="etiqueta-pagina">2. Configure</span><h2>Nova campanha</h2><p>Informe o nome, escolha um texto pronto e use os filtros necessários.</p></div></div>
      <form onSubmit={salvarCampanha}>
        <fieldset className="grade-criacao-campanha">
          <label>Nome da campanha<input className="campo-input" name="nome" value={formulario.nome} onChange={alterar} required/></label>
          <label>Template<select className="campo-input" name="modeloId" value={formulario.modeloId} onChange={alterar} required><option value="">Selecione</option>{templates.filter(function(item){return item.ativo;}).map(function(item){return <option key={item.id} value={item.id}>{item.nome}</option>;})}</select></label>
          <label>Bairro<select className="campo-input" name="bairro" value={formulario.bairro} onChange={alterar}><option value="">Todos</option><option value="nao_informado">Não informado</option>{bairros.map(function(item){return <option key={item} value={item}>{item}</option>;})}</select></label>
          <label>Problema<select className="campo-input" name="problema" value={formulario.problema} onChange={alterar}><option value="">Todos</option><option value="nao_informado">Não informado</option>{problemas.map(function(item){return <option key={item} value={item}>{item}</option>;})}</select></label>
          <label>Evento<select className="campo-input" name="eventoId" value={formulario.eventoId} onChange={alterar}><option value="">Todos</option><option value="sem_evento">Sem evento</option>{eventos.map(function(item){return <option key={item.id} value={item.id}>{item.nome}</option>;})}</select></label>
          <label>Consentimento<select className="campo-input" name="autorizacaoMensagens" value={formulario.autorizacaoMensagens} onChange={alterar}><option value="">Todos</option><option value="nao_informado">Não informado</option><option value="autorizado">Autorizado</option><option value="recusado">Recusado</option><option value="revogado">Revogado</option></select></label>
          <label className="opcao-cadastro-incompleto"><input type="checkbox" name="cadastroIncompleto" checked={formulario.cadastroIncompleto} onChange={alterar}/> Somente cadastros incompletos</label>
        </fieldset>
        <div className="acoes-fluxo-campanha"><button className="botao botao-secundario" type="button" onClick={verPreviaCriacao}>Ver prévia do público</button>{previaCriacao&&<button className="botao botao-primario" type="submit">Criar campanha</button>}</div>
      </form>
      {previaCriacao&&<div className="bloco-previa-campanha"><div className="metricas-previa-campanha"><article><span>Encontrado</span><strong>{previaCriacao.publicoEncontrado}</strong></article><article><span>Apto</span><strong>{previaCriacao.publicoApto}</strong></article><article><span>Não apto</span><strong>{previaCriacao.publicoNaoApto}</strong></article></div><div className="cabecalho-lista-previa"><div><h3>Quem pode entrar na campanha</h3><p>Telefones protegidos; mostramos somente os últimos dígitos.</p></div><span>{previaCriacao.contatos.length} exibidos</span></div><ListaContatosCampanha contatos={previaCriacao.contatos}/>{previaCriacao.listaLimitada&&<p className="aviso-lista-limitada">A lista é uma amostra. O total completo será considerado na reserva.</p>}</div>}
    </section>}

    {selecionada&&<section className="cartao campanha-detalhes">
      <div className="cabecalho-campanha-aberta"><div><span className="etiqueta-pagina">Campanha aberta</span><h2>{selecionada.nome}</h2><div className="linha-informacoes-campanha"><span className={'status-campanha status-'+selecionada.status}>{textoStatus(selecionada.status)}</span><span>Template: {selecionada.modelo_nome||'Não informado'}</span></div></div><button className="botao botao-secundario" type="button" onClick={function(){setSelecionada(null);setPublico(null);}}>Fechar</button></div>

      <div className="metricas-campanha"><article><span>Aptos</span><strong>{publico?publico.publicoApto:0}</strong></article><article><span>Reservados</span><strong>{selecionada.reservado||0}</strong></article><article><span>Enviados</span><strong>{selecionada.enviado||0}</strong></article><article><span>Entregues</span><strong>{selecionada.entregue||0}</strong></article><article><span>Lidos</span><strong>{selecionada.lido||0}</strong></article><article><span>Falhas</span><strong>{selecionada.falhou||0}</strong></article><article><span>Restantes</span><strong>{restantes}</strong></article></div>

      <div className="acoes-status-campanha">{selecionada.status==='rascunho'&&administrador&&<button className="botao botao-primario" type="button" onClick={function(){mudarStatus('pronta');}}>Liberar criação de lotes</button>}{selecionada.status==='ativa'&&administrador&&<button className="botao botao-secundario" type="button" onClick={function(){mudarStatus('pausada');}}>Pausar</button>}{selecionada.status==='pausada'&&administrador&&<button className="botao botao-primario" type="button" onClick={function(){mudarStatus('ativa');}}>Retomar</button>}{['ativa','pausada'].includes(selecionada.status)&&administrador&&<button className="botao botao-secundario" type="button" onClick={function(){mudarStatus('concluida');}}>Concluir</button>}{['rascunho','pronta','ativa','pausada'].includes(selecionada.status)&&administrador&&<button className="botao botao-perigo" type="button" onClick={function(){mudarStatus('cancelada');}}>Cancelar campanha</button>}</div>

      {['rascunho','pronta','ativa'].includes(selecionada.status)&&<div className="bloco-proximo-lote">
        <div className="cabecalho-secao"><div><span className="etiqueta-pagina">Próximo lote</span><h3>Confira os contatos antes de reservar</h3><p>A lista segue os filtros salvos nesta campanha.</p></div></div>
        <div className="controle-tamanho-lote"><label>Quantidade do próximo lote<input className="campo-input" type="number" min="1" max="10000" value={tamanho} onChange={function(evento){setTamanho(evento.target.value);}}/></label><button className="botao botao-secundario" type="button" onClick={atualizarPreviaLote}>Atualizar prévia</button></div>
        {publico&&<><div className="resumo-proximo-lote"><strong>{publico.quantidadeEfetiva} contato(s) entrarão neste lote</strong>{publico.quantidadeEfetiva<Number(tamanho)&&!capacidadeInsuficiente&&<span>Há menos contatos disponíveis que a quantidade solicitada. O lote será criado com {publico.quantidadeEfetiva}.</span>}{capacidadeInsuficiente&&<span>A quantidade solicitada ultrapassa a capacidade atual de {publico.capacidade.disponivel}. Reduza o lote para continuar.</span>}</div><ListaContatosCampanha contatos={publico.contatos} vazia="Não existem novos contatos aptos para este lote."/>{publico.listaLimitada&&<p className="aviso-lista-limitada">Exibindo os primeiros 1.000 contatos da reserva.</p>}<div className="acoes-fluxo-campanha"><button className="botao botao-primario botao-criar-lote" type="button" disabled={!podeCriarLote} onClick={criarLote}>{criandoLote?'Criando lote...':'Criar lote com estes '+publico.quantidadeEfetiva+' contatos'}</button></div></>}
      </div>}

      <div className="secao-lotes-campanha"><div className="cabecalho-secao"><div><span className="etiqueta-pagina">Acompanhamento</span><h3>Lotes da campanha</h3></div></div>{lotes.length===0?<div className="estado-vazio-campanha"><strong>Nenhum lote criado.</strong><span>Confira a prévia acima para criar o primeiro.</span></div>:<div className="grade-lotes-campanha">{lotes.map(function(lote){return <article className="cartao-lote-campanha" key={lote.id}><div><span>Lote {lote.ordem}</span><strong>{lote.tamanho_efetivo} contatos</strong></div><dl><div><dt>Status</dt><dd>{textoStatus(lote.status)}</dd></div><div><dt>Data</dt><dd>{new Date(lote.criado_em).toLocaleString('pt-BR')}</dd></div></dl><button className="botao botao-secundario" type="button" onClick={function(){abrirLote(lote);}}>Ver contatos</button></article>;})}</div>}</div>

      {falhas.length>0&&<details className="secao-secundaria-campanha"><summary>Falhas que podem ser reprocessadas ({falhas.length})</summary><div className="lista-falhas-campanha">{falhas.map(function(item){return <article key={item.id}><div><strong>{item.contato_nome||'Não informado'}</strong><span>Lote {item.lote_ordem} · Tentativa {item.numero_tentativa}</span><small>{item.codigo_erro_externo||'Sem código'} — {item.titulo_erro||'Falha'}</small></div><button className="botao botao-secundario" type="button" onClick={function(){reprocessar(item);}}>Reprocessar</button></article>;})}</div></details>}
    </section>}

    {administrador&&<details className="cartao secao-secundaria-campanha gerenciar-templates-campanha"><summary>Gerenciar templates de mensagem</summary><div className="conteudo-templates-campanha"><form onSubmit={salvarTemplate}><fieldset className="grade-criacao-campanha"><label>Nome<input className="campo-input" value={template.nome} onChange={function(evento){setTemplate(Object.assign({},template,{nome:evento.target.value}));}} required/></label><label>Categoria<input className="campo-input" value={template.categoria} onChange={function(evento){setTemplate(Object.assign({},template,{categoria:evento.target.value}));}} required/></label><label className="campo-template-conteudo">Conteúdo<textarea className="campo-input" value={template.conteudo} onChange={function(evento){setTemplate(Object.assign({},template,{conteudo:evento.target.value}));}} required/></label><label className="opcao-cadastro-incompleto"><input type="checkbox" checked={template.ativo} onChange={function(evento){setTemplate(Object.assign({},template,{ativo:evento.target.checked}));}}/> Template ativo</label></fieldset><div className="acoes-fluxo-campanha"><button className="botao botao-primario" type="submit">{templateEdicao?'Salvar alterações':'Criar template'}</button>{templateEdicao&&<button className="botao botao-secundario" type="button" onClick={function(){setTemplateEdicao(null);setTemplate(TEMPLATE_INICIAL);}}>Cancelar edição</button>}</div></form><div className="lista-templates-campanha">{templates.map(function(item){return <article key={item.id}><div><strong>{item.nome}</strong><span>{item.categoria} · {item.ativo?'Ativo':'Inativo'}</span></div><button className="botao botao-secundario" type="button" onClick={function(){editarTemplate(item);}}>Editar</button></article>;})}</div></div></details>}

    {loteAberto&&<div className="sobreposicao-campanha" role="presentation" onMouseDown={function(evento){if(evento.target===evento.currentTarget)setLoteAberto(null);}}><section className="painel-contatos-lote" role="dialog" aria-modal="true" aria-labelledby="titulo-contatos-lote"><div className="cabecalho-campanha-aberta"><div><span className="etiqueta-pagina">Lote {loteAberto.ordem}</span><h2 id="titulo-contatos-lote">{loteAberto.tamanho_efetivo} contatos reservados</h2><p>Telefones aparecem mascarados para proteger os dados.</p></div><button className="botao botao-secundario" type="button" onClick={function(){setLoteAberto(null);}}>Fechar</button></div>{carregandoLote?<Carregando mensagem="Carregando contatos do lote..."/>:<ListaContatosCampanha contatos={contatosLote}/>}</section></div>}
  </div></main>;
}

export default CampanhasAdministrativas;
