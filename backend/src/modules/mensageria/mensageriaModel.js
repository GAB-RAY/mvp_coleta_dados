const banco = require('../../config/banco');
const ORDEM_STATUS = { pendente: 0, enviando: 1, enviada: 2, entregue: 3, lida: 4, falhou: 5 };

function avaliarTransicao(atual, novo) {
  if (atual === novo) return { deveAtualizar: false, motivo: 'status_repetido' };
  if (atual === 'falhou' || atual === 'lida') return { deveAtualizar: false, motivo: 'status_terminal' };
  if (novo === 'falhou') return { deveAtualizar: true };
  if (ORDEM_STATUS[novo] < ORDEM_STATUS[atual]) return { deveAtualizar: false, motivo: 'evento_atrasado' };
  return { deveAtualizar: true };
}

async function buscarTentativaPorIdentificador(cliente, identificadorExterno) {
  const resultado = await cliente.query(`
    SELECT tentativa.*, participacao.status AS participacao_status,
      participacao.id AS participacao_id
    FROM campanha_tentativas tentativa
    INNER JOIN campanha_participacoes participacao ON participacao.id = tentativa.participacao_id
    WHERE tentativa.identificador_externo = $1
    FOR UPDATE OF tentativa, participacao
  `, [identificadorExterno]);
  return resultado.rows[0] || null;
}

async function registrarEventoExterno(cliente, identificadorEvento, tipoEvento) {
  const resultado = await cliente.query(`
    INSERT INTO eventos_webhook_mensageria (identificador_externo, tipo_evento)
    VALUES ($1, $2)
    ON CONFLICT (identificador_externo) DO NOTHING
    RETURNING id
  `, [identificadorEvento, tipoEvento]);
  return Boolean(resultado.rows[0]);
}

async function registrarMensagemRecebida(identificadorExterno) {
  const resultado = await banco.query(`
    INSERT INTO eventos_webhook_mensageria (identificador_externo, tipo_evento)
    VALUES ($1, 'mensagem_recebida')
    ON CONFLICT (identificador_externo) DO NOTHING
    RETURNING id
  `, ['recebida:' + identificadorExterno]);
  return Boolean(resultado.rows[0]);
}

async function atualizarStatusPorIdentificador(dados) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const novoEvento = await registrarEventoExterno(cliente, dados.chaveEvento, dados.status);
    if (!novoEvento) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: 'evento_repetido' };
    }
    const tentativa = await buscarTentativaPorIdentificador(cliente, dados.identificadorExterno);
    if (!tentativa) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: 'tentativa_nao_encontrada' };
    }
    const transicao = avaliarTransicao(tentativa.status, dados.status);
    if (!transicao.deveAtualizar) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: transicao.motivo };
    }
    await cliente.query(`
      UPDATE campanha_tentativas
      SET status=$2::varchar, codigo_erro_externo=$3, titulo_erro=$4,
        descricao_erro=$5, categoria_erro=$6,
        permite_nova_tentativa=$7,
        finalizada_em=CASE WHEN $2::varchar IN ('lida','falhou') THEN CURRENT_TIMESTAMP ELSE finalizada_em END
      WHERE id=$1
    `, [tentativa.id, dados.status, dados.erro.codigo, dados.erro.titulo,
      dados.erro.descricao, dados.erro.categoria, dados.erro.permiteNovaTentativa]);
    await cliente.query(`
      UPDATE campanha_participacoes SET status=$2::varchar, atualizado_em=CURRENT_TIMESTAMP WHERE id=$1
    `, [tentativa.participacao_id, dados.status]);
    await cliente.query(`
      INSERT INTO historico_status_mensageria (
        participacao_id,tentativa_id,status_anterior,status_novo,origem,
        codigo_erro_sanitizado,descricao_erro_sanitizada
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [tentativa.participacao_id, tentativa.id, tentativa.status, dados.status,
      dados.origem, dados.erro.codigo, dados.erro.descricao]);
    await cliente.query('COMMIT');
    return { processado: true, participacaoId: tentativa.participacao_id };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function vincularIdentificadorExterno(tentativaId, identificadorExterno) {
  const resultado = await banco.query(`
    UPDATE campanha_tentativas SET identificador_externo=$2
    WHERE id=$1 AND identificador_externo IS NULL
    RETURNING *
  `, [tentativaId, identificadorExterno]);
  return resultado.rows[0] || null;
}

async function buscarTentativa(id) {
  const resultado = await banco.query(`
    SELECT tentativa.*, participacao.campanha_id, participacao.contato_id,
      participacao.lote_original_id
    FROM campanha_tentativas tentativa
    INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id
    WHERE tentativa.id=$1
  `, [id]);
  return resultado.rows[0] || null;
}

async function reprocessarFalha(tentativaId) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const atualResultado = await cliente.query(`
      SELECT tentativa.*, participacao.status AS participacao_status
      FROM campanha_tentativas tentativa
      INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id
      WHERE tentativa.id=$1
        AND NOT EXISTS (
          SELECT 1 FROM campanha_tentativas tentativa_nova
          WHERE tentativa_nova.participacao_id=tentativa.participacao_id
            AND tentativa_nova.numero_tentativa>tentativa.numero_tentativa
        )
      FOR UPDATE OF tentativa, participacao
    `, [tentativaId]);
    const atual = atualResultado.rows[0];
    if (!atual || atual.status !== 'falhou') {
      const erro = new Error('Tentativa nao encontrada ou nao esta com falha.');
      erro.codigo = 'REPROCESSAMENTO_INVALIDO';
      throw erro;
    }
    const proximoResultado = await cliente.query(`
      SELECT COALESCE(MAX(numero_tentativa),0)+1 AS numero
      FROM campanha_tentativas WHERE participacao_id=$1
    `, [atual.participacao_id]);
    const nova = await cliente.query(`
      INSERT INTO campanha_tentativas (participacao_id,numero_tentativa,status)
      VALUES ($1,$2,'pendente') RETURNING *
    `, [atual.participacao_id, proximoResultado.rows[0].numero]);
    await cliente.query("UPDATE campanha_participacoes SET status='pendente',atualizado_em=CURRENT_TIMESTAMP WHERE id=$1", [atual.participacao_id]);
    await cliente.query(`
      INSERT INTO historico_status_mensageria (participacao_id,tentativa_id,status_anterior,status_novo,origem)
      VALUES ($1,$2,'falhou','pendente','reprocessamento')
    `, [atual.participacao_id, nova.rows[0].id]);
    await cliente.query('COMMIT');
    return nova.rows[0];
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = { atualizarStatusPorIdentificador, buscarTentativa, registrarMensagemRecebida, reprocessarFalha, vincularIdentificadorExterno };
