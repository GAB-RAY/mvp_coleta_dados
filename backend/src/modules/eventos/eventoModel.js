const banco = require('../../config/banco');
const configuracaoEvento = require('../../config/evento');
const formatarDataRio = require('../../utils/formatarDataRio');

function selecionarCampos() {
  return `
    SELECT
      evento.id,
      evento.nome,
      evento.motivo,
      evento.data_inicial,
      evento.data_final,
      evento.status,
      evento.criado_em,
      evento.atualizado_em,
      criador.nome AS criado_por,
      atualizador.nome AS atualizado_por,
      COUNT(contato_evento.id)::integer AS total_cadastros
    FROM eventos AS evento
    INNER JOIN usuarios AS criador ON criador.id = evento.criado_por_usuario_id
    INNER JOIN usuarios AS atualizador ON atualizador.id = evento.atualizado_por_usuario_id
    LEFT JOIN contato_eventos AS contato_evento ON contato_evento.evento_id = evento.id
  `;
}

async function listar() {
  const resultado = await banco.query(
    selecionarCampos() + `
      GROUP BY evento.id, criador.nome, atualizador.nome
      ORDER BY evento.data_inicial DESC, evento.id DESC
    `
  );

  return resultado.rows;
}

async function buscarAtivo(clienteRecebido) {
  const executor = clienteRecebido || banco;
  const resultado = await executor.query(
    `
      SELECT id, nome, motivo, data_inicial, data_final, status
      FROM eventos
      WHERE status = 'ativo'
        AND (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN data_inicial AND data_final
      LIMIT 1
    `
  );

  return resultado.rows[0] || null;
}

async function registrarHistorico(cliente, eventoId, tipoAcao, anteriores, novos, usuarioId) {
  await cliente.query(
    `
      INSERT INTO historico_eventos (
        evento_id, tipo_acao, dados_anteriores, dados_novos, usuario_id
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [eventoId, tipoAcao, anteriores, novos, usuarioId]
  );
}

async function criar(dados, usuarioId) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(
      `
        INSERT INTO eventos (
          nome, motivo, data_inicial, data_final, status,
          criado_por_usuario_id, atualizado_por_usuario_id
        )
        VALUES ($1, $2, $3, $4, 'rascunho', $5, $5)
        RETURNING *
      `,
      [dados.nome, dados.motivo, dados.dataInicial, dados.dataFinal, usuarioId]
    );
    const evento = resultado.rows[0];

    await registrarHistorico(cliente, evento.id, 'criacao', null, evento, usuarioId);
    await cliente.query('COMMIT');
    return evento;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function editar(id, dados, usuarioId) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    await cliente.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [configuracaoEvento.CHAVE_BLOQUEIO_1, configuracaoEvento.CHAVE_BLOQUEIO_2]
    );
    const atual = await cliente.query('SELECT * FROM eventos WHERE id = $1 FOR UPDATE', [id]);

    if (!atual.rows[0]) {
      await cliente.query('ROLLBACK');
      return null;
    }

    const resultado = await cliente.query(
      `
        UPDATE eventos
        SET nome = $2,
            motivo = $3,
            data_inicial = $4,
            data_final = $5,
            atualizado_por_usuario_id = $6
        WHERE id = $1
        RETURNING *
      `,
      [id, dados.nome, dados.motivo, dados.dataInicial, dados.dataFinal, usuarioId]
    );
    await registrarHistorico(
      cliente,
      id,
      'edicao',
      atual.rows[0],
      resultado.rows[0],
      usuarioId
    );
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function alterarStatus(id, novoStatus, usuarioId) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    await cliente.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [configuracaoEvento.CHAVE_BLOQUEIO_1, configuracaoEvento.CHAVE_BLOQUEIO_2]
    );
    const atual = await cliente.query('SELECT * FROM eventos WHERE id = $1 FOR UPDATE', [id]);

    if (!atual.rows[0]) {
      await cliente.query('ROLLBACK');
      return null;
    }

    if (novoStatus === 'ativo') {
      const dataAtual = formatarDataRio(new Date());
      const dataInicial = new Date(atual.rows[0].data_inicial).toISOString().slice(0, 10);
      const dataFinal = new Date(atual.rows[0].data_final).toISOString().slice(0, 10);

      if (dataAtual < dataInicial || dataAtual > dataFinal) {
        const erroPeriodo = new Error('O evento só pode ser ativado dentro do período informado.');
        erroPeriodo.codigoAplicacao = 'EVENTO_FORA_PERIODO';
        throw erroPeriodo;
      }

      const encerrados = await cliente.query(
        `
          UPDATE eventos
          SET status = 'encerrado', atualizado_por_usuario_id = $1
          WHERE status = 'ativo' AND id <> $2
          RETURNING *
        `,
        [usuarioId, id]
      );
      let indice;
      for (indice = 0; indice < encerrados.rows.length; indice += 1) {
        await registrarHistorico(
          cliente,
          encerrados.rows[indice].id,
          'encerramento',
          Object.assign({}, encerrados.rows[indice], { status: 'ativo' }),
          encerrados.rows[indice],
          usuarioId
        );
      }
    }

    const resultado = await cliente.query(
      `
        UPDATE eventos
        SET status = $2, atualizado_por_usuario_id = $3
        WHERE id = $1
        RETURNING *
      `,
      [id, novoStatus, usuarioId]
    );
    await registrarHistorico(
      cliente,
      id,
      novoStatus === 'ativo' ? 'ativacao' : 'encerramento',
      atual.rows[0],
      resultado.rows[0],
      usuarioId
    );
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = {
  alterarStatus,
  buscarAtivo,
  criar,
  editar,
  listar
};
