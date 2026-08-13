const criarAppError = require('../../utils/AppError');
const campanhaModel = require('./campanhaModel');
const metaProvider = require('../mensageria/metaCloudApiProvider');

function texto(valor, nome, maximo, obrigatorio) {
  const resultado = typeof valor === 'string' ? valor.trim() : '';
  if ((obrigatorio && !resultado) || resultado.length > maximo) throw criarAppError(nome + ' invalido.', 400);
  return resultado;
}

function contarVariaveis(conteudo) {
  const encontradas = Array.from(conteudo.matchAll(/\{\{(\d+)\}\}/g), function(item){return Number(item[1]);});
  if (!encontradas.length) return 0;
  const unicas = Array.from(new Set(encontradas)).sort(function(a,b){return a-b;});
  if (unicas.some(function(numero,indice){return numero !== indice + 1;})) throw criarAppError('Os parametros devem ser sequenciais: {{1}}, {{2}} e assim por diante.', 400);
  return unicas.length;
}

function validarExemplos(exemplos, quantidade, nome) {
  const lista = Array.isArray(exemplos) ? exemplos.map(function(item){return texto(item,nome,1000,true);}) : [];
  if (lista.length !== quantidade) throw criarAppError(nome + ' deve possuir um valor para cada parametro.', 400);
  return lista;
}

function normalizarComponente(componente, estado) {
  if (!componente || typeof componente !== 'object' || Array.isArray(componente)) throw criarAppError('Componente do template invalido.', 400);
  const tipo = String(componente.type || '').toUpperCase();
  if (tipo === 'BODY') {
    if (estado.body) throw criarAppError('O template deve possuir somente um BODY.', 400);
    const conteudo = texto(componente.text,'Texto principal',1024,true);
    const quantidade = contarVariaveis(conteudo);
    const normalizado = { type:'BODY', text:conteudo };
    if (quantidade) normalizado.example={body_text:[validarExemplos(componente.exemplos,quantidade,'Exemplos do texto principal')]};
    estado.body=true;
    return normalizado;
  }
  if (tipo === 'HEADER') {
    if (estado.header) throw criarAppError('O template deve possuir somente um HEADER.', 400);
    const formato=String(componente.format||'').toUpperCase();
    let normalizado;
    if(formato==='TEXT'){
      const conteudo=texto(componente.text,'Cabecalho',60,true);
      const quantidade=contarVariaveis(conteudo);
      if(quantidade>1)throw criarAppError('O cabecalho de texto aceita somente um parametro nesta interface.',400);
      normalizado={type:'HEADER',format:'TEXT',text:conteudo};
      if(quantidade)normalizado.example={header_text:validarExemplos(componente.exemplos,quantidade,'Exemplos do cabecalho')};
    }else if(formato==='IMAGE'){
      const handle=texto(componente.handleExemplo,'Identificador da imagem de exemplo',1000,true);
      normalizado={type:'HEADER',format:'IMAGE',example:{header_handle:[handle]}};
    }else throw criarAppError('Somente cabecalho de texto ou imagem e suportado.',400);
    estado.header=true; return normalizado;
  }
  if(tipo==='FOOTER'){
    if(estado.footer)throw criarAppError('O template deve possuir somente um FOOTER.',400);
    const conteudo=texto(componente.text,'Rodape',60,true);
    if(contarVariaveis(conteudo))throw criarAppError('O rodape nao aceita parametros.',400);
    estado.footer=true; return {type:'FOOTER',text:conteudo};
  }
  if(tipo==='BUTTONS'){
    if(estado.buttons)throw criarAppError('O template deve possuir somente um grupo de botoes.',400);
    const botoes=Array.isArray(componente.buttons)?componente.buttons:[];
    if(!botoes.length||botoes.length>3)throw criarAppError('Informe de um a tres botoes suportados.',400);
    const tipos=botoes.map(function(item){return String(item.type||'').toUpperCase();});
    const quick=tipos.every(function(item){return item==='QUICK_REPLY';});
    const cta=tipos.every(function(item){return item==='URL'||item==='PHONE_NUMBER';});
    if(!quick&&!cta)throw criarAppError('Nao misture respostas rapidas com botoes de acao no mesmo template.',400);
    if(cta&&botoes.length>2)throw criarAppError('Templates com CTA aceitam no maximo dois botoes nesta interface.',400);
    const normalizados=botoes.map(function(botao){
      const tipoBotao=String(botao.type).toUpperCase();
      const rotulo=texto(botao.text,'Texto do botao',25,true);
      if(tipoBotao==='QUICK_REPLY')return {type:'QUICK_REPLY',text:rotulo};
      if(tipoBotao==='PHONE_NUMBER')return {type:'PHONE_NUMBER',text:rotulo,phone_number:texto(botao.phone_number,'Telefone do botao',20,true).replace(/[^\d+]/g,'')};
      const url=texto(botao.url,'URL do botao',2000,true);
      if(!/^https:\/\//i.test(url))throw criarAppError('A URL do botao deve usar HTTPS.',400);
      const quantidade=contarVariaveis(url);
      if(quantidade>1||quantidade===1&&!url.endsWith('{{1}}'))throw criarAppError('A URL dinamica aceita somente {{1}} ao final.',400);
      const resultado={type:'URL',text:rotulo,url};
      if(quantidade)resultado.example=[texto(botao.exemplo,'Exemplo da URL',2000,true)];
      return resultado;
    });
    estado.buttons=true; return {type:'BUTTONS',buttons:normalizados};
  }
  throw criarAppError('Componente nao suportado por esta versao do ACORDA RJ.',400);
}

function validarConfiguracaoEnvio(componentes, configuracao) {
  const resultado=configuracao&&typeof configuracao==='object'&&!Array.isArray(configuracao)?configuracao:{};
  const body=componentes.find(function(item){return item.type==='BODY';});
  const quantidadeBody=contarVariaveis(body.text);
  const corpo=Array.isArray(resultado.corpo)?resultado.corpo:[];
  if(corpo.length!==quantidadeBody)throw criarAppError('Configure o valor de envio de cada parametro do texto principal.',400);
  corpo.forEach(function(item){
    if(!item||!['nome_contato','fixo'].includes(item.origem))throw criarAppError('Origem de parametro do texto principal invalida.',400);
    if(item.origem==='fixo')texto(item.valor,'Valor fixo do parametro',1000,true);
  });
  const header=componentes.find(function(item){return item.type==='HEADER';});
  if(header&&header.format==='TEXT'&&contarVariaveis(header.text)){
    if(!resultado.cabecalho||resultado.cabecalho.tipo!=='texto'||!Array.isArray(resultado.cabecalho.parametros)||resultado.cabecalho.parametros.length!==1)throw criarAppError('Configure o parametro do cabecalho de texto.',400);
    if(!['nome_contato','fixo'].includes(resultado.cabecalho.parametros[0].origem))throw criarAppError('Origem do parametro do cabecalho invalida.',400);
    if(resultado.cabecalho.parametros[0].origem==='fixo')texto(resultado.cabecalho.parametros[0].valor,'Valor fixo do cabecalho',1000,true);
  }
  if(header&&header.format==='IMAGE'){
    if(!resultado.cabecalho||resultado.cabecalho.tipo!=='imagem'||!['link','id'].includes(resultado.cabecalho.origem))throw criarAppError('Configure a imagem que sera usada no envio.',400);
    texto(resultado.cabecalho.valor,'Imagem de envio',2000,true);
    if(resultado.cabecalho.origem==='link'&&!/^https:\/\//i.test(resultado.cabecalho.valor))throw criarAppError('A imagem de envio deve usar uma URL HTTPS.',400);
  }
  const grupo=componentes.find(function(item){return item.type==='BUTTONS';});
  const botoes=Array.isArray(resultado.botoes)?resultado.botoes:[];
  botoes.forEach(function(botao){
    if(!Number.isInteger(botao.indice)||!grupo||!grupo.buttons[botao.indice])throw criarAppError('Indice de botao invalido.',400);
    const oficial=grupo.buttons[botao.indice];
    if(botao.subtipo==='quick_reply'){
      if(oficial.type!=='QUICK_REPLY'||botao.origem!=='opt_out')throw criarAppError('Resposta rapida configurada de forma incompatível com o opt-out.',400);
    }else if(botao.subtipo==='url'){
      if(oficial.type!=='URL'||!oficial.url.includes('{{1}}'))throw criarAppError('Botao URL dinamico configurado de forma invalida.',400);
      if(!['nome_contato','fixo'].includes(botao.origem))throw criarAppError('Origem do parametro de URL invalida.',400);
      if(botao.origem==='fixo')texto(botao.valor,'Valor do botao URL',1000,true);
    }else throw criarAppError('Configuracao de botao nao suportada.',400);
  });
  if(grupo){
    grupo.buttons.forEach(function(botao,indice){
      const exigeConfiguracao=botao.type==='QUICK_REPLY'||botao.type==='URL'&&botao.url.includes('{{1}}');
      if(exigeConfiguracao&&!botoes.some(function(item){return item.indice===indice;})){
        throw criarAppError('Configure todos os botoes parametrizados antes de continuar.',400);
      }
    });
  }
  return { corpo, cabecalho: resultado.cabecalho || null, botoes };
}

function prepararRascunho(dados) {
  const metaNome=texto(dados.metaNome,'Nome oficial',512,true).toLowerCase();
  if(!/^[a-z0-9_]+$/.test(metaNome))throw criarAppError('O nome oficial deve usar apenas letras minusculas, numeros e sublinhado.',400);
  const idioma=texto(dados.metaIdioma,'Idioma',35,true);
  if(!/^[a-z]{2}_[A-Z]{2}$/.test(idioma))throw criarAppError('Idioma oficial invalido.',400);
  const categoria=String(dados.metaCategoria||'').toUpperCase();
  if(!['MARKETING','UTILITY'].includes(categoria))throw criarAppError('Somente categorias MARKETING e UTILITY sao suportadas nesta interface.',400);
  const estado={};
  const componentes=(Array.isArray(dados.componentes)&&dados.componentes.length?dados.componentes:[{type:'BODY',text:dados.conteudo}]).map(function(item){return normalizarComponente(item,estado);});
  if(!estado.body)throw criarAppError('O template precisa possuir um texto principal.',400);
  const configuracaoEnvio=validarConfiguracaoEnvio(componentes,dados.configuracaoEnvio||{});
  const body=componentes.find(function(item){return item.type==='BODY';});
  return {
    nome:texto(dados.nome,'Nome interno',150,true),categoria:texto(dados.categoria,'Categoria interna',100,true),
    conteudo:body.text,ativo:dados.ativo!==false,metaNome,metaIdioma:idioma,
    metaCategoria:categoria,componentes,configuracaoEnvio
  };
}

function validarTemplateOficial(item) {
  if(!item||typeof item!=='object'||!/^\d+$/.test(String(item.id||'')))throw criarAppError('A Meta retornou um template sem ID oficial valido.',502);
  const name=texto(item.name,'Nome oficial retornado',512,true);
  const language=texto(item.language,'Idioma oficial retornado',35,true);
  const status=texto(item.status,'Status oficial retornado',50,true).toUpperCase();
  const category=texto(item.category,'Categoria oficial retornada',50,true).toUpperCase();
  if(!Array.isArray(item.components))throw criarAppError('A Meta retornou components invalidos.',502);
  return {id:String(item.id),name,language,status,category,components:item.components};
}

async function salvarRascunho(id,dados,usuario){return campanhaModel.salvarTemplate(id,prepararRascunho(dados||{}),usuario.id);}

async function submeter(idRecebido,usuario){
  const id=Number(idRecebido); if(!Number.isInteger(id)||id<1)throw criarAppError('Template invalido.',400);
  try{return await campanhaModel.submeterTemplateAtomico(id,usuario.id,async function(template){
    const existentes=(await metaProvider.buscarTemplateOficialPorNome(template.meta_nome)).map(validarTemplateOficial)
      .filter(function(item){return item.name===template.meta_nome&&item.language===template.meta_idioma;});
    if(existentes.length>1)throw criarAppError('Existe mais de um template oficial com o mesmo nome e idioma. Sincronize antes de continuar.',409);
    if(existentes.length===1)return existentes[0];
    const criado=await metaProvider.criarTemplateOficial({name:template.meta_nome,language:template.meta_idioma,category:template.meta_categoria,components:template.meta_componentes});
    return validarTemplateOficial({id:criado.id,name:template.meta_nome,language:template.meta_idioma,status:criado.status,category:criado.category||template.meta_categoria,components:template.meta_componentes});
  });}catch(erro){
    if(erro.codigo==='TEMPLATE_NAO_ENCONTRADO')throw criarAppError(erro.message,404);
    throw erro;
  }
}

async function sincronizarComUsuarioId(usuarioId){
  const oficiais=(await metaProvider.listarTemplatesOficiais()).map(validarTemplateOficial);
  const ids=new Set(); oficiais.forEach(function(item){if(ids.has(item.id))throw criarAppError('A Meta retornou IDs de template duplicados.',502);ids.add(item.id);});
  const resumo=await campanhaModel.sincronizarTemplatesOficiais(oficiais,usuarioId);
  return Object.assign({total:oficiais.length},resumo);
}

async function sincronizar(usuario){return sincronizarComUsuarioId(usuario.id);}
async function sincronizarAutomaticamente(){return sincronizarComUsuarioId(null);}

async function processarAtualizacaoDoWebhook(dados) {
  const templateId = String(dados && dados.templateId || '').trim();
  const evento = String(dados && dados.evento || '').trim().toUpperCase();
  const eventosOficiais = new Set([
    'APPROVED', 'IN_APPEAL', 'PENDING', 'REJECTED', 'PENDING_DELETION',
    'DELETED', 'DISABLED', 'FLAGGED', 'REINSTATED'
  ]);
  if (!/^\d+$/.test(templateId) || !eventosOficiais.has(evento)) {
    return { processado: false, motivo: 'evento_template_invalido' };
  }
  const estadosFinaisSemConsulta = new Set([
    'PENDING_DELETION', 'DELETED', 'DISABLED', 'FLAGGED'
  ]);
  if (estadosFinaisSemConsulta.has(evento)) {
    return campanhaModel.atualizarStatusTemplateExistenteDoWebhook(templateId, evento);
  }
  const oficial = validarTemplateOficial(await metaProvider.buscarTemplateOficialPorId(templateId));
  if (oficial.id !== templateId) {
    return { processado: false, motivo: 'template_oficial_divergente' };
  }
  return campanhaModel.sincronizarTemplateOficialDoWebhook(oficial);
}

async function configurarEnvio(idRecebido,dados,usuario){
  const id=Number(idRecebido);if(!Number.isInteger(id)||id<1)throw criarAppError('Template invalido.',400);
  const template=await campanhaModel.buscarTemplatePorId(id);
  if(!template)throw criarAppError('Template nao encontrado.',404);
  if(!template.meta_template_id)throw criarAppError('Salve o rascunho diretamente antes da submissao.',409);
  const configuracao=validarConfiguracaoEnvio(template.meta_componentes||[],dados&&dados.configuracaoEnvio||{});
  return campanhaModel.configurarEnvioTemplate(id,configuracao,usuario.id);
}

module.exports={configurarEnvio,prepararRascunho,processarAtualizacaoDoWebhook,salvarRascunho,submeter,sincronizar,sincronizarAutomaticamente,validarConfiguracaoEnvio,validarTemplateOficial};
