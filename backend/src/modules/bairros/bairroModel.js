const banco = require('../../config/banco');

async function listarAtivos() {
  const resultado = await banco.query(
    `
      SELECT nome
      FROM bairros
      WHERE ativo = TRUE
      ORDER BY LOWER(nome), nome
    `
  );

  return resultado.rows;
}

module.exports = {
  listarAtivos
};
