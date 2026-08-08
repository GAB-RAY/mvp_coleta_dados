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
    await banco.query("UPDATE contatos SET problema='Iluminacao publica' WHERE id=ANY($1::bigint[])",[contatoIds.slice(0,20)]);
    confirmar(contatoIds.length===600,'O teste deve criar 600 contatos.');

    const template=await campanhaService.salvarTemplate(null,{nome:marca,categoria:'Teste',conteudo:'Ola {{nome}}',ativo:true},usuario);
    templateId=template.id;

    async function novaCampanha(sufixo,filtros){const campanha=await campanhaService.criar({nome:marca+' '+sufixo,finalidade:'Validacao automatizada',modeloId:templateId,filtros},usuario);nomesCampanhas.push(campanha.id);return campanhaService.alterarStatus(campanha.id,'pronta',usuario);}
    const principal=await novaCampanha('PRINCIPAL',{nome:marca});
    const previaFiltros=await campanhaService.visualizarPreviaFiltros({filtros:{nome:marca},quantidade:20});
    confirmar(previaFiltros.publicoApto===600&&previaFiltros.contatos.length===20,'Previa de criacao deve listar uma amostra do publico apto.');
    const previaLote=await campanhaService.visualizarPublico(principal.id,250);
    confirmar(previaLote.quantidadeEfetiva===250&&previaLote.contatos.length===250,'Previa do lote deve apresentar os proximos 250 contatos.');
    confirmar(!JSON.stringify(previaLote.contatos).includes(telefones[0]),'Previa nao pode expor o telefone completo.');
    campanhaService.definirRelogioParaTeste(function(){return inicio;});
    const lote1=await campanhaService.criarLote(principal.id,{tamanho:250,chaveIdempotencia:marca+'-1'},usuario);
    confirmar(lote1.lote.tamanho_efetivo===250,'Primeiro lote deve reservar 250.');
    const contatosLote=await campanhaService.listarContatosLote(principal.id,lote1.lote.id);
    confirmar(contatosLote.length===250&&!JSON.stringify(contatosLote).includes(telefones[0]),'Consulta do lote deve listar 250 contatos com telefone mascarado.');
    campanhaService.definirRelogioParaTeste(function(){return new Date(inicio.getTime()+25*60*60*1000);});
    const lote2=await campanhaService.criarLote(principal.id,{tamanho:250,chaveIdempotencia:marca+'-2'},usuario);
    confirmar(lote2.lote.tamanho_efetivo===250,'Segundo lote deve reservar outros 250.');
    campanhaService.definirRelogioParaTeste(function(){return new Date(inicio.getTime()+50*60*60*1000);});
    const lote3=await campanhaService.criarLote(principal.id,{tamanho:250,chaveIdempotencia:marca+'-3'},usuario);
    confirmar(lote3.lote.tamanho_efetivo===100,'Ultimo lote deve ter tamanho efetivo 100.');
    const unicos=(await banco.query('SELECT COUNT(*)::int total,COUNT(DISTINCT contato_id)::int unicos FROM campanha_participacoes WHERE campanha_id=$1',[principal.id])).rows[0];
    confirmar(unicos.total===600&&unicos.unicos===600,'A campanha deve ter 600 participacoes unicas.');

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
    console.log('Campanhas, lotes e mensageria: '+verificacoes+' verificacoes aprovadas.');
  } finally {
    campanhaService.definirRelogioParaTeste(null);
    if(nomesCampanhas.length){await banco.query('DELETE FROM historico_status_mensageria WHERE participacao_id IN (SELECT id FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[]))',[nomesCampanhas]);await banco.query('DELETE FROM campanha_tentativas WHERE participacao_id IN (SELECT id FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[]))',[nomesCampanhas]);await banco.query('DELETE FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[])',[nomesCampanhas]);await banco.query('DELETE FROM campanha_lotes WHERE campanha_id=ANY($1::bigint[])',[nomesCampanhas]);await banco.query('DELETE FROM campanhas WHERE id=ANY($1::bigint[])',[nomesCampanhas]);}
    if(templateId)await banco.query('DELETE FROM modelos_mensagem WHERE id=$1',[templateId]);
    if(contatoIds.length)await banco.query('DELETE FROM contatos WHERE id=ANY($1::bigint[])',[contatoIds]);
    if(limiteAnterior)await banco.query("UPDATE configuracoes_sistema SET valor_inteiro=$1 WHERE chave='limite_mensagens_24h'",[limiteAnterior]);
    if(usuario)await banco.query('DELETE FROM historico_configuracoes_sistema WHERE usuario_id=$1 AND motivo LIKE $2',[usuario.id,'TESTE_CAMPANHA_%']);
    await banco.query("DELETE FROM eventos_webhook_mensageria WHERE identificador_externo LIKE 'TESTE_CAMPANHA_%'");
    await banco.end();
  }
}

executar().catch(function(erro){console.error(erro.stack||erro.message);process.exitCode=1;});
