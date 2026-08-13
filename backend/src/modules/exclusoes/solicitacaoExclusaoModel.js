const banco = require('../../config/banco');

async function solicitar(contatoId, usuarioId, observacoes) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const contatoEncontrado = await cliente.query(
      'SELECT id FROM contatos WHERE id = $1 FOR UPDATE',
      [contatoId]
    );

    if (!contatoEncontrado.rows[0]) {
      await cliente.query('ROLLBACK');
      return null;
    }

    const existente = await cliente.query(
      `
        SELECT id, solicitada_em, solicitada_por_usuario_id
        FROM solicitacoes_exclusao
        WHERE contato_id = $1 AND status = 'pendente'
        FOR UPDATE
      `,
      [contatoId]
    );

    if (existente.rows[0]) {
      await cliente.query('COMMIT');
      return Object.assign({ alterado: false }, existente.rows[0]);
    }

    const resultado = await cliente.query(
      `
        INSERT INTO solicitacoes_exclusao (
          contato_id, contato_id_original, solicitada_por_usuario_id, observacoes
        )
        VALUES ($1, $1, $2, $3)
        RETURNING id, solicitada_em, solicitada_por_usuario_id
      `,
      [contatoId, usuarioId, observacoes]
    );

    await cliente.query(
      `
        UPDATE contatos
        SET bloqueado_para_mensagens = TRUE,
            bloqueado_para_ligacoes = TRUE
        WHERE id = $1
      `,
      [contatoId]
    );
    await cliente.query('COMMIT');
    return Object.assign({ alterado: true }, resultado.rows[0]);
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function listar(status) {
  const valores = [];
  let condicao = '';

  if (status) {
    valores.push(status);
    condicao = 'WHERE solicitacao.status = $1';
  }

  const resultado = await banco.query(
    `
      SELECT
        solicitacao.id,
        solicitacao.contato_id,
        solicitacao.contato_id_original,
        solicitacao.status,
        solicitacao.observacoes,
        solicitacao.solicitada_em,
        solicitacao.analisada_em,
        solicitacao.executada_em,
        contato.nome AS contato_nome,
        contato.telefone AS contato_telefone,
        solicitante.nome AS solicitada_por,
        analista.nome AS analisada_por
      FROM solicitacoes_exclusao AS solicitacao
      LEFT JOIN contatos AS contato ON contato.id = solicitacao.contato_id
      INNER JOIN usuarios AS solicitante
        ON solicitante.id = solicitacao.solicitada_por_usuario_id
      LEFT JOIN usuarios AS analista
        ON analista.id = solicitacao.analisada_por_usuario_id
      ${condicao}
      ORDER BY solicitacao.solicitada_em DESC, solicitacao.id DESC
    `,
    valores
  );

  return resultado.rows;
}

async function rejeitar(id, usuarioId, observacoes) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const atual = await cliente.query(
      `
        SELECT * FROM solicitacoes_exclusao
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );
    const solicitacao = atual.rows[0];

    if (!solicitacao) {
      await cliente.query('ROLLBACK');
      return null;
    }

    if (solicitacao.status !== 'pendente') {
      const erro = new Error('A solicitação já foi analisada.');
      erro.codigoAplicacao = 'SOLICITACAO_ANALISADA';
      throw erro;
    }

    await cliente.query(
      `
        UPDATE solicitacoes_exclusao
        SET status = 'rejeitada',
            analisada_por_usuario_id = $2,
            analisada_em = CURRENT_TIMESTAMP,
            observacoes = COALESCE($3, observacoes)
        WHERE id = $1
      `,
      [id, usuarioId, observacoes]
    );
    await cliente.query(
      `
        UPDATE contatos AS contato
        SET bloqueado_para_mensagens = EXISTS (
              SELECT 1 FROM consentimentos AS consentimento
              WHERE consentimento.contato_id = contato.id
                AND consentimento.tipo = 'mensagens'
                AND consentimento.ativo = TRUE
                AND (
                  consentimento.estado IN ('recusado', 'revogado')
                  OR consentimento.resposta = FALSE
                )
            ),
            bloqueado_para_ligacoes = EXISTS (
              SELECT 1 FROM consentimentos AS consentimento
              WHERE consentimento.contato_id = contato.id
                AND consentimento.tipo = 'ligacoes'
                AND consentimento.ativo = TRUE
                AND (
                  consentimento.estado IN ('recusado', 'revogado')
                  OR consentimento.resposta = FALSE
                )
            )
        WHERE contato.id = $1
      `,
      [solicitacao.contato_id]
    );
    await cliente.query('COMMIT');
    return { id, status: 'rejeitada' };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function aprovar(id, usuarioId, observacoes) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const atual = await cliente.query(
      `
        SELECT * FROM solicitacoes_exclusao
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );
    const solicitacao = atual.rows[0];

    if (!solicitacao) {
      await cliente.query('ROLLBACK');
      return null;
    }

    if (solicitacao.status !== 'pendente') {
      const erro = new Error('A solicitação já foi analisada.');
      erro.codigoAplicacao = 'SOLICITACAO_ANALISADA';
      throw erro;
    }

    await cliente.query(
      `
        UPDATE solicitacoes_exclusao
        SET status = 'aprovada',
            analisada_por_usuario_id = $2,
            analisada_em = CURRENT_TIMESTAMP,
            executada_em = CURRENT_TIMESTAMP,
            observacoes = COALESCE($3, observacoes)
        WHERE id = $1
      `,
      [id, usuarioId, observacoes]
    );
    const exclusao = await cliente.query(
      'DELETE FROM contatos WHERE id = $1 RETURNING id',
      [solicitacao.contato_id]
    );

    if (!exclusao.rows[0]) {
      const erroContato = new Error('O contato da solicitação não existe mais.');
      erroContato.codigoAplicacao = 'CONTATO_AUSENTE';
      throw erroContato;
    }

    await cliente.query('COMMIT');
    return { id, status: 'aprovada', contatoIdExcluido: exclusao.rows[0].id };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = { aprovar, listar, rejeitar, solicitar };
