require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');
const campanhaService = require('../src/modules/campanhas/campanhaService');
const autorizarAdministrador = require('../src/middlewares/autorizarAdministrador');

let verificacoes = 0;
function confirmar(condicao, mensagem) { if (!condicao) throw new Error(mensagem); verificacoes += 1; }

async function executar() {
  const marca = 'QA_EXCLUSAO_CAMPANHA_' + Date.now();
  const campanhaIds = [];
  const contatoIds = [];
  let templateId;
  const usuario = (await banco.query("SELECT id FROM usuarios WHERE perfil='administrador' AND ativo=TRUE ORDER BY id LIMIT 1")).rows[0];
  if (!usuario) throw new Error('O teste requer um administrador ativo.');
  try {
    const template = await campanhaService.salvarTemplate(null, {
      nome: marca, categoria: 'QA', conteudo: 'Mensagem de teste', ativo: true,
      metaNome: 'qa_exclusao_' + Date.now(), metaIdioma: 'pt_BR', metaCategoria: 'UTILITY',
      componentes: [{ type: 'BODY', text: 'Mensagem de teste' }],
      configuracaoEnvio: { corpo: [], botoes: [] }
    }, usuario);
    templateId = template.id;
    const limpa = await campanhaService.criar({ nome: marca + ' LIMPA', finalidade: 'Teste local', modeloId: templateId, filtros: {} }, usuario);
    campanhaIds.push(limpa.id);
    const exclusao = await campanhaService.excluirOuArquivar(limpa.id, usuario);
    confirmar(exclusao.acao === 'excluida', 'Campanha sem historico deveria ser excluida.');
    confirmar(Number((await banco.query('SELECT COUNT(*)::int total FROM campanhas WHERE id=$1', [limpa.id])).rows[0].total) === 0, 'Campanha limpa permaneceu no banco.');

    const historica = await campanhaService.criar({ nome: marca + ' HISTORICA', finalidade: 'Teste local', modeloId: templateId, filtros: {} }, usuario);
    campanhaIds.push(historica.id);
    const bairro = (await banco.query('SELECT nome FROM bairros WHERE ativo=TRUE ORDER BY id LIMIT 1')).rows[0].nome;
    const origem = (await banco.query('SELECT id FROM origens ORDER BY id LIMIT 1')).rows[0].id;
    const telefone = '246' + String(10000000 + (Date.now() % 80000000)).slice(-8);
    const contato = (await banco.query(`
      INSERT INTO contatos (nome,telefone,telefone_normalizado,bairro,problema,
        consentimento_armazenamento,consentimento_mensagens,origem_id,status_contato)
      VALUES ($1,$2,$2,$3,'Teste local',TRUE,FALSE,$4,'ativo') RETURNING id
    `, [marca + ' CONTATO', telefone, bairro, origem])).rows[0];
    contatoIds.push(contato.id);
    const lote = (await banco.query(`INSERT INTO campanha_lotes
      (campanha_id,tamanho_solicitado,tamanho_efetivo,ordem,status,chave_idempotencia,criado_por_usuario_id)
      VALUES ($1,1,1,1,'processado',$2,$3) RETURNING id`, [historica.id, marca, usuario.id])).rows[0];
    const participacao = (await banco.query(`
      INSERT INTO campanha_participacoes (campanha_id,contato_id,lote_original_id,status)
      VALUES ($1,$2,$3,'enviada') RETURNING id
    `, [historica.id, contato.id, lote.id])).rows[0];
    const tentativa = (await banco.query(`
      INSERT INTO campanha_tentativas (participacao_id,numero_tentativa,status,finalizada_em)
      VALUES ($1,1,'enviada',CURRENT_TIMESTAMP) RETURNING id
    `, [participacao.id])).rows[0];
    await banco.query(`
      INSERT INTO historico_status_mensageria
        (participacao_id,tentativa_id,status_anterior,status_novo,origem)
      VALUES ($1,$2,'enviando','enviada','processamento')
    `, [participacao.id, tentativa.id]);
    const exclusaoHistorica = await campanhaService.excluirOuArquivar(historica.id, usuario);
    confirmar(exclusaoHistorica.acao === 'excluida', 'Campanha com envio deveria ser excluida permanentemente.');
    const contagens = (await banco.query(`SELECT
      (SELECT COUNT(*)::integer FROM campanhas WHERE id=$1) AS campanhas,
      (SELECT COUNT(*)::integer FROM campanha_lotes WHERE campanha_id=$1) AS lotes,
      (SELECT COUNT(*)::integer FROM campanha_participacoes WHERE campanha_id=$1) AS participacoes,
      (SELECT COUNT(*)::integer FROM campanha_tentativas WHERE participacao_id=$2) AS tentativas,
      (SELECT COUNT(*)::integer FROM historico_status_mensageria WHERE participacao_id=$2) AS historicos
    `, [historica.id, participacao.id])).rows[0];
    confirmar(Object.values(contagens).every(function(total){return Number(total)===0;}), 'Campanha ou historico operacional permaneceu no banco.');
    confirmar(!(await campanhaService.listar(true)).some(function(item){return Number(item.id)===Number(historica.id);}), 'Campanha excluida permaneceu na listagem.');
    let erroRepetido;
    try { await campanhaService.excluirOuArquivar(historica.id, usuario); } catch (erro) { erroRepetido = erro; }
    confirmar(erroRepetido && erroRepetido.statusHttp === 404, 'Exclusao repetida deveria informar campanha inexistente.');
    let erroOperador;
    autorizarAdministrador({ usuario: { perfil: 'operador' } }, {}, function(erro){erroOperador=erro;});
    confirmar(erroOperador && erroOperador.statusHttp === 403, 'Operador conseguiu acessar a exclusao administrativa.');
    console.log('Exclusao permanente de campanhas: ' + verificacoes + ' verificacoes aprovadas.');
  } finally {
    if (campanhaIds.length) {
      await banco.query(`DELETE FROM historico_status_mensageria WHERE participacao_id IN
        (SELECT id FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[]))`, [campanhaIds]);
      await banco.query(`DELETE FROM campanha_tentativas WHERE participacao_id IN
        (SELECT id FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[]))`, [campanhaIds]);
      await banco.query('DELETE FROM campanha_participacoes WHERE campanha_id=ANY($1::bigint[])', [campanhaIds]);
      await banco.query('DELETE FROM campanha_lotes WHERE campanha_id=ANY($1::bigint[])', [campanhaIds]);
      await banco.query('DELETE FROM campanhas WHERE id=ANY($1::bigint[])', [campanhaIds]);
    }
    if (contatoIds.length) await banco.query('DELETE FROM contatos WHERE id=ANY($1::bigint[])', [contatoIds]);
    if (templateId) {
      await banco.query('DELETE FROM historico_modelos_mensagem_meta WHERE modelo_id=$1', [templateId]);
      await banco.query('DELETE FROM modelos_mensagem WHERE id=$1', [templateId]);
    }
    await banco.end();
  }
}

executar().catch(function(erro){console.error(erro.stack || erro.message);process.exitCode=1;});
