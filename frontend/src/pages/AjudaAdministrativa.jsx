import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import { obterUsuario, removerToken } from '../utils/armazenamentoToken';

const TOPICOS = [
  {id:'inicio',titulo:'Início',texto:'O ACORDA RJ reúne contatos, eventos, importações, relatórios e campanhas em um só lugar. O fluxo normal é cadastrar ou importar contatos, organizar o público e acompanhar os resultados.',passos:['Use a Visão geral para acompanhar os números principais.','Abra Contatos para localizar ou corrigir cadastros.','Use Eventos e Campanhas somente quando precisar organizar uma ação específica.'],rota:'/admin',acao:'Ir para a visão geral'},
  {id:'contatos',titulo:'Contatos e consentimentos',texto:'O telefone identifica o contato e evita cadastros repetidos. “Não informado” significa que ainda não houve resposta; “recusado” ou “revogado” impede novas mensagens.',passos:['Cadastre manualmente ou localize a pessoa pelo nome ou telefone.','Confira os dados e o histórico antes de editar.','Nunca altere uma recusa somente para incluir alguém em uma campanha.'],rota:'/admin/contatos',acao:'Ir para Contatos'},
  {id:'eventos',titulo:'Eventos',texto:'Cada evento tem link e QR Code próprios, mas utiliza o mesmo formulário público. Uma pessoa pode participar de vários eventos sem criar contatos duplicados.',passos:['Crie o evento e confira o período.','Ative o evento.','Compartilhe o link ou QR Code e acompanhe os participantes.'],rota:'/admin/eventos',acao:'Ir para Eventos'},
  {id:'importacoes',titulo:'Importações',texto:'O sistema aceita CSV, XLSX e VCF de celular. A prévia separa registros novos, já existentes, repetidos e inválidos antes da confirmação.',passos:['Informe uma origem clara para a lista.','Escolha o arquivo e confira a prévia.','Confirme somente depois de revisar as quantidades.'],rota:'/admin/importacoes',acao:'Ir para Importações'},
  {id:'campanhas',titulo:'Campanhas e grupos de envio',texto:'Encontrados são todos que correspondem aos filtros. Aptos podem receber a mensagem agora. Não aptos estão impedidos pelas regras atuais. Criar um grupo não envia mensagens.',passos:['Crie a campanha e escolha o modelo.','Aplique os filtros e confira a prévia.','Crie o grupo respeitando a capacidade restante.','Abra o grupo e use “Enviar mensagem agora” somente quando estiver pronto.','Acompanhe entregas, leituras e falhas na campanha.'],rota:'/admin/campanhas',acao:'Ir para Campanhas'},
  {id:'templates',titulo:'Modelos de mensagem e valores personalizados',texto:'Um modelo é a mensagem avaliada pela Meta. “Rascunho” ainda não foi enviado; “Em análise” aguarda a Meta; “Aprovado” pode ser usado se também estiver disponível no ACORDA RJ.',passos:['Escreva o texto principal. Use {{1}}, {{2}} e assim por diante somente onde uma informação deve mudar.','Para cada valor, escolha Nome da pessoa, Bairro, Principal necessidade ou Texto igual para todos.','Se usar imagem, separe a imagem de exemplo para aprovação da imagem que aparecerá nas mensagens.','Enviar para análise não envia mensagens aos contatos.','Use “Atualizar modelos da Meta” para conferir o estado oficial.'],rota:'/admin/campanhas',acao:'Abrir modelos de mensagem'},
  {id:'optout',titulo:'Quando a pessoa escolhe SAIR',texto:'O ACORDA RJ registra a decisão, bloqueia novas mensagens e mantém o contato e o histórico. Importações e eventos posteriores não removem esse bloqueio.',passos:['Consulte o contato e seu histórico.','Não tente incluí-lo novamente em campanhas.','Uma solicitação de exclusão é tratada separadamente pelo administrador.'],rota:'/admin/contatos',acao:'Consultar contatos'},
  {id:'relatorios',titulo:'Relatórios',texto:'Os gráficos mostram a distribuição dos contatos. Clique em uma categoria para abrir a listagem correspondente e use “Não informado” para localizar cadastros incompletos.',passos:['Escolha o relatório.','Clique na categoria desejada.','Revise os filtros aplicados na lista de contatos.'],rota:'/admin/relatorios',acao:'Ir para Relatórios'},
  {id:'backups',titulo:'Backups',texto:'O backup do painel exporta os dados em SQL. Ele complementa, mas não substitui, o backup gerenciado do banco.',passos:['Gere antes de uma alteração importante nos dados.','Guarde o arquivo em local seguro.','Não compartilhe o arquivo, pois ele contém dados pessoais.'],rota:'/admin/backups',acao:'Ir para Backups',somenteAdministrador:true},
  {id:'usuarios',titulo:'Usuários e permissões',texto:'Administradores controlam configurações, usuários e operações sensíveis. Operadores trabalham com contatos e ações permitidas, sem acesso às configurações exclusivas do administrador.',passos:['Crie uma conta individual para cada pessoa da equipe.','Desative quem não deve mais acessar.','Nunca compartilhe senha entre usuários.'],rota:'/admin/usuarios',acao:'Ir para Usuários',somenteAdministrador:true}
];

function AjudaAdministrativa(){
  const navegacao=useNavigate();
  const localizacao=useLocation();
  const usuario=obterUsuario();
  const usuarioAdministrador=usuario&&usuario.perfil==='administrador';

  useEffect(function(){
    if(!localizacao.hash){return;}
    const identificador=decodeURIComponent(localizacao.hash.slice(1));
    const temporizador=window.setTimeout(function(){
      const destino=document.getElementById(identificador);
      if(!destino){return;}
      if(destino.tagName==='DETAILS'){destino.open=true;}
      destino.scrollIntoView({behavior:'smooth',block:'start'});
    },0);
    return function(){window.clearTimeout(temporizador);};
  },[localizacao.hash]);

  function sair(){removerToken();navegacao('/login',{replace:true});}
  return <main className="pagina-administrativa"><div className="conteudo-administrativo ajuda-pagina">
    <CabecalhoAdministrativo aoSair={sair} titulo="Como usar" subtitulo="Respostas rápidas e passos seguros para operar o ACORDA RJ."/>
    <section className="cartao introducao-ajuda"><span className="etiqueta-pagina">Guia do sistema</span><h2>Encontre a orientação no momento em que precisar</h2><p>Abra um assunto abaixo. As instruções explicam o efeito de cada ação sem exigir conhecimento técnico.</p></section>
    <nav className="atalhos-ajuda" aria-label="Assuntos da ajuda">{TOPICOS.map(function(topico){return <a href={'#'+topico.id} key={topico.id}>{topico.titulo}</a>;})}</nav>
    <section className="lista-ajuda">{TOPICOS.map(function(topico,indice){return <details id={topico.id} key={topico.id} open={indice===0}><summary>{topico.titulo}</summary><div><p>{topico.texto}</p><ol>{topico.passos.map(function(passo){return <li key={passo}>{passo}</li>;})}</ol>{!topico.somenteAdministrador||usuarioAdministrador?<Link className="botao botao-secundario" to={topico.rota}>{topico.acao}</Link>:<p className="aviso-permissao-ajuda">Esta área está disponível somente para administradores.</p>}</div></details>;})}</section>
  </div></main>;
}

export default AjudaAdministrativa;
