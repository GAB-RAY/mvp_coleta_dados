async function registrarRespostaSeDiferente(cliente, contatoId, autorizacao) {
  const consultaAtual = `
    SELECT
      id,
      resposta,
      texto_apresentado,
      versao_texto,
      canal,
      origem_id,
      estado
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
    atual.estado === autorizacao.estado
  ) {
    return null;
  }

  if (atual) {
    await cliente.query(
      'UPDATE consentimentos SET ativo = FALSE WHERE id = $1',
      [atual.id]
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
      origem_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10)
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
    autorizacao.origemId
  ];
  const resultado = await cliente.query(consultaInsercao, valores);

  return resultado.rows[0];
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
  registrarAutorizacaoSeDiferente,
  registrarRespostaSeDiferente
};
