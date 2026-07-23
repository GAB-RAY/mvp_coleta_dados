const banco = require('../../config/banco');
const historicoContatoModel = require('../contatos/historicoContatoModel');

async function obterOuCriarOrigem(cliente, nome, slugBase) {
  const existente = await cliente.query(
    `
      SELECT id, nome
      FROM origens
      WHERE LOWER(nome) = LOWER($1)
        AND tipo = 'importacao'
      LIMIT 1
    `,
    [nome]
  );

  if (existente.rows[0]) {
    return existente.rows[0];
  }

  let slug = slugBase;
  let tentativa = 0;

  while (tentativa < 5) {
    const insercao = await cliente.query(
      `
        INSERT INTO origens (nome, slug, tipo, ativa)
        VALUES ($1, $2, 'importacao', TRUE)
        ON CONFLICT DO NOTHING
        RETURNING id, nome
      `,
      [nome, slug]
    );

    if (insercao.rows[0]) {
      return insercao.rows[0];
    }

    tentativa += 1;
    slug = slugBase + '-' + tentativa;
  }

  throw new Error('Não foi possível criar uma origem para a importação.');
}

async function criarPreVisualizacao(dados, linhas) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const origem = await obterOuCriarOrigem(cliente, dados.nomeOrigem, dados.slugOrigem);
    const importacao = await cliente.query(
      `
        INSERT INTO importacoes (
          nome_arquivo, formato, origem_id, usuario_id, total_recebido
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [dados.nomeArquivo, dados.formato, origem.id, dados.usuarioId, linhas.length]
    );
    let indice;

    for (indice = 0; indice < linhas.length; indice += 1) {
      const linha = linhas[indice];
      await cliente.query(
        `
          INSERT INTO importacao_linhas (
            importacao_id, numero_linha, dados, valida, erro_validacao, resultado
          )
          VALUES ($1, $2, $3::jsonb, $4, $5, $6)
        `,
        [
          importacao.rows[0].id,
          linha.numeroLinha,
          JSON.stringify(linha.dados),
          linha.valida,
          linha.erroValidacao,
          linha.resultado
        ]
      );
    }

    await cliente.query('COMMIT');

    return {
      id: importacao.rows[0].id,
      origem
    };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

function valorVazio(valor) {
  return valor === null || valor === undefined || (
    typeof valor === 'string' && valor.trim() === ''
  );
}

async function criarContatoImportado(cliente, dados, origem) {
  const resultado = await cliente.query(
    `
      INSERT INTO contatos (
        nome, telefone, telefone_normalizado, bairro, problema,
        consentimento_armazenamento, consentimento_mensagens,
        consentimento_armazenamento_em, consentimento_mensagens_em,
        consentimento_tratamento_dados, consentimento_whatsapp,
        consentimento_ligacoes, origem_atual, status_contato,
        bloqueado_para_mensagens, atualizado_em,
        origem_id, idade, descricao_problema, participou_eleicao_anterior
      )
      VALUES (
        $1, $2, $3, $4, $5,
        TRUE, FALSE, CURRENT_TIMESTAMP, NULL,
        NULL, NULL, NULL, $6, 'importado',
        FALSE, CURRENT_TIMESTAMP,
        $7, $8, $9, $10
      )
      ON CONFLICT (telefone_normalizado) DO NOTHING
      RETURNING id
    `,
    [
      dados.nome,
      dados.telefone,
      dados.telefoneNormalizado,
      dados.bairro,
      dados.problema,
      origem.nome,
      origem.id,
      dados.idade,
      dados.descricaoProblema,
      dados.participouEleicaoAnterior
    ]
  );

  return resultado.rows[0] || null;
}

async function complementarContatoImportado(cliente, contato, dados, origem, usuarioId) {
  const campos = [
    { coluna: 'nome', propriedade: 'nome' },
    { coluna: 'bairro', propriedade: 'bairro' },
    { coluna: 'problema', propriedade: 'problema' },
    { coluna: 'idade', propriedade: 'idade' },
    { coluna: 'descricao_problema', propriedade: 'descricaoProblema' },
    { coluna: 'participou_eleicao_anterior', propriedade: 'participouEleicaoAnterior' }
  ];
  const atribuicoes = [];
  const valores = [];
  const anteriores = {};
  const novos = {};

  campos.forEach(function (campo) {
    if (valorVazio(contato[campo.coluna]) && !valorVazio(dados[campo.propriedade])) {
      valores.push(dados[campo.propriedade]);
      atribuicoes.push(campo.coluna + ' = $' + valores.length);
      anteriores[campo.propriedade] = contato[campo.coluna];
      novos[campo.propriedade] = dados[campo.propriedade];
    }
  });

  if (atribuicoes.length === 0) {
    return [];
  }

  valores.push(contato.id);
  atribuicoes.push('atualizado_em = CURRENT_TIMESTAMP');
  await cliente.query(
    'UPDATE contatos SET ' + atribuicoes.join(', ') + ' WHERE id = $' + valores.length,
    valores
  );
  await historicoContatoModel.registrar(cliente, contato.id, {
    tipoEvento: 'complemento_importacao',
    dadosAnteriores: anteriores,
    dadosNovos: novos,
    origemId: origem.id,
    registradoPorUsuarioId: usuarioId
  });

  return Object.keys(novos);
}

async function confirmar(importacaoId, usuarioId) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const importacao = await cliente.query(
      `
        SELECT importacao.*, origem.nome AS origem_nome
        FROM importacoes AS importacao
        INNER JOIN origens AS origem ON origem.id = importacao.origem_id
        WHERE importacao.id = $1
        FOR UPDATE
      `,
      [importacaoId]
    );

    if (!importacao.rows[0]) {
      const erro = new Error('Importação não encontrada.');
      erro.codigoAplicacao = 'IMPORTACAO_NAO_ENCONTRADA';
      throw erro;
    }

    if (importacao.rows[0].status !== 'pre_visualizada') {
      const erro = new Error('Importação já processada.');
      erro.codigoAplicacao = 'IMPORTACAO_PROCESSADA';
      throw erro;
    }

    await cliente.query(
      "UPDATE importacoes SET status = 'processando' WHERE id = $1",
      [importacaoId]
    );
    const linhas = await cliente.query(
      'SELECT * FROM importacao_linhas WHERE importacao_id = $1 ORDER BY numero_linha',
      [importacaoId]
    );
    const relatorio = {
      totalRecebido: linhas.rowCount,
      criados: 0,
      complementados: 0,
      ignorados: 0,
      duplicados: 0,
      invalidos: 0,
      erros: []
    };
    const origem = {
      id: importacao.rows[0].origem_id,
      nome: importacao.rows[0].origem_nome
    };
    let indice;

    for (indice = 0; indice < linhas.rows.length; indice += 1) {
      const linha = linhas.rows[indice];

      if (!linha.valida) {
        const resultadoInvalido = linha.resultado === 'duplicado' ? 'duplicado' : 'invalido';
        relatorio[resultadoInvalido === 'duplicado' ? 'duplicados' : 'invalidos'] += 1;
        relatorio.erros.push({ linha: linha.numero_linha, erro: linha.erro_validacao });
        continue;
      }

      await cliente.query('SAVEPOINT processar_linha');

      try {
        const dados = linha.dados;
        let contatoCriado = await criarContatoImportado(cliente, dados, origem);
        let contatoId;
        let resultadoLinha;

        if (contatoCriado) {
          contatoId = contatoCriado.id;
          resultadoLinha = 'criado';
          relatorio.criados += 1;
        } else {
          const existente = await cliente.query(
            'SELECT * FROM contatos WHERE telefone_normalizado = $1 FOR UPDATE',
            [dados.telefoneNormalizado]
          );
          const campos = await complementarContatoImportado(
            cliente,
            existente.rows[0],
            dados,
            origem,
            usuarioId
          );
          contatoId = existente.rows[0].id;
          resultadoLinha = campos.length > 0 ? 'complementado' : 'ignorado';
          relatorio[campos.length > 0 ? 'complementados' : 'ignorados'] += 1;
        }

        await cliente.query(
          'UPDATE importacao_linhas SET resultado = $1, contato_id = $2 WHERE id = $3',
          [resultadoLinha, contatoId, linha.id]
        );
        await cliente.query('RELEASE SAVEPOINT processar_linha');
      } catch (erroLinha) {
        await cliente.query('ROLLBACK TO SAVEPOINT processar_linha');
        relatorio.erros.push({ linha: linha.numero_linha, erro: erroLinha.message });
        await cliente.query(
          "UPDATE importacao_linhas SET resultado = 'erro', erro_validacao = $1 WHERE id = $2",
          [erroLinha.message, linha.id]
        );
        await cliente.query('RELEASE SAVEPOINT processar_linha');
      }
    }

    await cliente.query(
      `
        UPDATE importacoes
        SET status = 'concluida', relatorio = $1::jsonb, confirmado_em = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [JSON.stringify(relatorio), importacaoId]
    );
    await cliente.query('COMMIT');

    return relatorio;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = {
  criarPreVisualizacao,
  confirmar
};
