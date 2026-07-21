const origemModel = require('./origemModel');

async function listarOrigens() {
  const origens = await origemModel.listarAtivas();

  return origens.map(function (origem) {
    return {
      id: origem.id,
      nome: origem.nome,
      slug: origem.slug,
      tipo: origem.tipo
    };
  });
}

module.exports = {
  listarOrigens
};
