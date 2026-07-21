const banco = require('../../config/banco');

async function buscarPorTelefoneNormalizado(telefoneNormalizado) {
  const consulta = `
    SELECT id
    FROM contatos
    WHERE telefone_normalizado = $1
    LIMIT 1
  `;

  const resultado = await banco.query(consulta, [telefoneNormalizado]);

  return resultado.rows[0] || null;
}

async function criarContato(dadosContato) {
  const consulta = `
    INSERT INTO contatos (
      nome,
      telefone,
      telefone_normalizado,
      bairro,
      problema,
      consentimento_armazenamento,
      consentimento_mensagens,
      consentimento_mensagens_em
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7,
      CASE WHEN $7 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END
    )
    RETURNING
      id,
      nome,
      telefone,
      bairro,
      problema,
      consentimento_armazenamento AS "consentimentoArmazenamento",
      consentimento_mensagens AS "consentimentoMensagens",
      criado_em AS "criadoEm"
  `;

  const valores = [
    dadosContato.nome,
    dadosContato.telefone,
    dadosContato.telefoneNormalizado,
    dadosContato.bairro,
    dadosContato.problema,
    dadosContato.consentimentoArmazenamento,
    dadosContato.consentimentoMensagens
  ];

  const resultado = await banco.query(consulta, valores);

  return resultado.rows[0];
}

module.exports = {
  buscarPorTelefoneNormalizado,
  criarContato
};
