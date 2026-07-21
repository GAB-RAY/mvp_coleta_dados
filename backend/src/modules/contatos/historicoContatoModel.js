async function registrar(cliente, contatoId, historico) {
  const consulta = `
    INSERT INTO historico_contatos (
      contato_id,
      tipo_evento,
      dados_anteriores,
      dados_novos,
      origem_id,
      registrado_por_usuario_id
    )
    VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
    RETURNING id
  `;
  const valores = [
    contatoId,
    historico.tipoEvento,
    JSON.stringify(historico.dadosAnteriores),
    JSON.stringify(historico.dadosNovos),
    historico.origemId,
    historico.registradoPorUsuarioId
  ];
  const resultado = await cliente.query(consulta, valores);

  return resultado.rows[0];
}

module.exports = {
  registrar
};
