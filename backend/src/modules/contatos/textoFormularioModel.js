async function buscarAtivos(cliente) {
  const consulta = `
    SELECT id, tipo, versao, texto
    FROM textos_formulario
    WHERE ativo = TRUE
      AND tipo = ANY($1::text[])
    ORDER BY tipo
  `;
  const tipos = ['aviso_privacidade', 'mensagens', 'ligacoes'];
  const resultado = await cliente.query(consulta, [tipos]);
  const textosPorTipo = {};

  resultado.rows.forEach(function (texto) {
    textosPorTipo[texto.tipo] = texto;
  });

  return textosPorTipo;
}

module.exports = {
  buscarAtivos
};
