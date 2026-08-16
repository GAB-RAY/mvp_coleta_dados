require('dotenv').config({ quiet: true });
const banco = require('../src/config/banco');
const campanhaService = require('../src/modules/campanhas/campanhaService');
const mensageriaService = require('../src/modules/mensageria/mensageriaService');
const autorizarAdministrador = require('../src/middlewares/autorizarAdministrador');

let verificacoes = 0;
function confirmar(condicao, mensagem) { if (!condicao) throw new Error(mensagem); verificacoes += 1; }

async function executar() {
  const marca = 'TESTE_CAMPANHA_' + Date.now();
  const nomesCampanhas = [];
  let contatoIds = [];
  let templateId;
  let limiteAnterior;
  let usuario;
  const inicio = new Date('2020-01-01T12:00:00.000Z');

  try {
    usuario = (await banco.query("SELECT id,nome,email,perfil FROM usuarios WHERE perfil='administrador' AND ativo=TRUE ORDER BY id LIMIT 1")).rows[0];
    confirmar(Boolean(usuario), 'E necessario um administrador ativo para o teste.');
    limiteAnterior = (await banco.query("SELECT valor_inteiro FROM configuracoes_sistema WHERE chave='limite_mensagens_24h'")).rows[0].valor_inteiro;
    await campanhaService.atualizarLimite({ valor: 250, motivo: marca }, usuario);
    const bairro = (await banco.query('SELECT nome FROM bairros WHERE ativo=TRUE ORDER BY id LIMIT 1')).rows[0].nome;
    const origem = (await banco.query('SELECT id FROM origens ORDER BY id LIMIT 1')).rows[0].id;
    const telefones = [];
    const nomes = [];
    for (let indice=0;indice<600;indice+=1) {
      telefones.push('248' + String(10000000 + ((Date.now()+indice)%80000000)).slice(-8));
      nomes.push(marca + ' CONTATO ' + indice);
    }
    const inseridos = await banco.query(`
      INSERT INTO contatos (nome,telefone,telefone_normalizado,bairro,problema,
        consentimento_armazenamento,consentimento_mensagens,origem_id,status_contato)
      SELECT nome,telefone,telefone,bairro,problema,TRUE,FALSE,origem_id,'ativo'
      FROM UNNEST($1::text[],$2::text[]) AS dados(nome,telefone)
      CROSS JOIN (SELECT $3::text AS bairro,$4::text AS problema,$5::bigint AS origem_id) fixos
      RETURNING id
    `,[nomes,telefones,bairro,'Saude',origem]);
    contatoIds=inseridos.rows.map(function(item){return item.id;});
    await banco.query(`
      INSERT INTO consentimentos (
        contato_id, contato_id_original, tipo, resposta, texto_apresentado,
        versao_texto, canal, origem_registro, ativo, estado, origem_id
      )
      SELECT id, id, 'mensagens', FALSE, 'Texto de teste', 'teste_v1',
        'cadastro_manual', 'resposta_expressa', TRUE, 'recusado', origem_id
      FROM contatos
      WHERE id = $1
    `, [contatoIds[contatoIds.length - 1]]);
    await banco.query("UPDATE contatos SET problema='Iluminacao publica' WHERE id=ANY($1::bigint[])",[contatoIds.slice(0,20)]);
    confirmar(contatoIds.length===600,'O teste deve criar 600 contatos.');

    const template=await campanhaService.salvarTemplate(null,{nome:marca,categoria:'Teste',conteudo:'Ola teste',ativo:true,
      metaNome:'teste_campanha_'+Date.now(),metaIdioma:'pt_BR',metaCategoria:'MARKETING',
      componentes:[{type:'BODY',text:'Ola teste'}],configuracaoEnvio:{corpo:[],botoes:[]}},usuario);
    templateId=template.id;

    async function novaCampanha(sufixo,filtros){const campanha=await campanhaService.criar({nome:marca+' '+sufixo,finalidade:'Validacao automatizada',modeloId:templateId,filtros},usuario);nomesCampanhas.push(campanha.id);return campanhaService.alterarStatus(campanha.id,'pronta',usuario);}
    const nomeDinamico='CONTATO POSTERIOR DINAMICO '+Date.now();
    const dinamica=await novaCampanha('DINAMICA',{nome:nomeDinamico});
    const previaDinamicaVazia=await campanhaService.visualizarPublico(dinamica.id,20);
    confirmar(previaDinamicaVazia.publicoEncontrado===0,'Campanha ainda nao deve encontrar contato criado posteriormente.');
    const telefoneDinamico='247'+String(10000000+(Date.now()%80000000)).slice(-8);
    const contatoDinamico=(await banco.query(`
      INSERT INTO contatos (nome,telefone,telefone_normalizado,bairro,problema,
        consentimento_armazenamento,consentimento_mensagens,origem_id,status_contato)
      VALUES ($1,$2,$2,$3,$4,TRUE,FALSE,$5,'ativo') RETURNING id
    `,[nomeDinamico,telefoneDinamico,bairro,'Saude',origem])).rows[0];
    contatoIds.push(contatoDinamico.id);
    const contagensAntes=await banco.query(`SELECT
      (SELECT COUNT(*)::integer FROM campanha_lotes WHERE campanha_id=$1) AS lotes,
      (SELECT COUNT(*)::integer FROM campanha_participacoes WHERE campanha_id=$1) AS participacoes,
      (SELECT COUNT(*)::integer FROM campanha_tentativas tentativa INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id WHERE participacao.campanha_id=$1) AS tentativas`,[dinamica.id]);
    const previaDinamica=await campanhaService.visualizarPublico(dinamica.id,20);
    const contagensDepois=await banco.query(`SELECT
      (SELECT COUNT(*)::integer FROM campanha_lotes WHERE campanha_id=$1) AS lotes,
      (SELECT COUNT(*)::integer FROM campanha_participacoes WHERE campanha_id=$1) AS participacoes,
      (SELECT COUNT(*)::integer FROM campanha_tentativas tentativa INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id WHERE participacao.campanha_id=$1) AS tentativas`,[dinamica.id]);
    confirmar(previaDinamica.publicoEncontrado===1&&previaDinamica.jaReceberam===0&&previaDinamica.aptosProximoEnvio===1&&previaDinamica.naoAptosProximoEnvio===0,'Publico atual deve incluir contato elegivel cadastrado depois da campanha.');
    confirmar(JSON.stringify(contagensAntes.rows[0])===JSON.stringify(contagensDepois.rows[0]),'Consultar publico nao pode criar lote, participacao ou tentativa.');
    const loteDinamico=(await banco.query(`INSERT INTO campanha_lotes
      (campanha_id,tamanho_solicitado,tamanho_efetivo,ordem,status,chave_idempotencia,criado_por_usuario_id)
      VALUES ($1,1,1,1,'processado',$2,$3) RETURNING id`,[dinamica.id,marca+'-dinamica',usuario.id])).rows[0];
    await banco.query(`INSERT INTO campanha_participacoes
      (campanha_id,contato_id,lote_original_id,status,reservado_em) VALUES ($1,$2,$3,'enviada','2000-01-01T00:00:00Z')`,
    [dinamica.id,contatoDinamico.id,loteDinamico.id]);
    const previaDinamicaRecebida=await campanhaService.visualizarPublico(dinamica.id,20);
    confirmar(previaDinamicaRecebida.jaReceberam===1&&previaDinamicaRecebida.aptosProximoEnvio===0&&previaDinamicaRecebida.naoAptosProximoEnvio===0,'Quem ja recebeu nao pode voltar ao proximo envio.');
    const principal=await novaCampanha('PRINCIPAL',{nome:marca});
    const previaFiltros=await campanhaService.visualizarPreviaFiltros({filtros:{nome:marca},quantidade:20});
    confirmar(previaFiltros.publicoEncontrado===600&&previaFiltros.publicoApto===599&&previaFiltros.publicoNaoApto===1&&previaFiltros.contatos.length===20,'Previa deve separar contato sem resposta de contato explicitamente recusado.');
    const previaLote=await campanhaService.visualizarPublico(principal.id,250);
    confirmar(previaLote.quantidadeEfetiva===250&&previaLote.contatos.length===250,'Previa do lote deve apresentar os proximos 250 contatos.');
    confirmar(!JSON.stringify(previaLote.contatos).includes(telefones[0]),'Previa nao pode expor o telefone completo.');
    campanhaService.definirRelogioParaTeste(function(){return inicio;});
    const lote1=await campanhaService.criarLote(principal.id,{tamanho:200,chaveIdempotencia:marca+'-1'},usuario);
    confirmar(lote1.lote.tamanho_efetivo===200,'Primeiro lote deve reservar 200.');
    const capacidadeApos200=await campanhaService.obterLimite();
    confirmar(capacidadeApos200.limite===250&&capacidadeApos200.utilizado===200&&capacidadeApos200.disponivel===50,'Apos consumir 200, a capacidade disponivel deve ser 50.');
    let excessoDos50;
    try{await campanhaService.criarLote(principal.id,{tamanho:51,chaveIdempotencia:marca+'-excesso-50'},usuario);}catch(erro){excessoDos50=erro;}
    confirmar(excessoDos50&&excessoDos50.statusHttp===409&&excessoDos50.capacidade===50,'Solicitacao acima dos 50 restantes deve informar e bloquear o excesso.');
    confirmar(Number((await banco.query('SELECT COUNT(*) total FROM campanha_participacoes WHERE campanha_id=$1',[principal.id])).rows[0].total)===200,'Excesso nao pode criar participacao parcial.');
    await campanhaService.criarLote(principal.id,{tamanho:50,chaveIdempotencia:marca+'-complemento'},usuario);
    const contatosLote=await campanhaService.listarContatosLote(principal.id,lote1.lote.id);
    confirmar(contatosLote.length===200&&!JSON.stringify(contatosLote).includes(telefones[0]),'Consulta do lote deve listar 200 contatos com telefone mascarado.');
    campanhaService.definirRelogioParaTeste(function(){return new Date(inicio.getTime()+25*60*60*1000);});
    const lote2=await campanhaService.criarLote(principal.id,{tamanho:250,chaveIdempotencia:marca+'-2'},usuario);
    confirmar(lote2.lote.tamanho_efetivo===250,'Segundo lote deve reservar outros 250.');
    campanhaService.definirRelogioParaTeste(function(){return new Date(inicio.getTime()+50*60*60*1000);});
    const lote3=await campanhaService.criarLote(principal.id,{tamanho:250,chaveIdempotencia:marca+'-3'},usuario);
    confirmar(lote3.lote.tamanho_efetivo===99,'Ultimo lote deve ter tamanho efetivo 99, excluindo a recusa expressa.');
    const unicos=(await banco.query('SELECT COUNT(*)::int total,COUNT(DISTINCT contato_id)::int unicos FROM campanha_participacoes WHERE campanha_id=$1',[principal.id])).rows[0];
    confirmar(unicos.total===599&&unicos.unicos===599,'A campanha deve reservar somente os 599 contatos aptos e unicos.');

    campanhaService.definirRelogioParaTeste(function(){return new Date(inicio.getTime()+75*60*60*1000);});
    const segunda=await novaCampanha('SEGUNDA',{nome:marca});
    await campanhaService.criarLote(segunda.id,{tamanho:250,chaveIdempotencia:marca+'-4'},usuario);
    const intersecao=(await banco.query(`SELECT COUNT(*)::int total FROM campanha_participacoes a INNER JOIN campanha_participacoes b ON b.contato_id=a.contato_id WHERE a.campanha_id=$1 AND b.campanha_id=$2`,[principal.id,segunda.id])).rows[0].total;
    confirmar(intersecao===250,'Contatos devem poder participar de campanhas diferentes.');
    let bloqueou=false;
    try{await campanhaService.criarLote(segunda.id,{tamanho:1,chaveIdempotencia:marca+'-limite'},usuario);}catch(erro){bloqueou=erro.statusHttp===409;}
    confirmar(bloqueou,'Excesso de capacidade deve ser bloqueado integralmente.');
    confirmar(Number((await banco.query('SELECT COUNT(*) total FROM campanha_lotes WHERE campanha_id=$1',[segunda.id])).rows[0].total)===1,'Falha de limite nao pode criar lote parcial.');

    campanhaService.definirRelogioParaTeste(function(){return new Date(inicio.getTime()+100*60*60*1000);});
    const concorrente=await novaCampanha('CONCORRENTE',{nome:marca});
    const resultados=await Promise.all([
      campanhaService.criarLote(concorrente.id,{tamanho:20,chaveIdempotencia:marca+'-duplo'},usuario),
      campanhaService.criarLote(concorrente.id,{tamanho:20,chaveIdempotencia:marca+'-duplo'},usuario)
    ]);
    confirmar(resultados[0].lote.id===resultados[1].lote.id,'Clique duplo deve devolver o mesmo lote.');
    confirmar(Number((await banco.query('SELECT COUNT(*) total FROM campanha_lotes WHERE campanha_id=$1',[concorrente.id])).rows[0].total)===1,'Concorrencia nao pode duplicar lote.');

    const concorrenteGlobalA=await novaCampanha('CONCORRENTE GLOBAL A',{nome:marca});
    const concorrenteGlobalB=await novaCampanha('CONCORRENTE GLOBAL B',{nome:marca});
    const disputaGlobal=await Promise.allSettled([
      campanhaService.criarLote(concorrenteGlobalA.id,{tamanho:150,chaveIdempotencia:marca+'-global-a'},usuario),
      campanhaService.criarLote(concorrenteGlobalB.id,{tamanho:150,chaveIdempotencia:marca+'-global-b'},usuario)
    ]);
    confirmar(disputaGlobal.filter(function(resultado){return resultado.status==='fulfilled';}).length===1&&disputaGlobal.filter(function(resultado){return resultado.status==='rejected'&&resultado.reason.statusHttp===409;}).length===1,'Operacoes concorrentes globais nao podem ultrapassar o limite configurado.');
    const capacidadeConcorrente=await campanhaService.obterLimite();
    confirmar(capacidadeConcorrente.utilizado===170&&capacidadeConcorrente.disponivel===80,'A concorrencia deve preservar a capacidade global sem ultrapassar 250.');

    campanhaService.definirRelogioParaTeste(function(){return new Date(inicio.getTime()+125*60*60*1000);});
    const filtrada=await novaCampanha('ILUMINACAO',{nome:marca,problema:'Iluminacao publica'});
    const loteFiltrado=await campanhaService.criarLote(filtrada.id,{tamanho:50,chaveIdempotencia:marca+'-filtro'},usuario);
    confirmar(loteFiltrado.lote.tamanho_efetivo===20,'Filtro deve reservar somente os 20 contatos de iluminacao.');

    const tentativas=(await banco.query(`SELECT tentativa.id FROM campanha_tentativas tentativa INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id WHERE participacao.campanha_id=$1 ORDER BY tentativa.id LIMIT 2`,[principal.id])).rows;
    const externo=marca+'-externo-1';
    await mensageriaService.receberIdentificadorExterno(tentativas[0].id,externo);
    for(const status of ['enviada','entregue','lida']) await mensageriaService.atualizarStatusEntrega({identificadorExterno:externo,status,origem:'processamento'});
    const final=(await banco.query('SELECT status FROM campanha_tentativas WHERE id=$1',[tentativas[0].id])).rows[0].status;
    confirmar(final==='lida','Fluxo de status deve terminar em lida.');
    const externoFalha=marca+'-externo-2';
    await mensageriaService.receberIdentificadorExterno(tentativas[1].id,externoFalha);
    await mensageriaService.atualizarStatusEntrega({identificadorExterno:externoFalha,status:'falhou',origem:'processamento',erro:{code:130497,title:'Falha simulada',message:'Erro externo fake'}});
    const novaTentativa=await mensageriaService.reprocessar(tentativas[1].id);
    confirmar(novaTentativa.numero_tentativa===2,'Reprocessamento deve criar uma segunda tentativa.');
    confirmar(Number((await banco.query('SELECT COUNT(*) total FROM campanha_tentativas WHERE participacao_id=$1',[novaTentativa.participacao_id])).rows[0].total)===2,'Tentativa anterior deve ser preservada.');

    let erroOperador;
    autorizarAdministrador({usuario:{perfil:'operador'}},{},function(erro){erroOperador=erro;});
    confirmar(erroOperador&&erroOperador.statusHttp===403,'Operador nao pode alterar configuracao administrativa.');
    const auditoria=(await banco.query('SELECT * FROM historico_configuracoes_sistema WHERE motivo=$1',[marca])).rows;
    confirmar(auditoria.length===1&&auditoria[0].valor_novo===250,'Alteracao do limite deve ser auditada.');
    campanhaService.definirRelogioParaTeste(function(){return new Date(inicio.getTime()+150*60*60*1000);});
    const capacidadeLiberada=await campanhaService.obterLimite();
    confirmar(capacidadeLiberada.utilizado===0&&capacidadeLiberada.disponivel===250,'A janela movel deve liberar automaticamente a capacidade apos 24 horas.');
    console.log('Campanhas, lotes e mensageria: '+verificacoes+' verificacoes aprovadas.');
  } finally {
    campanhaService.definirRelogioParaTeste(null);
    if(nomesCampanhas.length){await banco.query('DELETE FROM historico_status_mensageria WHERE participacao_id IN (SELECT id FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[]))',[nomesCampanhas]);await banco.query('DELETE FROM campanha_tentativas WHERE participacao_id IN (SELECT id FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[]))',[nomesCampanhas]);await banco.query('DELETE FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[])',[nomesCampanhas]);await banco.query('DELETE FROM campanha_lotes WHERE campanha_id=ANY($1::bigint[])',[nomesCampanhas]);await banco.query('DELETE FROM campanhas WHERE id=ANY($1::bigint[])',[nomesCampanhas]);}
    if(templateId){await banco.query('DELETE FROM historico_modelos_mensagem_meta WHERE modelo_id=$1',[templateId]);await banco.query('DELETE FROM modelos_mensagem WHERE id=$1',[templateId]);}
    if(contatoIds.length){await banco.query('DELETE FROM consentimentos WHERE contato_id=ANY($1::bigint[])',[contatoIds]);await banco.query('DELETE FROM contatos WHERE id=ANY($1::bigint[])',[contatoIds]);}
    if(limiteAnterior)await banco.query("UPDATE configuracoes_sistema SET valor_inteiro=$1 WHERE chave='limite_mensagens_24h'",[limiteAnterior]);
    if(usuario)await banco.query('DELETE FROM historico_configuracoes_sistema WHERE usuario_id=$1 AND motivo LIKE $2',[usuario.id,'TESTE_CAMPANHA_%']);
    await banco.query("DELETE FROM eventos_webhook_mensageria WHERE identificador_externo LIKE 'TESTE_CAMPANHA_%'");
    await banco.end();
  }
}

executar().catch(function(erro){console.error(erro.stack||erro.message);process.exitCode=1;});
