const express = require('express');
const banco = require('../../config/banco');

const roteador = express.Router();

const ESTRUTURA_CRITICA = [
  ['usuarios', 'ativo'],
  ['contatos', 'telefone_normalizado'],
  ['bairros', 'ativo'],
  ['origens', 'ativa'],
  ['consentimentos', 'estado'],
  ['aceites_privacidade', 'contato_id'],
  ['eventos', 'status'],
  ['contato_eventos', 'evento_id'],
  ['importacoes', 'status'],
  ['importacao_linhas', 'importacao_id'],
  ['modelos_mensagem', 'ativo'],
  ['campanhas', 'status'],
  ['campanha_lotes', 'campanha_id'],
  ['campanha_participacoes', 'contato_id'],
  ['campanha_tentativas', 'participacao_id'],
  ['solicitacoes_exclusao', 'status'],
  ['backups_banco', 'id'],
  ['schema_migrations', 'checksum_sha256']
];

async function verificarEstruturaCritica() {
  const tabelas = ESTRUTURA_CRITICA.map(function (item) {
    return item[0];
  });
  const colunas = ESTRUTURA_CRITICA.map(function (item) {
    return item[1];
  });
  const ausentes = await banco.query(
    `
      WITH esperadas AS (
        SELECT *
        FROM unnest($1::text[], $2::text[]) AS item(tabela, coluna)
      )
      SELECT esperadas.tabela, esperadas.coluna
      FROM esperadas
      LEFT JOIN information_schema.columns AS atual
        ON atual.table_schema = 'public'
        AND atual.table_name = esperadas.tabela
        AND atual.column_name = esperadas.coluna
      WHERE atual.column_name IS NULL
      ORDER BY esperadas.tabela, esperadas.coluna
    `,
    [tabelas, colunas]
  );

  if (ausentes.rowCount > 0) {
    const itensAusentes = ausentes.rows.map(function (item) {
      return item.tabela + '.' + item.coluna;
    });

    throw new Error('Estrutura critica incompleta: ' + itensAusentes.join(', ') + '.');
  }
}

roteador.get('/saude/vivo', function (requisicao, resposta) {
  resposta.setHeader('Cache-Control', 'no-store');
  return resposta.status(200).json({
    mensagem: 'Aplicação em execução.'
  });
});

roteador.get('/saude/pronto', async function (requisicao, resposta) {
  resposta.setHeader('Cache-Control', 'no-store');

  try {
    await verificarEstruturaCritica();
    return resposta.status(200).json({
      mensagem: 'Aplicação pronta para receber tráfego.'
    });
  } catch (erro) {
    console.error('Erro na verificação de prontidão:', erro.message);
    return resposta.status(503).json({
      mensagem: 'Aplicação temporariamente indisponível.'
    });
  }
});

roteador.get('/teste', async function (requisicao, resposta) {
  resposta.setHeader('Cache-Control', 'no-store');
  try {
    await banco.query('SELECT 1');

    resposta.status(200).json({
      sucesso: true,
      mensagem: 'API e banco de dados conectados.'
    });
  } catch (erro) {
    console.error('Erro ao testar a conexão com o banco:', erro.message);

    resposta.status(500).json({
      sucesso: false,
      mensagem: 'Não foi possível conectar ao banco de dados.'
    });
  }
});

module.exports = roteador;
