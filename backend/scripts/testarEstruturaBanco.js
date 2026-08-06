require('dotenv').config({ quiet: true });

const banco = require('../src/config/banco');

let totalVerificacoes = 0;
let numeroSavepoint = 0;

function verificar(condicao, mensagem) {
  totalVerificacoes += 1;

  if (!condicao) {
    throw new Error(mensagem);
  }
}

async function esperarErro(cliente, consulta, valores, codigoEsperado) {
  numeroSavepoint += 1;
  const nomeSavepoint = 'teste_erro_' + numeroSavepoint;

  await cliente.query('SAVEPOINT ' + nomeSavepoint);

  try {
    await cliente.query(consulta, valores || []);
  } catch (erro) {
    await cliente.query('ROLLBACK TO SAVEPOINT ' + nomeSavepoint);
    await cliente.query('RELEASE SAVEPOINT ' + nomeSavepoint);
    verificar(
      erro.code === codigoEsperado,
      'Era esperado o erro ' + codigoEsperado + ', mas foi recebido ' + erro.code + '.'
    );
    return;
  }

  await cliente.query('ROLLBACK TO SAVEPOINT ' + nomeSavepoint);
  await cliente.query('RELEASE SAVEPOINT ' + nomeSavepoint);
  throw new Error('A operação deveria ter sido recusada pelo banco.');
}

async function validarCatalogo(cliente) {
  const tabelasEsperadas = [
    'aceites_privacidade',
    'backups_banco',
    'bairros',
    'campanhas',
    'comunicacoes',
    'consentimentos',
    'contato_eventos',
    'contatos',
    'eventos',
    'historico_comunicacoes',
    'historico_contatos',
    'historico_eventos',
    'importacao_linhas',
    'importacoes',
    'modelos_mensagem',
    'numeros_whatsapp',
    'origens',
    'schema_migrations',
    'solicitacoes_exclusao',
    'tentativas_login',
    'textos_formulario',
    'usuarios'
  ];
  const resultadoTabelas = await cliente.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
  );
  const tabelasEncontradas = resultadoTabelas.rows.map(function (linha) {
    return linha.table_name;
  });

  verificar(
    JSON.stringify(tabelasEncontradas) === JSON.stringify(tabelasEsperadas),
    'A lista de tabelas não corresponde ao script final.'
  );

  const colunasContatos = await cliente.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'contatos'
    `
  );
  const nomesColunasContatos = colunasContatos.rows.map(function (linha) {
    return linha.column_name;
  });

  verificar(
    !nomesColunasContatos.includes('manychat_contact_id'),
    'A coluna descontinuada manychat_contact_id ainda existe em contatos.'
  );
  verificar(
    !nomesColunasContatos.includes('bloqueado_para_campanhas'),
    'A coluna descontinuada bloqueado_para_campanhas ainda existe em contatos.'
  );

  const vinculoUnicoEvento = await cliente.query(
    `
      SELECT 1
      FROM pg_catalog.pg_constraint AS restricao
      INNER JOIN pg_catalog.pg_class AS tabela ON tabela.oid = restricao.conrelid
      INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = tabela.relnamespace
      WHERE namespace.nspname = 'public'
        AND tabela.relname = 'contato_eventos'
        AND restricao.conname = 'contato_eventos_contato_evento_unicos'
        AND restricao.contype = 'u'
    `
  );
  verificar(
    vinculoUnicoEvento.rowCount === 1,
    'A unicidade entre contato e evento não está garantida no banco.'
  );

  const eventoAtivoUnico = await cliente.query(
    `
      SELECT indexdef
      FROM pg_catalog.pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'eventos'
        AND indexname = 'eventos_apenas_um_ativo'
    `
  );
  verificar(
    eventoAtivoUnico.rowCount === 0,
    'A garantia de apenas um evento ativo não existe no banco.'
  );

  const funcoes = await cliente.query(
    `
      SELECT rotina.routine_name
      FROM information_schema.routines AS rotina
      WHERE rotina.specific_schema = 'public'
      ORDER BY rotina.routine_name
    `
  );
  const nomesFuncoes = funcoes.rows.map(function (linha) {
    return linha.routine_name;
  });

  verificar(
    nomesFuncoes.includes('atualizar_data_modificacao'),
    'A função de atualização de data não existe.'
  );
  verificar(
    !nomesFuncoes.includes('contato_pode_receber_campanha'),
    'A função descontinuada de campanhas ainda existe.'
  );
  verificar(
    !nomesFuncoes.includes('validar_participacao_campanha'),
    'A função descontinuada de participação em campanhas ainda existe.'
  );
  verificar(
    !nomesFuncoes.includes('validar_envio_campanha'),
    'A função descontinuada de envio ainda existe.'
  );

  const gatilhos = await cliente.query(
    `
      SELECT gatilho.tgname
      FROM pg_catalog.pg_trigger AS gatilho
      INNER JOIN pg_catalog.pg_class AS tabela ON tabela.oid = gatilho.tgrelid
      INNER JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = tabela.relnamespace
      WHERE namespace.nspname = 'public'
        AND gatilho.tgisinternal = FALSE
      ORDER BY gatilho.tgname
    `
  );
  const nomesGatilhos = gatilhos.rows.map(function (linha) {
    return linha.tgname;
  });

  verificar(nomesGatilhos.length === 10, 'A quantidade de triggers é diferente da esperada.');
  verificar(
    nomesGatilhos.includes('bairros_atualizar_data'),
    'O trigger de atualização do catálogo de bairros não existe.'
  );
  verificar(
    nomesGatilhos.includes('campanhas_atualizar_data'),
    'O trigger de atualização das campanhas não existe.'
  );
  verificar(
    !nomesGatilhos.includes('campanha_contatos_validar_inclusao'),
    'O trigger descontinuado de campanhas ainda existe.'
  );
  verificar(
    !nomesGatilhos.includes('envios_campanha_validar_novo_envio'),
    'O trigger descontinuado de envio ainda existe.'
  );

  const configuracoes = await cliente.query(
    `
      SELECT
        (SELECT COUNT(*)::integer FROM bairros WHERE ativo = TRUE) AS bairros,
        (
          SELECT COUNT(*)::integer
          FROM origens
          WHERE ativa = TRUE
            AND slug IN ('formulario-publico', 'cadastro-manual')
        ) AS origens_obrigatorias,
        (SELECT COUNT(*)::integer FROM textos_formulario WHERE ativo = TRUE) AS textos,
        (
          SELECT COUNT(*)::integer
          FROM schema_migrations
          WHERE nome_arquivo IN (
            '001_validar_estrutura_atual.sql',
            '002_normalizar_nomes_importados.sql',
            '003_garantir_eventos_participantes.sql',
            '004_permitir_varios_eventos_ativos.sql',
            '005_padronizar_telefones_contatos.sql'
          )
        ) AS migrations_atuais
    `
  );

  verificar(configuracoes.rows[0].bairros === 166, 'Os 166 bairros ativos não existem.');
  verificar(
    configuracoes.rows[0].origens_obrigatorias === 2,
    'As duas origens obrigatórias não existem.'
  );
  verificar(configuracoes.rows[0].textos === 3, 'Os três textos ativos não existem.');
  verificar(
    configuracoes.rows[0].migrations_atuais === 5,
    'O ledger deve registrar as cinco migrations atuais.'
  );

  const relacionamentoBairro = await cliente.query(
    `
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'contatos'
        AND constraint_name = 'contatos_bairro_fkey'
        AND constraint_type = 'FOREIGN KEY'
    `
  );

  verificar(
    relacionamentoBairro.rowCount === 1,
    'O relacionamento entre contatos e bairros não existe.'
  );
}

async function validarIntegridadeContato(cliente) {
  const origem = await cliente.query(
    "SELECT id FROM origens WHERE slug = 'cadastro-manual'"
  );
  const origemId = origem.rows[0].id;
  const consultaInsercao = `
    INSERT INTO contatos (
      nome,
      telefone,
      telefone_normalizado,
      bairro,
      problema,
      consentimento_armazenamento,
      consentimento_mensagens,
      consentimento_armazenamento_em,
      origem_atual,
      status_contato,
      origem_id,
      idade
    )
    VALUES (
      'Contato estrutural', $1, $1, $2, 'Saúde', TRUE, FALSE,
      CURRENT_TIMESTAMP, 'Cadastro manual', 'teste', $3, $4
    )
  `;

  await esperarErro(
    cliente,
    consultaInsercao,
    ['21900000001', 'Bairro inexistente', origemId, 30],
    '23503'
  );
  await esperarErro(
    cliente,
    consultaInsercao,
    ['21900000002', 'Vila Kennedy', origemId, 15],
    '23514'
  );
}

async function executar() {
  const cliente = await banco.connect();

  try {
    const identidade = await cliente.query(
      'SELECT current_database() AS banco, current_schema() AS schema'
    );

    verificar(identidade.rows[0].schema === 'public', 'O schema conectado não é public.');
    await validarCatalogo(cliente);

    await cliente.query('BEGIN');
    await validarIntegridadeContato(cliente);
    await cliente.query('ROLLBACK');

    console.log('Banco validado: ' + identidade.rows[0].banco + '.');
    console.log('Estrutura atual, catálogo de bairros e integridade: ' + totalVerificacoes + ' verificações aprovadas.');
  } catch (erro) {
    try {
      await cliente.query('ROLLBACK');
    } catch (erroRollback) {
      console.error('Falha adicional ao desfazer o teste: ' + erroRollback.message);
    }

    console.error('Falha na validação do banco: ' + erro.message);
    process.exitCode = 1;
  } finally {
    cliente.release();
    await banco.end();
  }
}

executar();
