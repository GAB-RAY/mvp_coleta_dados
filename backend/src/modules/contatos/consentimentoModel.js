async function criar(cliente, contatoId, historico) {
  const consulta = `
    INSERT INTO consentimentos (
      contato_id,
      tipo,
      resposta,
      texto_apresentado,
      versao_texto,
      canal,
      origem_registro,
      registrado_por_usuario_id,
      ativo
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
    RETURNING id
  `;

  const valores = [
    contatoId,
    historico.tipo,
    historico.resposta,
    historico.textoApresentado,
    historico.versaoTexto,
    historico.canal,
    historico.origemRegistro,
    historico.registradoPorUsuarioId
  ];

  const resultado = await cliente.query(consulta, valores);

  return resultado.rows[0];
}

module.exports = {
  criar
};
