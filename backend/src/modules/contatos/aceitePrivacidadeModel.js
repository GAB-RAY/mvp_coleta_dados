async function registrarSeDiferente(cliente, contatoId, aceite) {
  const consulta = `
    INSERT INTO aceites_privacidade (
      contato_id,
      aceito,
      texto_apresentado,
      versao_texto,
      origem_id,
      canal,
      registrado_por_usuario_id
    )
    VALUES ($1, TRUE, $2, $3, $4, $5, $6)
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  const valores = [
    contatoId,
    aceite.texto,
    aceite.versao,
    aceite.origemId,
    aceite.canal,
    aceite.registradoPorUsuarioId
  ];
  const resultado = await cliente.query(consulta, valores);

  return resultado.rows[0] || null;
}

module.exports = {
  registrarSeDiferente
};
