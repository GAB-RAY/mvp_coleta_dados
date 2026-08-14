import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import MensagemRetorno from '../components/MensagemRetorno';
import Carregando from '../components/Carregando';
import { obterUsuario, removerToken } from '../utils/armazenamentoToken';
import { buscarOpcoesFormulario, listarOrigens } from '../services/contatoService';
import { listarEventos } from '../services/eventoService';
import {
  alterarStatusCampanha,
  atualizarLimite,
  atualizarTemplate,
  configurarEnvioTemplate,
  criarCampanha,
  criarLoteCampanha,
  criarTemplate,
  enviarTentativa,
  listarCampanhas,
  listarContatosLote,
  listarFalhasCampanha,
  listarLotesCampanha,
  listarTemplates,
  obterCapacidade,
  prepararImagemEnvioTemplate,
  prepararImagemTemplate,
  reprocessarTentativa,
  sincronizarLimiteMeta,
  sincronizarTemplatesMeta,
  submeterTemplateMeta,
  visualizarPreviaFiltros,
  visualizarPublicoCampanha
} from '../services/campanhaService';

const CAMPANHA_INICIAL={nome:'',modeloId:'',bairro:'',problema:'',origem:'',idadeMinima:'',idadeMaxima:'',eventoId:'',autorizacaoMensagens:'',cadastroIncompleto:false};
const TEMPLATE_INICIAL={nome:'',categoria:'Geral',conteudo:'',ativo:true,metaNome:'',metaIdioma:'pt_BR',metaCategoria:'MARKETING',cabecalhoTipo:'nenhum',cabecalhoTexto:'',cabecalhoExemplo:'',cabecalhoOrigem:'nome_contato',cabecalhoValor:'',imagemHandle:'',imagemArquivo:null,imagemModo:'dispositivo',imagemEnvio:'',imagemEnvioArquivo:null,rodape:'',botaoTipo:'nenhum',botaoTexto:'',botaoUrl:'',botaoExemplo:'',botaoValorEnvio:'',botaoTelefone:'',botaoOptOut:false,parametrosCorpo:[]};

function quantidadeParametros(texto){const numeros=Array.from(String(texto||'').matchAll(/\{\{(\d+)\}\}/g),function(item){return Number(item[1]);});return numeros.length?Math.max.apply(null,numeros):0;}

function textoStatus(status){
  const textos={
    rascunho:'Rascunho',pronta:'Pronta para criar lotes',ativa:'Ativa',pausada:'Pausada',concluida:'Concluída',cancelada:'Cancelada',
    em_analise:'Enviado para análise',aprovado:'Aprovado pela Meta',rejeitado:'Rejeitado pela Meta',indisponivel:'Indisponível',pendente:'Pendente',enviando:'Enviando',enviada:'Enviada',
    entregue:'Entregue',lida:'Lida',falhou:'Falhou'
  };
  return textos[status]||String(status||'').replaceAll('_',' ');
}
function explicacaoStatusTemplate(status){
  const textos={rascunho:'Ainda não foi enviado para análise.',em_analise:'A Meta ainda está avaliando este modelo.',aprovado:'Pode ser usado em campanhas quando estiver disponível no ACORDA RJ.',rejeitado:'A Meta não aprovou este modelo. Revise as orientações antes de criar outro.',indisponivel:'Este modelo não está disponível na conta oficial conectada.'};
  return textos[status]||'';
}
function telefoneMascarado(valor){return String(valor||'Nao informado').replaceAll('*','•');}
function formatarQuantidade(valor){return Number(valor||0).toLocaleString('pt-BR');}
function rotuloContatos(quantidade){return Number(quantidade)===1?'contato':'contatos';}
function formatarTierMeta(valor){
  if(!valor)return 'Não informado';
  const faixas={TIER_50:'Faixa de 50',TIER_250:'Faixa de 250',TIER_1K:'Faixa de 1.000',TIER_2K:'Faixa de 2.000',TIER_10K:'Faixa de 10.000',TIER_100K:'Faixa de 100.000',TIER_UNLIMITED:'Sem limite definido'};
  if(faixas[valor])return faixas[valor];
  const quantidade=String(valor).replace('TIER_','');
  return /^\d+$/.test(quantidade)?'Faixa de '+Number(quantidade).toLocaleString('pt-BR'):textoStatus(valor);
}
function textoPreviaPublico(previa){
  const aptos=Number(previa.publicoApto||0);
  const exibidos=Array.isArray(previa.contatos)?previa.contatos.length:0;
  if(aptos===0)return 'Nenhum contato pode participar desta campanha com os filtros atuais.';
  if(exibidos>=aptos)return 'Exibindo todos os '+formatarQuantidade(aptos)+' '+rotuloContatos(aptos)+' aptos. Criar a campanha apenas salva esta seleção; nenhuma mensagem será enviada agora.';
  return 'Exibindo '+formatarQuantidade(exibidos)+' de '+formatarQuantidade(aptos)+' '+rotuloContatos(aptos)+' '+(aptos===1?'apto':'aptos')+'. Esta é apenas uma prévia. Ao criar o lote, o sistema considerará todos os contatos aptos, respeitando a capacidade disponível para envio.';
}

function ListaContatosCampanha({contatos,vazia,aoEnviar,podeEnviar}){
  if(!contatos||contatos.length===0)return <div className="estado-vazio-campanha"><strong>{vazia||'Nenhum contato disponível.'}</strong></div>;
  return <div className="lista-contatos-campanha">{contatos.map(function(contato,indice){return <article className="contato-previa-campanha" key={contato.nome+'-'+contato.telefoneMascarado+'-'+indice}>
    <div><strong>{contato.nome}</strong><span>{telefoneMascarado(contato.telefoneMascarado)}</span></div>
    <dl><div><dt>Bairro</dt><dd>{contato.bairro}</dd></div><div><dt>Problema</dt><dd>{contato.problema}</dd></div>{contato.status&&<div><dt>Status</dt><dd>{textoStatus(contato.status)}</dd></div>}</dl>
    {aoEnviar&&<button className="botao botao-primario" type="button" disabled={!podeEnviar||contato.tentativaStatus!=='pendente'} onClick={function(){aoEnviar(contato);}}>Enviar mensagem agora</button>}
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
  const [origens,setOrigens]=useState([]);
  const [eventos,setEventos]=useState([]);
  const [formulario,setFormulario]=useState(CAMPANHA_INICIAL);
  const [previaCriacao,setPreviaCriacao]=useState(null);
  const [mostrarCriacao,setMostrarCriacao]=useState(false);
  const [template,setTemplate]=useState(TEMPLATE_INICIAL);
  const [templateEdicao,setTemplateEdicao]=useState(null);
  const [templateOficialEdicao,setTemplateOficialEdicao]=useState(false);
  const [selecionada,setSelecionada]=useState(null);
  const [publico,setPublico]=useState(null);
  const [lotes,setLotes]=useState([]);
  const [falhas,setFalhas]=useState([]);
  const [tamanho,setTamanho]=useState(250);
  const [loteAberto,setLoteAberto]=useState(null);
  const [contatosLote,setContatosLote]=useState([]);
  const [carregandoLote,setCarregandoLote]=useState(false);
  const [criandoLote,setCriandoLote]=useState(false);
  const [salvandoCampanha,setSalvandoCampanha]=useState(false);
  const [salvandoTemplate,setSalvandoTemplate]=useState(false);
  const [mensagem,setMensagem]=useState('');
  const [carregando,setCarregando]=useState(true);

  async function carregar(){
    setCarregando(true);
    try{
      const resultados=await Promise.allSettled([listarCampanhas(),listarTemplates(),obterCapacidade(),buscarOpcoesFormulario(),listarEventos(),listarOrigens()]);
      const falhaAutenticacao=resultados.find(function(resultado){return resultado.status==='rejected'&&resultado.reason.statusHttp===401;});
      if(falhaAutenticacao){removerToken();navegacao('/login',{replace:true});return [];}

      let campanhasAtuais=campanhas;
      if(resultados[0].status==='fulfilled'){
        campanhasAtuais=resultados[0].value.campanhas||[];
        setCampanhas(campanhasAtuais);
      }
      if(resultados[1].status==='fulfilled')setTemplates(resultados[1].value.templates||[]);
      if(resultados[2].status==='fulfilled')setCapacidade(resultados[2].value.capacidade);
      if(resultados[3].status==='fulfilled'){
        setBairros(resultados[3].value.bairros||[]);
        setProblemas(resultados[3].value.categoriasProblema||[]);
      }
      if(resultados[4].status==='fulfilled')setEventos(resultados[4].value.eventos||[]);
      if(resultados[5].status==='fulfilled')setOrigens(resultados[5].value.origens||[]);

      const falhaCampanhas=resultados[0].status==='rejected';
      const falhaTemplates=resultados[1].status==='rejected';
      const falhaAuxiliar=resultados.slice(2).some(function(resultado){return resultado.status==='rejected';});
      if(falhaCampanhas)setMensagem('Não foi possível carregar as campanhas. Atualize a página para tentar novamente.');
      else if(falhaTemplates)setMensagem('Não foi possível carregar os templates. Atualize a página antes de criar uma campanha.');
      else if(falhaAuxiliar)setMensagem('Algumas opções auxiliares não puderam ser carregadas. Atualize a página para tentar novamente.');
      return campanhasAtuais;
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
    if(formulario.origem)filtros.origem=formulario.origem;
    if(formulario.idadeMinima)filtros.idadeMinima=formulario.idadeMinima;
    if(formulario.idadeMaxima)filtros.idadeMaxima=formulario.idadeMaxima;
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
  function limparFiltrosCriacao(){
    setFormulario(Object.assign({},formulario,{bairro:'',problema:'',origem:'',idadeMinima:'',idadeMaxima:'',eventoId:'',autorizacaoMensagens:'',cadastroIncompleto:false}));
    setPreviaCriacao(null);
    setMensagem('Filtros removidos. A próxima prévia considerará todos os contatos aptos.');
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
    if(salvandoCampanha)return;
    if(!previaCriacao){setMensagem('Veja a prévia do público antes de criar a campanha.');return;}
    setSalvandoCampanha(true);
    try{
      const resposta=await criarCampanha({
        nome:formulario.nome,
        finalidade:'Campanha criada pelo painel administrativo.',
        modeloId:formulario.modeloId,
        filtros:montarFiltros()
      });
      setMensagem(resposta.mensagem);
      setCampanhas(function(atuais){return [resposta.campanha].concat(atuais.filter(function(item){return item.id!==resposta.campanha.id;}));});
      setFormulario(CAMPANHA_INICIAL);
      setPreviaCriacao(null);
      setMostrarCriacao(false);
      await abrirCampanha(resposta.campanha,250);
    }catch(erro){setMensagem(erro.message);}finally{setSalvandoCampanha(false);}
  }

  async function salvarTemplate(evento){
    evento.preventDefault();
    if(salvandoTemplate)return;
    setSalvandoTemplate(true);
    try{
      const componentes=[];
      const configuracaoEnvio={corpo:[],botoes:[]};
      let imagemHandle=template.imagemHandle;
      if(template.cabecalhoTipo==='imagem'&&!templateOficialEdicao&&template.imagemArquivo){
        setMensagem('Preparando a imagem de exemplo na Meta...');
        const respostaImagem=await prepararImagemTemplate(template.imagemArquivo);
        imagemHandle=respostaImagem.imagem.handle;
      }
      if(template.cabecalhoTipo==='texto'){
        componentes.push({type:'HEADER',format:'TEXT',text:template.cabecalhoTexto,exemplos:template.cabecalhoExemplo?[template.cabecalhoExemplo]:[]});
        if(quantidadeParametros(template.cabecalhoTexto))configuracaoEnvio.cabecalho={tipo:'texto',parametros:[{origem:template.cabecalhoOrigem,valor:template.cabecalhoOrigem==='fixo'?template.cabecalhoValor:undefined}]};
      }
      if(template.cabecalhoTipo==='imagem'){
        if(!templateOficialEdicao){
          if(!imagemHandle)throw new Error('Selecione a imagem de exemplo usada na analise da Meta.');
          componentes.push({type:'HEADER',format:'IMAGE',handleExemplo:imagemHandle});
        }
        let imagemEnvio=template.imagemEnvio;
        if(template.imagemModo==='dispositivo'&&template.imagemEnvioArquivo){
          setMensagem('Preparando a imagem que será usada nas mensagens...');
          const respostaImagemEnvio=await prepararImagemEnvioTemplate(template.imagemEnvioArquivo);
          imagemEnvio=respostaImagemEnvio.imagem.id;
        }
        if(!imagemEnvio)throw new Error(template.imagemModo==='dispositivo'?'Escolha a imagem que será usada nas mensagens.':'Informe a URL pública da imagem usada nas mensagens.');
        configuracaoEnvio.cabecalho={tipo:'imagem',origem:template.imagemModo==='dispositivo'?'id':'link',valor:imagemEnvio};
      }
      componentes.push({type:'BODY',text:template.conteudo,exemplos:template.parametrosCorpo.map(function(item){return item.exemplo;})});
      configuracaoEnvio.corpo=template.parametrosCorpo.map(function(item){return {origem:item.origem,valor:item.origem==='fixo'?item.valor:undefined};});
      if(template.rodape)componentes.push({type:'FOOTER',text:template.rodape});
      if(template.botaoTipo==='optout'){componentes.push({type:'BUTTONS',buttons:[{type:'QUICK_REPLY',text:template.botaoTexto||'Não quero mais receber'}]});configuracaoEnvio.botoes.push({indice:0,subtipo:'quick_reply',origem:'opt_out'});}
      if(template.botaoTipo==='quick'&&template.botaoOptOut)configuracaoEnvio.botoes.push({indice:0,subtipo:'quick_reply',origem:'opt_out'});
      if(template.botaoTipo==='url'){
        componentes.push({type:'BUTTONS',buttons:[{type:'URL',text:template.botaoTexto,url:template.botaoUrl,exemplo:template.botaoExemplo}]});
        if(template.botaoUrl.includes('{{1}}'))configuracaoEnvio.botoes.push({indice:0,subtipo:'url',origem:'fixo',valor:template.botaoValorEnvio});
      }
      if(template.botaoTipo==='telefone')componentes.push({type:'BUTTONS',buttons:[{type:'PHONE_NUMBER',text:template.botaoTexto,phone_number:template.botaoTelefone}]});
      const dados=Object.assign({},template,{componentes,configuracaoEnvio});
      const resposta=templateOficialEdicao?await configurarEnvioTemplate(templateEdicao,configuracaoEnvio):(templateEdicao?await atualizarTemplate(templateEdicao,dados):await criarTemplate(dados));
      setMensagem(resposta.mensagem);
      setTemplate(TEMPLATE_INICIAL);
      setTemplateEdicao(null);
      setTemplateOficialEdicao(false);
      await carregar();
    }catch(erro){setMensagem(erro.message);}finally{setSalvandoTemplate(false);}
  }
  function editarTemplate(item){
    const componentes=item.meta_componentes||[];
    const cabecalho=componentes.find(function(componente){return componente.type==='HEADER';});
    const rodape=componentes.find(function(componente){return componente.type==='FOOTER';});
    const botoes=componentes.find(function(componente){return componente.type==='BUTTONS';});
    const envio=item.meta_configuracao_envio||{};
    setTemplateEdicao(item.id);
    setTemplateOficialEdicao(Boolean(item.meta_template_id));
    const body=componentes.find(function(componente){return componente.type==='BODY';});
    const exemplos=body&&body.example&&body.example.body_text&&body.example.body_text[0]||[];
    const quantidade=quantidadeParametros(item.texto);
    const parametros=Array.from({length:quantidade},function(_,indice){const parametro=(envio.corpo||[])[indice]||{};return {origem:parametro.origem||(indice===0?'nome_contato':'fixo'),valor:parametro.valor||'',exemplo:exemplos[indice]||''};});
    const primeiroBotao=botoes&&botoes.buttons&&botoes.buttons[0];
    const configuracaoBotao=(envio.botoes||[]).find(function(botao){return botao.indice===0;})||{};
    const botaoTipo=!primeiroBotao?'nenhum':(primeiroBotao.type==='QUICK_REPLY'?'quick':(primeiroBotao.type==='URL'?'url':'telefone'));
    const configuracaoCabecalho=envio.cabecalho&&Array.isArray(envio.cabecalho.parametros)&&envio.cabecalho.parametros[0]||{};
    setTemplate({nome:item.nome,categoria:item.categoria,conteudo:item.texto,ativo:item.ativo,metaNome:item.meta_nome||'',metaIdioma:item.meta_idioma||'pt_BR',metaCategoria:item.meta_categoria||'MARKETING',cabecalhoTipo:cabecalho?(cabecalho.format==='IMAGE'?'imagem':'texto'):'nenhum',cabecalhoTexto:cabecalho&&cabecalho.text||'',cabecalhoExemplo:cabecalho&&cabecalho.example&&cabecalho.example.header_text&&cabecalho.example.header_text[0]||'',cabecalhoOrigem:configuracaoCabecalho.origem||'nome_contato',cabecalhoValor:configuracaoCabecalho.valor||'',imagemHandle:cabecalho&&cabecalho.example&&cabecalho.example.header_handle&&cabecalho.example.header_handle[0]||'',imagemArquivo:null,imagemModo:envio.cabecalho&&envio.cabecalho.origem==='link'?'internet':'dispositivo',imagemEnvio:envio.cabecalho&&envio.cabecalho.valor||'',imagemEnvioArquivo:null,rodape:rodape&&rodape.text||'',botaoTipo,botaoTexto:primeiroBotao&&primeiroBotao.text||'',botaoUrl:primeiroBotao&&primeiroBotao.url||'',botaoExemplo:primeiroBotao&&primeiroBotao.example&&primeiroBotao.example[0]||'',botaoValorEnvio:configuracaoBotao.valor||'',botaoTelefone:primeiroBotao&&primeiroBotao.phone_number||'',botaoOptOut:configuracaoBotao.origem==='opt_out',parametrosCorpo:parametros});
  }
  function alterarTextoTemplate(evento){const conteudo=evento.target.value;const quantidade=quantidadeParametros(conteudo);const parametros=Array.from({length:quantidade},function(_,indice){return template.parametrosCorpo[indice]||{origem:indice===0?'nome_contato':'fixo',valor:'',exemplo:''};});setTemplate(Object.assign({},template,{conteudo,parametrosCorpo:parametros}));}
  function alterarParametroCorpo(indice,campo,valor){setTemplate(Object.assign({},template,{parametrosCorpo:template.parametrosCorpo.map(function(item,posicao){return posicao===indice?Object.assign({},item,{[campo]:valor}):item;})}));}
  async function sincronizarTemplates(){try{const resposta=await sincronizarTemplatesMeta();setMensagem(resposta.mensagem+' '+resposta.resumo.total+' template(s) recebido(s).');await carregar();}catch(erro){setMensagem(erro.message);}}
  async function submeterTemplate(item){if(!window.confirm('Enviar este template para análise da Meta? Isso não envia mensagens aos contatos.'))return;try{const resposta=await submeterTemplateMeta(item.id);setMensagem(resposta.mensagem);await carregar();}catch(erro){setMensagem(erro.message);}}

  async function enviarContato(contato){
    if(!window.confirm('Enviar esta mensagem agora pelo WhatsApp? Esta ação envia de verdade para o contato selecionado.'))return;
    try{
      const resposta=await enviarTentativa(contato.tentativaId);
      setMensagem(resposta.mensagem);
      const loteAtual=loteAberto;
      await abrirCampanha(selecionada,tamanho);
      await abrirLote(loteAtual);
    }catch(erro){setMensagem(erro.message);}
  }

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
    if(!window.confirm('Tentar enviar novamente a mensagem que falhou? O envio anterior continuará registrado no histórico.'))return;
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
      setMensagem(resposta.mensagem+' Foram separados '+resposta.resultado.lote.tamanho_efetivo+' contatos para este lote. Nenhuma mensagem foi enviada ainda.');
      const atualizadas=await carregar();
      const item=atualizadas.find(function(campanha){return campanha.id===selecionada.id;})||selecionada;
      await abrirCampanha(item,tamanho);
    }catch(erro){setMensagem(erro.message);}
    finally{setCriandoLote(false);}
  }

  async function salvarLimite(){
    if(!capacidade)return;
    const valor=window.prompt('Novo limite de segurança para 24 horas:',String(capacidade.limiteInterno));
    if(!valor)return;
    const motivo=window.prompt('Informe o motivo da alteração:');
    if(!motivo)return;
    try{const resposta=await atualizarLimite(Number(valor),motivo);setCapacidade(resposta.capacidade);setMensagem(resposta.mensagem);}
    catch(erro){setMensagem(erro.message);}
  }

  async function sincronizarMeta(){
    try{
      const resposta=await sincronizarLimiteMeta();
      setCapacidade(resposta.capacidade);
      setMensagem(resposta.mensagem);
    }catch(erro){setMensagem(erro.message);}
  }

  const capacidadeInsuficiente=Boolean(publico&&Number(tamanho)>Number(publico.capacidade&&publico.capacidade.disponivel||0));
  const podeCriarLote=Boolean(selecionada&&['pronta','ativa'].includes(selecionada.status)&&publico&&publico.quantidadeEfetiva>0&&!capacidadeInsuficiente&&!criandoLote);
  const restantes=publico?Number(publico.restantes||0):0;
  const aptosPrevia=previaCriacao?Number(previaCriacao.publicoApto||0):0;
  const capacidadeDisponivel=capacidade?Number(capacidade.disponivel||0):null;
  const previaUltrapassaCapacidade=capacidadeDisponivel!==null&&aptosPrevia>capacidadeDisponivel;

  return <main className="pagina-administrativa"><div className="conteudo-administrativo campanhas-pagina">
    <CabecalhoAdministrativo aoSair={sair} titulo="Campanhas" subtitulo="Crie campanhas, confira o público e organize os próximos lotes."/>
    {mensagem&&<MensagemRetorno mensagem={mensagem} tipo="informacao"/>}

    <section className="resumo-capacidade-campanha" aria-labelledby="titulo-capacidade-campanha">
      <div className="cabecalho-capacidade-campanha">
        <div className="capacidade-restante-campanha">
          <span id="titulo-capacidade-campanha">Capacidade restante</span>
          <strong>{capacidade?Number(capacidade.disponivel).toLocaleString('pt-BR'):'—'} <small>disponíveis de {capacidade?Number(capacidade.limite).toLocaleString('pt-BR'):'—'}</small></strong>
        </div>
        <span className="status-sincronizacao-capacidade"><span className="indicador-sincronizacao-capacidade" aria-hidden="true"/>Sincronização automática ativa</span>
      </div>
      <dl className="metricas-capacidade-campanha">
        <div><dt>Limite oficial Meta</dt><dd>{capacidade?(!capacidade.tierMeta?'Não sincronizado':capacidade.limiteMeta===null?'Ilimitado':Number(capacidade.limiteMeta).toLocaleString('pt-BR')):'—'}</dd><small>Concedido pela Meta</small></div>
        <div><dt>Limite de segurança</dt><dd>{capacidade?Number(capacidade.limiteInterno).toLocaleString('pt-BR'):'—'}</dd><small>Definido no sistema</small></div>
        <div><dt>Utilizado nas últimas 24h</dt><dd>{capacidade?Number(capacidade.utilizado).toLocaleString('pt-BR'):'—'}</dd></div>
        <div><dt>Faixa da conta na Meta</dt><dd>{capacidade?formatarTierMeta(capacidade.tierMeta):'—'}</dd></div>
        <div><dt>Última atualização</dt><dd>{capacidade&&capacidade.sincronizadoEm?new Date(capacidade.sincronizadoEm).toLocaleString('pt-BR'):'—'}</dd></div>
      </dl>
      {!capacidade||!capacidade.tierMeta?<p className="aviso-capacidade-campanha">O limite oficial da Meta ainda não está disponível. O sistema continua respeitando o limite de segurança configurado.</p>:<p className="ajuda-capacidade-campanha">O sistema sempre respeita o menor valor entre o limite concedido pela Meta e o limite de segurança.</p>}
      {administrador&&<div className="acoes-capacidade-campanha"><span>“Sincronizar agora” apenas confere o limite oficial; não altera o limite de segurança.</span><button className="botao botao-secundario" type="button" onClick={sincronizarMeta}>Sincronizar agora</button><button className="botao botao-secundario" type="button" onClick={salvarLimite}>Ajustar limite de segurança</button></div>}
    </section>

    <section className="cartao campanhas-listagem">
      <div className="cabecalho-resultados"><div><span className="etiqueta-pagina">1. Escolha</span><h2>Campanhas</h2><p>Abra uma campanha para acompanhar o público, os grupos de envio e os resultados.</p></div>{administrador&&<button className="botao botao-primario" type="button" onClick={function(){setMostrarCriacao(!mostrarCriacao);setSelecionada(null);}}>{mostrarCriacao?'Fechar criação':'Nova campanha'}</button>}</div>
      {carregando?<Carregando mensagem="Carregando campanhas..."/>:campanhas.length===0?<div className="estado-vazio-campanha"><strong>Nenhuma campanha cadastrada.</strong><span>Crie a primeira campanha para começar.</span></div>:<div className="grade-campanhas">{campanhas.map(function(item){return <article className={'cartao-campanha-resumo '+(selecionada&&selecionada.id===item.id?'ativo':'')} key={item.id}>
        <div><span className={'status-campanha status-'+item.status}>{textoStatus(item.status)}</span><h3>{item.nome}</h3><p>Mensagem: {item.modelo_nome||'Não informada'} · Aprovação: {item.modelo_meta_status_oficial==='APPROVED'?'Aprovado pela Meta':textoStatus(item.modelo_meta_status||'rascunho')}</p></div>
        <div className="rodape-cartao-campanha"><span>{formatarQuantidade(item.quantidade_lotes||0)} {Number(item.quantidade_lotes||0)===1?'lote':'lotes'}</span><button className="botao botao-secundario" type="button" onClick={function(){abrirCampanha(item,250);}}>Abrir campanha</button></div>
      </article>;})}</div>}
    </section>

    {mostrarCriacao&&administrador&&<section className="cartao campanha-criacao">
      <div className="cabecalho-secao"><div><span className="etiqueta-pagina">2. Configure</span><h2>Nova campanha</h2><p>Informe o nome, escolha a mensagem e defina quais contatos deseja encontrar.</p></div></div>
      <form onSubmit={salvarCampanha}>
        <fieldset className="grade-criacao-campanha">
          <label>Nome da campanha<input className="campo-input" name="nome" value={formulario.nome} onChange={alterar} required/></label>
          <label>Mensagem que será usada<select className="campo-input" name="modeloId" value={formulario.modeloId} onChange={alterar} required><option value="">Selecione uma mensagem</option>{templates.filter(function(item){return item.ativo;}).map(function(item){return <option key={item.id} value={item.id}>{item.nome}</option>;})}</select></label>
          <label>Bairro<select className="campo-input" name="bairro" value={formulario.bairro} onChange={alterar}><option value="">Todos</option><option value="nao_informado">Não informado</option>{bairros.map(function(item){return <option key={item} value={item}>{item}</option>;})}</select></label>
          <label>Problema<select className="campo-input" name="problema" value={formulario.problema} onChange={alterar}><option value="">Todos</option><option value="nao_informado">Não informado</option>{problemas.map(function(item){return <option key={item} value={item}>{item}</option>;})}</select></label>
          <label>Origem<select className="campo-input" name="origem" value={formulario.origem} onChange={alterar}><option value="">Todas</option><option value="nao_informado">Não informado</option>{origens.map(function(item){return <option key={item.id} value={item.nome}>{item.nome}</option>;})}</select></label>
          <label>Idade mínima<input className="campo-input" type="number" min="16" max="120" name="idadeMinima" value={formulario.idadeMinima} onChange={alterar}/></label>
          <label>Idade máxima<input className="campo-input" type="number" min="16" max="120" name="idadeMaxima" value={formulario.idadeMaxima} onChange={alterar}/></label>
          <label>Evento<select className="campo-input" name="eventoId" value={formulario.eventoId} onChange={alterar}><option value="">Todos</option><option value="sem_evento">Sem evento</option>{eventos.map(function(item){return <option key={item.id} value={item.id}>{item.nome}</option>;})}</select></label>
          <label>Autorização para mensagens<select className="campo-input" name="autorizacaoMensagens" value={formulario.autorizacaoMensagens} onChange={alterar}><option value="">Todas as situações</option><option value="nao_informado">Não informado</option><option value="autorizado">Autorizado</option><option value="recusado">Recusado</option><option value="revogado">Revogado</option></select></label>
          <label className="opcao-cadastro-incompleto"><input type="checkbox" name="cadastroIncompleto" checked={formulario.cadastroIncompleto} onChange={alterar}/> Somente cadastros incompletos</label>
        </fieldset>
        <p className="aviso-combinacao-filtros">Os filtros funcionam juntos: o contato precisa corresponder a todas as opções selecionadas. A prévia não envia mensagens.</p>
        <div className="acoes-fluxo-campanha"><button className="botao botao-secundario" type="button" onClick={limparFiltrosCriacao} disabled={salvandoCampanha}>Limpar filtros</button><button className="botao botao-secundario" type="button" onClick={verPreviaCriacao} disabled={salvandoCampanha}>Ver prévia do público</button>{previaCriacao&&<button className="botao botao-primario" type="submit" disabled={salvandoCampanha}>{salvandoCampanha?'Criando campanha...':'Criar campanha'}</button>}</div>
      </form>
      {previaCriacao&&<div className="bloco-previa-campanha"><div className="metricas-previa-campanha"><article><span>Encontrados</span><strong>{formatarQuantidade(previaCriacao.publicoEncontrado)}</strong><small>Correspondem aos filtros escolhidos.</small></article><article><span>Aptos para a campanha</span><strong>{formatarQuantidade(previaCriacao.publicoApto)}</strong><small>Podem participar desta campanha.</small></article><article><span>Não aptos</span><strong>{formatarQuantidade(previaCriacao.publicoNaoApto)}</strong><small>Foram encontrados, mas estão impedidos.</small></article></div>{Number(previaCriacao.publicoEncontrado)>0&&Number(previaCriacao.publicoApto)===0&&<p className="aviso-estado-campanha">Os filtros encontraram contatos, mas nenhum pode participar desta campanha. Revise os filtros ou as condições desses cadastros.</p>}{previaUltrapassaCapacidade&&<p className="aviso-capacidade-publico"><strong>{formatarQuantidade(aptosPrevia)} contatos estão aptos, mas a capacidade restante permite até {formatarQuantidade(capacidadeDisponivel)} neste momento.</strong><span>A campanha pode ser criada normalmente. Depois, escolha um lote dentro da capacidade disponível.</span></p>}<div className="cabecalho-lista-previa"><div><h3>Contatos da prévia</h3><p>Os telefones estão protegidos e mostram somente os últimos dígitos.</p></div><span>{formatarQuantidade(previaCriacao.contatos.length)} exibidos</span></div><ListaContatosCampanha contatos={previaCriacao.contatos} vazia={Number(previaCriacao.publicoEncontrado)===0?'Nenhum contato corresponde aos filtros escolhidos. Revise os filtros e gere uma nova prévia.':'Nenhum contato pode participar desta campanha com os filtros atuais.'}/><p className="aviso-lista-limitada">{textoPreviaPublico(previaCriacao)}</p><p className="ajuda-criar-campanha">Criar a campanha salva o público e as configurações. Nenhuma mensagem será enviada até que um lote seja criado e o envio seja iniciado.</p></div>}
    </section>}

    {selecionada&&<section className="cartao campanha-detalhes">
      <div className="cabecalho-campanha-aberta"><div><span className="etiqueta-pagina">Campanha aberta</span><h2>{selecionada.nome}</h2><div className="linha-informacoes-campanha"><span className={'status-campanha status-'+selecionada.status}>{textoStatus(selecionada.status)}</span><span>Mensagem: {selecionada.modelo_nome||'Não informada'}</span><span>Aprovação na Meta: {selecionada.modelo_meta_status_oficial==='APPROVED'?'Aprovado pela Meta':textoStatus(selecionada.modelo_meta_status||'rascunho')}</span></div>{!selecionada.modelo_nome?<p className="aviso-estado-campanha">Esta campanha não possui uma mensagem associada e não pode realizar envios.</p>:selecionada.modelo_meta_status_oficial!=='APPROVED'&&<p className="aviso-estado-campanha">A mensagem ainda não está oficialmente aprovada pela Meta. É possível conferir o público, mas o envio permanece bloqueado.</p>}</div><button className="botao botao-secundario" type="button" onClick={function(){setSelecionada(null);setPublico(null);}}>Fechar campanha</button></div>

      <div className="metricas-campanha"><article title="Contatos que podem participar da campanha"><span>Aptos</span><strong>{publico?formatarQuantidade(publico.publicoApto):0}</strong></article><article title="Contatos já separados em lotes para envio"><span>Separados em lotes</span><strong>{formatarQuantidade(selecionada.reservado||0)}</strong></article><article><span>Enviados</span><strong>{formatarQuantidade(selecionada.enviado||0)}</strong></article><article><span>Entregues</span><strong>{formatarQuantidade(selecionada.entregue||0)}</strong></article><article><span>Lidos</span><strong>{formatarQuantidade(selecionada.lido||0)}</strong></article><article><span>Falhas</span><strong>{formatarQuantidade(selecionada.falhou||0)}</strong></article><article title="Contatos aptos que ainda não entraram em um lote"><span>Ainda disponíveis</span><strong>{formatarQuantidade(restantes)}</strong></article></div>

      <div className="acoes-status-campanha">{selecionada.status==='rascunho'&&administrador&&<button className="botao botao-primario" type="button" onClick={function(){mudarStatus('pronta');}}>Liberar criação de lotes</button>}{selecionada.status==='ativa'&&administrador&&<button className="botao botao-secundario" type="button" onClick={function(){mudarStatus('pausada');}}>Pausar</button>}{selecionada.status==='pausada'&&administrador&&<button className="botao botao-primario" type="button" onClick={function(){mudarStatus('ativa');}}>Retomar</button>}{['ativa','pausada'].includes(selecionada.status)&&administrador&&<button className="botao botao-secundario" type="button" onClick={function(){mudarStatus('concluida');}}>Concluir</button>}{['rascunho','pronta','ativa','pausada'].includes(selecionada.status)&&administrador&&<button className="botao botao-perigo" type="button" onClick={function(){mudarStatus('cancelada');}}>Cancelar campanha</button>}</div>

      {['rascunho','pronta','ativa'].includes(selecionada.status)&&<div className="bloco-proximo-lote">
        <div className="cabecalho-secao"><div><span className="etiqueta-pagina">Próximo lote</span><h3>Escolha o próximo grupo para envio</h3><p>Um lote é o grupo de contatos que será separado para os próximos envios. Criar o lote ainda não envia mensagens.</p></div></div>
        <div className="controle-tamanho-lote"><label>Quantidade de contatos no próximo lote<input className="campo-input" type="number" min="1" max="10000" value={tamanho} onChange={function(evento){setTamanho(evento.target.value);}}/></label><button className="botao botao-secundario" type="button" onClick={atualizarPreviaLote}>Conferir esta quantidade</button></div>
        {publico&&<>
          <div className={'resumo-proximo-lote '+(capacidadeInsuficiente?'resumo-proximo-lote-bloqueado':'')}>
            <strong>{formatarQuantidade(publico.quantidadeEfetiva)} {rotuloContatos(publico.quantidadeEfetiva)} {Number(publico.quantidadeEfetiva)===1?'será separado':'serão separados'} neste lote</strong>
            {Number(publico.capacidade&&publico.capacidade.disponivel||0)===0?<span>A capacidade está esgotada neste momento. Aguarde a liberação da janela de 24 horas ou ajuste o limite de segurança, se for apropriado.</span>:publico.quantidadeEfetiva<Number(tamanho)&&!capacidadeInsuficiente?<span>Existem apenas {formatarQuantidade(publico.quantidadeEfetiva)} contatos disponíveis para este lote. O sistema usará essa quantidade menor.</span>:null}
            {capacidadeInsuficiente&&Number(publico.capacidade&&publico.capacidade.disponivel||0)>0&&<span>Você pediu {formatarQuantidade(tamanho)}, mas a capacidade restante permite até {formatarQuantidade(publico.capacidade.disponivel)}. Reduza a quantidade para continuar.</span>}
          </div>
          <ListaContatosCampanha contatos={publico.contatos} vazia="Nenhum contato pode entrar no próximo lote. Eles podem já estar em outro lote desta campanha ou estar impedidos pelas regras atuais."/>
          {publico.listaLimitada&&<p className="aviso-lista-limitada">Exibindo {formatarQuantidade(publico.contatos.length)} dos {formatarQuantidade(publico.quantidadeEfetiva)} contatos que entrarão neste lote.</p>}
          <div className="acoes-fluxo-campanha"><button className="botao botao-primario botao-criar-lote" type="button" disabled={!podeCriarLote} onClick={criarLote}>{criandoLote?'Criando lote...':'Criar lote para envio com '+formatarQuantidade(publico.quantidadeEfetiva)+' '+rotuloContatos(publico.quantidadeEfetiva)}</button></div>
        </>}
      </div>}

      <div className="secao-lotes-campanha"><div className="cabecalho-secao"><div><span className="etiqueta-pagina">Acompanhamento</span><h3>Grupos preparados para envio</h3><p>Cada lote reúne contatos separados para acompanhar e enviar as mensagens.</p></div></div>{lotes.length===0?<div className="estado-vazio-campanha"><strong>Nenhum lote criado.</strong><span>Confira a quantidade acima para criar o primeiro grupo de envio.</span></div>:<div className="grade-lotes-campanha">{lotes.map(function(lote){return <article className="cartao-lote-campanha" key={lote.id}><div><span>Lote {lote.ordem}</span><strong>{formatarQuantidade(lote.tamanho_efetivo)} {rotuloContatos(lote.tamanho_efetivo)}</strong></div><dl><div><dt>Status</dt><dd>{textoStatus(lote.status)}</dd></div><div><dt>Criado em</dt><dd>{new Date(lote.criado_em).toLocaleString('pt-BR')}</dd></div></dl><button className="botao botao-secundario" type="button" onClick={function(){abrirLote(lote);}}>Ver contatos deste lote</button></article>;})}</div>}</div>

      {falhas.length>0&&<details className="secao-secundaria-campanha"><summary>Mensagens que falharam e podem ser enviadas novamente ({falhas.length})</summary><div className="lista-falhas-campanha">{falhas.map(function(item){return <article key={item.id}><div><strong>{item.contato_nome||'Não informado'}</strong><span>Lote {item.lote_ordem} · Envio nº {item.numero_tentativa}</span><small>{item.codigo_erro_externo||'Sem código'} — {item.titulo_erro||'Falha'}</small></div><button className="botao botao-secundario" type="button" onClick={function(){reprocessar(item);}}>Tentar enviar novamente</button></article>;})}</div></details>}
    </section>}

    {administrador&&<details className="cartao secao-secundaria-campanha gerenciar-templates-campanha"><summary>Gerenciar modelos de mensagem</summary><div className="conteudo-templates-campanha">
      <div className="cabecalho-gerenciamento-templates"><div><h3>Modelos de mensagem</h3><p>Crie a mensagem que será avaliada pela Meta ou atualize a lista com os modelos da conta oficial.</p><Link className="link-ajuda-contextual" to="/admin/ajuda#templates">Precisa de ajuda? Veja o passo a passo</Link></div><button className="botao botao-secundario" type="button" onClick={sincronizarTemplates}>Atualizar modelos da Meta</button></div>
      <form onSubmit={salvarTemplate}><fieldset className="grade-criacao-campanha">
        <label>Nome do modelo<input className="campo-input" value={template.nome} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{nome:evento.target.value}));}} required/><small>Nome usado pela equipe para localizar esta mensagem.</small></label>
        <label>Grupo para organização<input className="campo-input" value={template.categoria} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{categoria:evento.target.value}));}} required/></label>
        <label>Nome usado na Meta<input className="campo-input" value={template.metaNome} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{metaNome:evento.target.value.toLowerCase().replace(/\s+/g,'_')}));}} placeholder="exemplo_campanha" required/><small>É gerado em letras minúsculas e sem espaços, conforme a regra da Meta.</small></label>
        <label>Idioma<select className="campo-input" value={template.metaIdioma} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{metaIdioma:evento.target.value}));}}><option value="pt_BR">Português (Brasil)</option><option value="en_US">Inglês (EUA)</option></select></label>
        <label>Tipo de mensagem na Meta<select className="campo-input" value={template.metaCategoria} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{metaCategoria:evento.target.value}));}}><option value="MARKETING">Divulgação e campanhas</option><option value="UTILITY">Informação de serviço</option></select></label>
        <label>Cabeçalho<select className="campo-input" value={template.cabecalhoTipo} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{cabecalhoTipo:evento.target.value}));}}><option value="nenhum">Sem cabeçalho</option><option value="texto">Texto</option><option value="imagem">Imagem</option></select></label>
        {template.cabecalhoTipo==='texto'&&<><label>Texto do cabeçalho<input className="campo-input" value={template.cabecalhoTexto} onChange={function(evento){setTemplate(Object.assign({},template,{cabecalhoTexto:evento.target.value}));}} placeholder="Opcionalmente use {{1}} para uma informação personalizada" required/></label>{quantidadeParametros(template.cabecalhoTexto)>0&&<><label>Exemplo do valor no cabeçalho<input className="campo-input" value={template.cabecalhoExemplo} onChange={function(evento){setTemplate(Object.assign({},template,{cabecalhoExemplo:evento.target.value}));}} required/><small>Exemplo que a Meta usará ao analisar o modelo.</small></label><label>O que deve aparecer em {'{{1}}'}?<select className="campo-input" value={template.cabecalhoOrigem} onChange={function(evento){setTemplate(Object.assign({},template,{cabecalhoOrigem:evento.target.value}));}}><option value="nome_contato">Nome da pessoa</option><option value="bairro">Bairro</option><option value="problema">Principal necessidade</option><option value="fixo">Texto igual para todos</option></select></label>{template.cabecalhoOrigem==='fixo'&&<label>Texto do cabeçalho igual para todos<input className="campo-input" value={template.cabecalhoValor} onChange={function(evento){setTemplate(Object.assign({},template,{cabecalhoValor:evento.target.value}));}} required/></label>}</>}</>}
        {template.cabecalhoTipo==='imagem'&&<><label>Imagem de exemplo para aprovação<input className="campo-input campo-arquivo-template" type="file" accept="image/jpeg,image/png" disabled={templateOficialEdicao} required={!templateOficialEdicao&&!template.imagemHandle} onChange={function(evento){setTemplate(Object.assign({},template,{imagemArquivo:evento.target.files&&evento.target.files[0]||null}));}}/><small>{templateOficialEdicao?'A imagem de exemplo já pertence ao modelo enviado à Meta.':template.imagemArquivo?'Imagem selecionada e pronta para preparar ao salvar.':template.imagemHandle?'Imagem de exemplo já preparada. Selecione outra somente para substituir.':'Imagem que a Meta utilizará para analisar este modelo. Selecione JPG ou PNG de até 5 MB.'}</small></label><fieldset className="escolha-imagem-envio"><legend>Imagem usada nas mensagens</legend><p>Imagem que aparecerá para as pessoas quando esta campanha for enviada.</p><label><input type="radio" name="imagemModo" value="dispositivo" checked={template.imagemModo==='dispositivo'} onChange={function(){if(template.imagemModo!=='dispositivo')setTemplate(Object.assign({},template,{imagemModo:'dispositivo',imagemEnvio:'',imagemEnvioArquivo:null}));}}/> Escolher imagem do dispositivo</label><label><input type="radio" name="imagemModo" value="internet" checked={template.imagemModo==='internet'} onChange={function(){if(template.imagemModo!=='internet')setTemplate(Object.assign({},template,{imagemModo:'internet',imagemEnvio:'',imagemEnvioArquivo:null}));}}/> Usar imagem da internet</label>{template.imagemModo==='dispositivo'?<label>Escolher imagem<input className="campo-input campo-arquivo-template" type="file" accept="image/jpeg,image/png" required={!template.imagemEnvio} onChange={function(evento){setTemplate(Object.assign({},template,{imagemEnvioArquivo:evento.target.files&&evento.target.files[0]||null}));}}/><small>{template.imagemEnvio&&!template.imagemEnvioArquivo?'Já existe uma imagem preparada. Escolha outra apenas para substituir.':'Selecione um JPG ou PNG de até 5 MB no computador ou celular.'}</small></label>:<label>Endereço público da imagem<input className="campo-input" type="url" value={template.imagemEnvio} onChange={function(evento){setTemplate(Object.assign({},template,{imagemEnvio:evento.target.value}));}} placeholder="https://..." required/><small>Use esta opção se a imagem já estiver disponível em um site na internet.</small></label>}</fieldset></>}
        <label className="campo-template-conteudo">Texto principal<textarea className="campo-input" value={template.conteudo} disabled={templateOficialEdicao} onChange={alterarTextoTemplate} placeholder="Ex.: Olá, {{1}}! Temos um convite para você." required/><small>Valores como {'{{1}}'} e {'{{2}}'} são informações que mudam automaticamente em cada mensagem.</small></label>
        {template.parametrosCorpo.length>0&&<details className="ajuda-valores-personalizados"><summary>Como funcionam os valores personalizados?</summary><p>Exemplo: “Olá, {'{{1}}'}! Você está convidado para {'{{2}}'}.” Depois, escolha abaixo o que aparecerá em cada posição, como o nome da pessoa ou um texto fixo.</p></details>}
        {template.parametrosCorpo.length>0&&<h4 className="titulo-valores-personalizados">Valores personalizados desta mensagem</h4>}
        {template.parametrosCorpo.map(function(parametro,indice){return <div className="configuracao-parametro-template" key={'parametro-'+indice}><strong>{'{{'+(indice+1)+'}}'}</strong><label>Exemplo para a Meta<input className="campo-input" value={parametro.exemplo} onChange={function(evento){alterarParametroCorpo(indice,'exemplo',evento.target.value);}} required={!templateOficialEdicao}/><small>Use um exemplo parecido com o valor real que será enviado.</small></label><label>O que deve aparecer aqui?<select className="campo-input" value={parametro.origem} onChange={function(evento){alterarParametroCorpo(indice,'origem',evento.target.value);}}><option value="nome_contato">Nome da pessoa</option><option value="bairro">Bairro</option><option value="problema">Principal necessidade</option><option value="fixo">Texto igual para todos</option></select></label>{parametro.origem==='fixo'&&<label>Texto que será igual para todos<input className="campo-input" value={parametro.valor} onChange={function(evento){alterarParametroCorpo(indice,'valor',evento.target.value);}} required/></label>}</div>;})}
        <label className="campo-template-conteudo">Rodapé opcional<input className="campo-input" value={template.rodape} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{rodape:evento.target.value}));}}/></label>
        <label>Botão<select className="campo-input" value={template.botaoTipo} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{botaoTipo:evento.target.value}));}}><option value="nenhum">Sem botão</option><option value="optout">Resposta rápida de descadastro</option>{templateOficialEdicao&&<option value="quick">Resposta rápida existente</option>}<option value="url">Abrir URL</option><option value="telefone">Ligar</option></select></label>
        {template.botaoTipo!=='nenhum'&&<label>Texto do botão<input className="campo-input" value={template.botaoTexto} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{botaoTexto:evento.target.value}));}} required/></label>}
        {template.botaoTipo==='url'&&<><label>URL HTTPS<input className="campo-input" value={template.botaoUrl} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{botaoUrl:evento.target.value}));}} placeholder="https://exemplo.com/{{1}}" required/></label>{template.botaoUrl.includes('{{1}}')&&<><label>Exemplo da URL<input className="campo-input" value={template.botaoExemplo} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{botaoExemplo:evento.target.value}));}} required={!templateOficialEdicao}/></label><label>Valor usado no envio<input className="campo-input" value={template.botaoValorEnvio} onChange={function(evento){setTemplate(Object.assign({},template,{botaoValorEnvio:evento.target.value}));}} required/></label></>}</>}
        {template.botaoTipo==='telefone'&&<label>Telefone do botão<input className="campo-input" value={template.botaoTelefone} disabled={templateOficialEdicao} onChange={function(evento){setTemplate(Object.assign({},template,{botaoTelefone:evento.target.value}));}} required/></label>}
        {template.botaoTipo==='quick'&&<label className="opcao-cadastro-incompleto"><input type="checkbox" checked={template.botaoOptOut} onChange={function(evento){setTemplate(Object.assign({},template,{botaoOptOut:evento.target.checked}));}}/> Este botão é o descadastro “Não quero mais receber”</label>}
        <label className="opcao-cadastro-incompleto"><input type="checkbox" checked={template.ativo} onChange={function(evento){setTemplate(Object.assign({},template,{ativo:evento.target.checked}));}}/> Disponível para uso no ACORDA RJ</label>
      </fieldset><p className="aviso-estado-campanha">{templateOficialEdicao?'O texto aprovado não é alterado aqui. Salve apenas as informações que mudam em cada envio.':'Salvar cria somente um rascunho. Enviar para análise faz a Meta avaliar o modelo e não envia mensagens para contatos.'}</p><div className="acoes-fluxo-campanha"><button className="botao botao-primario" type="submit" disabled={salvandoTemplate}>{salvandoTemplate?'Salvando...':(templateOficialEdicao?'Salvar informações de envio':'Salvar rascunho')}</button>{templateEdicao&&<button className="botao botao-secundario" type="button" disabled={salvandoTemplate} onClick={function(){setTemplateEdicao(null);setTemplateOficialEdicao(false);setTemplate(TEMPLATE_INICIAL);}}>Cancelar edição</button>}</div></form>
      <div className="lista-templates-campanha">{templates.map(function(item){return <article key={item.id}><div><strong>{item.nome}</strong><span>{item.meta_nome||'Ainda sem nome na Meta'} · {item.meta_idioma||'Idioma não informado'} · {item.meta_categoria||item.categoria}</span><span className={'status-campanha status-'+item.meta_status}>{textoStatus(item.meta_status||'rascunho')}</span><small>{explicacaoStatusTemplate(item.meta_status||'rascunho')}</small>{item.meta_sincronizado_em&&<small>Última atualização: {new Date(item.meta_sincronizado_em).toLocaleString('pt-BR')}</small>}</div><div className="acoes-template-meta"><button className="botao botao-secundario" type="button" onClick={function(){editarTemplate(item);}}>{item.meta_template_id?'Definir informações de envio':'Editar rascunho'}</button>{!item.meta_template_id&&<button className="botao botao-primario" type="button" title="Envia o modelo para avaliação. Não envia mensagens para contatos." onClick={function(){submeterTemplate(item);}}>Enviar para análise da Meta</button>}</div></article>;})}</div>
    </div></details>}

    {loteAberto&&<div className="sobreposicao-campanha" role="presentation" onMouseDown={function(evento){if(evento.target===evento.currentTarget)setLoteAberto(null);}}><section className="painel-contatos-lote" role="dialog" aria-modal="true" aria-labelledby="titulo-contatos-lote"><div className="cabecalho-campanha-aberta"><div><span className="etiqueta-pagina">Lote {loteAberto.ordem}</span><h2 id="titulo-contatos-lote">{formatarQuantidade(loteAberto.tamanho_efetivo)} contatos neste lote</h2><p>Telefones aparecem mascarados para proteger os dados. Abrir esta lista não envia mensagens.</p></div><button className="botao botao-secundario" type="button" onClick={function(){setLoteAberto(null);}}>Fechar lista</button></div>{carregandoLote?<Carregando mensagem="Carregando contatos do lote..."/>:<ListaContatosCampanha contatos={contatosLote} aoEnviar={enviarContato} podeEnviar={selecionada.status==='ativa'&&selecionada.modelo_meta_status_oficial==='APPROVED'}/>}</section></div>}
  </div></main>;
}

export default CampanhasAdministrativas;
