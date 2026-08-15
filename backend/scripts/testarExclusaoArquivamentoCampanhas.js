require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');
const campanhaService = require('../src/modules/campanhas/campanhaService');
const autorizarAdministrador = require('../src/middlewares/autorizarAdministrador');

let verificacoes = 0;
function confirmar(condicao, mensagem) { if (!condicao) throw new Error(mensagem); verificacoes += 1; }

async function executar() {
  const marca = 'QA_EXCLUSAO_CAMPANHA_' + Date.now();
  const campanhaIds = [];
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
    await banco.query(`INSERT INTO campanha_lotes
      (campanha_id,tamanho_solicitado,tamanho_efetivo,ordem,status,chave_idempotencia,criado_por_usuario_id)
      VALUES ($1,1,1,1,'processado',$2,$3)`, [historica.id, marca, usuario.id]);
    const arquivamento = await campanhaService.excluirOuArquivar(historica.id, usuario);
    confirmar(arquivamento.acao === 'arquivada' && arquivamento.repetido === false, 'Campanha com historico deveria ser arquivada.');
    const persistida = (await banco.query('SELECT arquivada_em,arquivada_por_usuario_id FROM campanhas WHERE id=$1', [historica.id])).rows[0];
    confirmar(Boolean(persistida.arquivada_em) && Number(persistida.arquivada_por_usuario_id) === Number(usuario.id), 'Arquivamento nao registrou data e administrador.');
    confirmar(Number((await banco.query('SELECT COUNT(*)::int total FROM campanha_lotes WHERE campanha_id=$1', [historica.id])).rows[0].total) === 1, 'Historico operacional foi removido.');
    confirmar(!(await campanhaService.listar(false)).some(function(item){return Number(item.id)===Number(historica.id);}), 'Campanha arquivada permaneceu na listagem principal.');
    confirmar((await campanhaService.listar(true)).some(function(item){return Number(item.id)===Number(historica.id)&&Boolean(item.arquivada_em);}), 'Filtro de arquivadas nao retornou a campanha.');
    const repetido = await campanhaService.excluirOuArquivar(historica.id, usuario);
    confirmar(repetido.acao === 'arquivada' && repetido.repetido === true, 'Arquivamento repetido nao foi idempotente.');
    let erroOperador;
    autorizarAdministrador({ usuario: { perfil: 'operador' } }, {}, function(erro){erroOperador=erro;});
    confirmar(erroOperador && erroOperador.statusHttp === 403, 'Operador conseguiu acessar a exclusao administrativa.');
    let erroStatus;
    try { await campanhaService.alterarStatus(historica.id, 'pronta', usuario); } catch (erro) { erroStatus = erro; }
    confirmar(erroStatus && erroStatus.statusHttp === 409, 'Campanha arquivada aceitou alteracao de status.');
    console.log('Exclusao e arquivamento de campanhas: ' + verificacoes + ' verificacoes aprovadas.');
  } finally {
    if (campanhaIds.length) {
      await banco.query('DELETE FROM campanha_lotes WHERE campanha_id=ANY($1::bigint[])', [campanhaIds]);
      await banco.query('DELETE FROM campanhas WHERE id=ANY($1::bigint[])', [campanhaIds]);
    }
    if (templateId) {
      await banco.query('DELETE FROM historico_modelos_mensagem_meta WHERE modelo_id=$1', [templateId]);
      await banco.query('DELETE FROM modelos_mensagem WHERE id=$1', [templateId]);
    }
    await banco.end();
  }
}

executar().catch(function(erro){console.error(erro.stack || erro.message);process.exitCode=1;});
