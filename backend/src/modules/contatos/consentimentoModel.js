async function registrarRespostaSeDiferente(cliente, contatoId, autorizacao) {
  const consultaAtual = `
    SELECT
      id,
      resposta,
      texto_apresentado,
      versao_texto,
      canal,
      origem_id,
      estado,
      motivo_revogacao
    FROM consentimentos
    WHERE contato_id = $1
      AND tipo = $2
      AND ativo = TRUE
    FOR UPDATE
  `;
  const resultadoAtual = await cliente.query(consultaAtual, [
    contatoId,
    autorizacao.tipo
  ]);
  const atual = resultadoAtual.rows[0];

  if (
    atual &&
    atual.resposta === autorizacao.resposta &&
    atual.texto_apresentado === autorizacao.texto &&
    atual.versao_texto === autorizacao.versao &&
    atual.canal === autorizacao.canal &&
    Number(atual.origem_id) === Number(autorizacao.origemId) &&
    atual.estado === autorizacao.estado &&
    (atual.motivo_revogacao || null) === (autorizacao.motivoRevogacao || null)
  ) {
    return null;
  }

  if (atual) {
    await cliente.query(
      `
        UPDATE consentimentos
        SET ativo = FALSE,
            revogado_em = CASE
              WHEN $2 = 'revogado' THEN CURRENT_TIMESTAMP
              ELSE revogado_em
            END
        WHERE id = $1
      `,
      [atual.id, autorizacao.estado]
    );
  }

  const consultaInsercao = `
    INSERT INTO consentimentos (
      contato_id,
      tipo,
      resposta,
      texto_apresentado,
      versao_texto,
      canal,
      origem_registro,
      registrado_por_usuario_id,
      ativo,
      estado,
      origem_id,
      motivo_revogacao
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, $11)
    RETURNING id
  `;
  const valores = [
    contatoId,
    autorizacao.tipo,
    autorizacao.resposta,
    autorizacao.texto,
    autorizacao.versao,
    autorizacao.canal,
    autorizacao.origemRegistro,
    autorizacao.registradoPorUsuarioId,
    autorizacao.estado,
    autorizacao.origemId,
    autorizacao.motivoRevogacao || null
  ];
  const resultado = await cliente.query(consultaInsercao, valores);

  return resultado.rows[0];
}

async function buscarAtivosPorTipos(cliente, contatoId, tipos) {
  const resultado = await cliente.query(
    `
      SELECT
        id,
        tipo,
        resposta,
        texto_apresentado,
        versao_texto,
        origem_id,
        estado,
        motivo_revogacao
      FROM consentimentos
      WHERE contato_id = $1
        AND tipo = ANY($2::text[])
        AND ativo = TRUE
      ORDER BY id
      FOR UPDATE
    `,
    [contatoId, tipos]
  );

  return resultado.rows;
}

async function registrarAutorizacaoSeDiferente(cliente, contatoId, autorizacao) {
  return registrarRespostaSeDiferente(
    cliente,
    contatoId,
    Object.assign({}, autorizacao, {
      resposta: true,
      estado: 'autorizado',
      origemRegistro: 'resposta_expressa'
    })
  );
}

module.exports = {
  buscarAtivosPorTipos,
  registrarAutorizacaoSeDiferente,
  registrarRespostaSeDiferente
};
