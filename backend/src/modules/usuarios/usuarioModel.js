const banco = require('../../config/banco');

async function buscarPorEmail(email) {
  const consulta = `
    SELECT id, nome, email, senha_hash, ativo
    FROM usuarios
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
  `;

  const resultado = await banco.query(consulta, [email]);

  return resultado.rows[0] || null;
}

async function criar(dadosDoUsuario) {
  const consulta = `
    INSERT INTO usuarios (nome, email, senha_hash)
    VALUES ($1, $2, $3)
    RETURNING id, nome, email, ativo, criado_em
  `;

  const valores = [
    dadosDoUsuario.nome,
    dadosDoUsuario.email,
    dadosDoUsuario.senhaHash
  ];

  const resultado = await banco.query(consulta, valores);

  return resultado.rows[0];
}

module.exports = {
  buscarPorEmail,
  criar
};
