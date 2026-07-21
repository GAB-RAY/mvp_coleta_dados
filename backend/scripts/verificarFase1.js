require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');

function afirmar(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

async function esperarFalhaDeConstraint(consulta, valores, codigoEsperado) {
  const cliente = await banco.connect();
  let codigoRecebido = '';

  try {
    await cliente.query('BEGIN');
    await cliente.query(consulta, valores);
  } catch (erro) {
    codigoRecebido = erro.code;
  } finally {
    await cliente.query('ROLLBACK');
    cliente.release();
  }

  afirmar(
    codigoRecebido === codigoEsperado,
    'A constraint não retornou o código PostgreSQL esperado.'
  );
}

async function testarValoresValidos() {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    await cliente.query(
      `
        UPDATE contatos
        SET idade = 16,
            participou_eleicao_anterior = 'sim'
        WHERE id = (SELECT id FROM contatos ORDER BY id LIMIT 1)
      `
    );
    await cliente.query(
      `
        UPDATE contatos
        SET idade = 120,
            participou_eleicao_anterior = 'prefiro_nao_informar'
        WHERE id = (SELECT id FROM contatos ORDER BY id LIMIT 1)
      `
    );
  } finally {
    await cliente.query('ROLLBACK');
    cliente.release();
  }
}

async function executar() {
  const resultados = await Promise.all([
    banco.query('SELECT current_database() AS banco'),
    banco.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
    ),
    banco.query(
      `
        SELECT nome_arquivo, checksum_sha256, baseline
        FROM schema_migrations
        ORDER BY nome_arquivo
      `
    ),
    banco.query(
      `
        SELECT nome, slug, tipo, ativa
        FROM origens
        WHERE slug = 'cadastro-legado'
      `
    ),
    banco.query(
      `
        SELECT
          COUNT(*)::integer AS total,
          COUNT(*) FILTER (WHERE origem_id IS NOT NULL)::integer AS com_origem,
          COUNT(*) FILTER (WHERE idade IS NULL)::integer AS idade_nula,
          COUNT(*) FILTER (
            WHERE participou_eleicao_anterior IS NULL
          )::integer AS eleicao_nula
        FROM contatos
      `
    ),
    banco.query(
      `
        SELECT
          (SELECT COUNT(*)::integer FROM usuarios) AS usuarios,
          (SELECT COUNT(*)::integer FROM consentimentos) AS consentimentos,
          (
            SELECT COUNT(*)::integer
            FROM consentimentos
            WHERE origem_registro = 'migracao_legado'
              AND versao_texto = 'legado_v1'
          ) AS legados,
          (
            SELECT COUNT(*)::integer
            FROM consentimentos
            WHERE tipo IN ('projetos_sociais', 'conteudo_politico')
          ) AS novos_consentimentos,
          (SELECT COUNT(*)::integer FROM historico_contatos) AS historicos
      `
    ),
    banco.query(
      `
        SELECT COUNT(*)::integer AS total
        FROM consentimentos AS consentimento
        LEFT JOIN contatos AS contato ON contato.id = consentimento.contato_id
        WHERE contato.id IS NULL
      `
    )
  ]);
  const bancoAtual = resultados[0].rows[0].banco;
  const tabelas = resultados[1].rows.map(function (item) {
    return item.table_name;
  });
  const migrations = resultados[2].rows;
  const origem = resultados[3].rows[0];
  const contatos = resultados[4].rows[0];
  const contagens = resultados[5].rows[0];
  const orfaos = resultados[6].rows[0].total;
  const nomesEsperados = [
    '003_consentimentos_publicos_e_listagem.sql',
    '004_criar_schema_migrations.sql',
    '005_criar_origens_e_vincular_contatos.sql',
    '006_adicionar_campos_publicos_contatos.sql',
    '007_criar_historico_contatos.sql',
    '008_privacidade_e_autorizacoes.sql',
    '009_adicionar_origem_cadastro_manual.sql',
    '010_criar_importacoes.sql'
  ];
  const nomesEncontrados = migrations.map(function (migration) {
    return migration.nome_arquivo;
  });

  afirmar(bancoAtual === 'criar_banco', 'O teste foi apontado para o banco incorreto.');
  afirmar(tabelas.includes('usuarios'), 'A tabela usuarios foi removida.');
  afirmar(tabelas.includes('contatos'), 'A tabela contatos foi removida.');
  afirmar(tabelas.includes('consentimentos'), 'A tabela consentimentos foi removida.');
  afirmar(tabelas.includes('schema_migrations'), 'O ledger não foi criado.');
  afirmar(tabelas.includes('origens'), 'A tabela origens não foi criada.');
  afirmar(tabelas.includes('historico_contatos'), 'A tabela de histórico não foi criada.');
  afirmar(tabelas.includes('textos_formulario'), 'A tabela de textos não foi criada.');
  afirmar(tabelas.includes('aceites_privacidade'), 'A tabela de privacidade não foi criada.');
  afirmar(tabelas.includes('importacoes'), 'A tabela de importações não foi criada.');
  afirmar(tabelas.includes('importacao_linhas'), 'A tabela de linhas importadas não foi criada.');
  afirmar(
    JSON.stringify(nomesEncontrados) === JSON.stringify(nomesEsperados),
    'O ledger não contém exatamente as migrations 003 a 010.'
  );
  afirmar(migrations[0].baseline === true, 'A migration 003 não é baseline.');
  afirmar(
    migrations.slice(1).every(function (migration) {
      return migration.baseline === false && /^[0-9a-f]{64}$/.test(migration.checksum_sha256);
    }),
    'As migrations executadas possuem baseline ou checksum inválido.'
  );
  afirmar(origem, 'A origem Cadastro legado não foi criada.');
  afirmar(origem.nome === 'Cadastro legado', 'O nome da origem está incorreto.');
  afirmar(origem.tipo === 'legado', 'O tipo da origem está incorreto.');
  afirmar(origem.ativa === true, 'A origem deveria estar ativa.');
  afirmar(contatos.total >= 4, 'Existem menos de quatro contatos.');
  afirmar(contatos.com_origem >= 4, 'Os contatos legados não receberam origem.');
  afirmar(contatos.idade_nula >= 4, 'A idade dos contatos antigos foi preenchida.');
  afirmar(contatos.eleicao_nula >= 4, 'A resposta eleitoral antiga foi preenchida.');
  afirmar(contagens.usuarios >= 1, 'Existem menos de um usuário.');
  afirmar(contagens.consentimentos >= 8, 'Existem menos de oito consentimentos.');
  afirmar(contagens.legados >= 8, 'Consentimentos legados foram alterados.');
  afirmar(contagens.novos_consentimentos === 0, 'Consentimentos novos foram criados.');
  afirmar(contagens.historicos === 0, 'Históricos retroativos foram criados.');
  afirmar(orfaos === 0, 'Existem consentimentos órfãos.');

  await testarValoresValidos();
  await esperarFalhaDeConstraint(
    `
      UPDATE contatos
      SET idade = $1
      WHERE id = (SELECT id FROM contatos ORDER BY id LIMIT 1)
    `,
    [15],
    '23514'
  );
  await esperarFalhaDeConstraint(
    `
      UPDATE contatos
      SET idade = $1
      WHERE id = (SELECT id FROM contatos ORDER BY id LIMIT 1)
    `,
    [121],
    '23514'
  );
  await esperarFalhaDeConstraint(
    `
      UPDATE contatos
      SET participou_eleicao_anterior = 'talvez'
      WHERE id = (SELECT id FROM contatos ORDER BY id LIMIT 1)
    `,
    [],
    '23514'
  );
  await esperarFalhaDeConstraint(
    `
      INSERT INTO origens (nome, slug, tipo)
      VALUES ('Origem duplicada', 'cadastro-legado', 'legado')
    `,
    [],
    '23505'
  );
  await esperarFalhaDeConstraint(
    `
      INSERT INTO historico_contatos (contato_id, tipo_evento)
      VALUES ((SELECT id FROM contatos ORDER BY id LIMIT 1), 'teste')
    `,
    [],
    '23514'
  );

  console.log('PASS banco criar_banco e tabelas preservadas');
  console.log('PASS ledger 003 a 010, baseline e checksums');
  console.log('PASS origem legada e vínculo dos contatos existentes');
  console.log('PASS novos campos nulos nos registros antigos');
  console.log('PASS constraints de idade, eleição, origem e histórico');
  console.log('PASS nenhum consentimento convertido ou criado');
  console.log(
    'Estado validado: ' +
    JSON.stringify({
      contatos: contatos.total,
      usuarios: contagens.usuarios,
      consentimentos: contagens.consentimentos,
      consentimentosLegados: contagens.legados,
      historicos: contagens.historicos
    })
  );
}

executar()
  .catch(function (erro) {
    console.error('Falha na validação da Fase 1: ' + erro.message);
    process.exitCode = 1;
  })
  .finally(function () {
    return banco.end();
  });
