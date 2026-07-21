const banco = require('../../config/banco');
const consentimentoModel = require('./consentimentoModel');

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

async function criar(dadosDoContato) {
  const cliente = await banco.connect();
  let indice;

  try {
    await cliente.query('BEGIN');

    const consulta = `
      INSERT INTO contatos (
        nome,
        telefone,
        telefone_normalizado,
        bairro,
        problema,
        consentimento_armazenamento,
        consentimento_mensagens,
        consentimento_armazenamento_em,
        consentimento_mensagens_em,
        consentimento_tratamento_dados,
        consentimento_whatsapp,
        consentimento_ligacoes,
        consentimentos_atualizados_em,
        origem_atual,
        status_contato,
        bloqueado_para_mensagens,
        excluido_logicamente,
        atualizado_em
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        CURRENT_TIMESTAMP,
        CASE WHEN $7 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END,
        $8, $9, $10, CURRENT_TIMESTAMP, $11, $12, $13, FALSE,
        CURRENT_TIMESTAMP
      )
      RETURNING
        id,
        nome,
        telefone,
        bairro,
        problema,
        consentimento_armazenamento,
        consentimento_mensagens,
        consentimento_tratamento_dados,
        consentimento_whatsapp,
        consentimento_ligacoes,
        origem_atual,
        status_contato,
        bloqueado_para_mensagens,
        criado_em
    `;

    const valores = [
      dadosDoContato.nome,
      dadosDoContato.telefone,
      dadosDoContato.telefoneNormalizado,
      dadosDoContato.bairro,
      dadosDoContato.problema,
      dadosDoContato.consentimentoTratamentoDados,
      dadosDoContato.consentimentoWhatsapp,
      dadosDoContato.consentimentoTratamentoDados,
      dadosDoContato.consentimentoWhatsapp,
      dadosDoContato.consentimentoLigacoes,
      dadosDoContato.origemAtual,
      dadosDoContato.statusContato,
      dadosDoContato.bloqueadoParaMensagens
    ];

    const resultado = await cliente.query(consulta, valores);
    const contatoCriado = resultado.rows[0];

    for (indice = 0; indice < dadosDoContato.historicosConsentimento.length; indice += 1) {
      await consentimentoModel.criar(
        cliente,
        contatoCriado.id,
        dadosDoContato.historicosConsentimento[indice]
      );
    }

    await cliente.query('COMMIT');

    return contatoCriado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

function adicionarFiltroConsentimento(condicoes, valores, coluna, valor) {
  if (valor === undefined) {
    return;
  }

  if (valor === null) {
    condicoes.push(coluna + ' IS NULL');
    return;
  }

  valores.push(valor);
  condicoes.push(coluna + ' = $' + valores.length);
}

function construirFiltros(filtros) {
  const condicoes = [];
  const valores = [];

  if (filtros.nome) {
    valores.push('%' + filtros.nome + '%');
    condicoes.push('nome ILIKE $' + valores.length);
  }

  if (filtros.telefone) {
    valores.push('%' + filtros.telefone + '%');
    condicoes.push('telefone_normalizado LIKE $' + valores.length);
  }

  if (filtros.bairro) {
    valores.push('%' + filtros.bairro + '%');
    condicoes.push('bairro ILIKE $' + valores.length);
  }

  if (filtros.problema) {
    valores.push('%' + filtros.problema + '%');
    condicoes.push('problema ILIKE $' + valores.length);
  }

  adicionarFiltroConsentimento(
    condicoes,
    valores,
    'consentimento_whatsapp',
    filtros.consentimentoWhatsapp
  );
  adicionarFiltroConsentimento(
    condicoes,
    valores,
    'consentimento_ligacoes',
    filtros.consentimentoLigacoes
  );

  if (filtros.origem) {
    valores.push('%' + filtros.origem + '%');
    condicoes.push('origem_atual ILIKE $' + valores.length);
  }

  if (filtros.status) {
    valores.push('%' + filtros.status + '%');
    condicoes.push('status_contato ILIKE $' + valores.length);
  }

  const clausulaWhere = condicoes.length > 0
    ? 'WHERE ' + condicoes.join(' AND ')
    : '';

  return {
    clausulaWhere,
    valores
  };
}

async function listar(filtros, pagina, limite) {
  const filtrosSql = construirFiltros(filtros);
  const valores = filtrosSql.valores.slice();
  const deslocamento = (pagina - 1) * limite;
  const posicaoLimite = valores.length + 1;
  const posicaoDeslocamento = valores.length + 2;

  valores.push(limite);
  valores.push(deslocamento);

  const consulta = `
    SELECT
      id,
      nome,
      telefone,
      bairro,
      problema,
      consentimento_armazenamento,
      consentimento_mensagens,
      consentimento_tratamento_dados,
      consentimento_whatsapp,
      consentimento_ligacoes,
      origem_atual,
      status_contato,
      bloqueado_para_mensagens,
      criado_em
    FROM contatos
    ${filtrosSql.clausulaWhere}
    ORDER BY criado_em DESC
    LIMIT $${posicaoLimite}
    OFFSET $${posicaoDeslocamento}
  `;

  const resultado = await banco.query(consulta, valores);

  return resultado.rows;
}

async function contar(filtros) {
  const filtrosSql = construirFiltros(filtros);
  const consulta = `
    SELECT COUNT(*)::integer AS total
    FROM contatos
    ${filtrosSql.clausulaWhere}
  `;

  const resultado = await banco.query(consulta, filtrosSql.valores);

  return resultado.rows[0].total;
}

module.exports = {
  buscarPorTelefoneNormalizado,
  criar,
  listar,
  contar
};
