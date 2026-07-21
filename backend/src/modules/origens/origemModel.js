const banco = require('../../config/banco');

async function listarAtivas() {
  const resultado = await banco.query(
    `
      SELECT id, nome, slug, tipo
      FROM origens
      WHERE ativa = TRUE
      ORDER BY nome
    `
  );

  return resultado.rows;
}

module.exports = {
  listarAtivas
};
