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

async function criarContato(cliente, origemId, usuarioId, telefone, opcoes) {
  const configuracao = opcoes || {};
  const resultado = await cliente.query(
    `
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
        idade,
        bloqueado_para_mensagens,
        bloqueado_para_ligacoes,
        bloqueado_para_campanhas
      )
        VALUES (
        $1, $2, $2, 'Vila Kennedy', 'Saúde', TRUE, FALSE,
        CURRENT_TIMESTAMP, 'Cadastro manual', 'teste', $3, 30,
        $4, FALSE, $5
      )
      RETURNING id
    `,
    [
      configuracao.nome || 'Contato de teste',
      telefone,
      origemId,
      configuracao.bloqueadoParaMensagens === true,
      configuracao.bloqueadoParaCampanhas === true
    ]
  );

  const contatoId = resultado.rows[0].id;

  if (configuracao.exclusaoSolicitada === true) {
    await cliente.query(
      `INSERT INTO solicitacoes_exclusao (
        contato_id, contato_id_original, solicitada_por_usuario_id
      ) VALUES ($1, $1, $2)`,
      [contatoId, usuarioId]
    );
  }

  return contatoId;
}

async function registrarConsentimentoMensagens(cliente, contatoId, origemId, usuarioId, estado) {
  const autorizado = estado === 'autorizado';

  await cliente.query(
    `
      INSERT INTO consentimentos (
        contato_id,
        contato_id_original,
        tipo,
        resposta,
        texto_apresentado,
        versao_texto,
        canal,
        origem_registro,
        registrado_por_usuario_id,
        estado,
        origem_id
      )
      VALUES (
        $1, $1, 'mensagens', $2,
        'Texto técnico de consentimento utilizado somente pelo teste estrutural.',
        'teste_v1', 'cadastro_manual', 'resposta_expressa', $3, $4, $5
      )
    `,
    [contatoId, autorizado, usuarioId, estado, origemId]
  );
}

async function validarCatalogo(cliente) {
  const tabelasEsperadas = [
    'aceites_privacidade',
    'backups_banco',
    'bairros',
    'campanha_contatos',
    'campanhas',
    'consentimentos',
    'contato_eventos',
    'contatos',
    'envios_campanha',
    'eventos',
    'eventos_manychat',
    'historico_contatos',
    'historico_eventos',
    'importacao_linhas',
    'importacoes',
    'origens',
    'respostas_campanha',
    'sincronizacoes_manychat',
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
    nomesColunasContatos.includes('manychat_contact_id'),
    'O identificador futuro do ManyChat não foi criado em contatos.'
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
    nomesFuncoes.includes('contato_pode_receber_campanha'),
    'A função de elegibilidade de campanhas não existe.'
  );
  verificar(
    nomesFuncoes.includes('validar_participacao_campanha'),
    'A função de validação de participação não existe.'
  );
  verificar(
    nomesFuncoes.includes('validar_envio_campanha'),
    'A função de validação de envio não existe.'
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

  verificar(nomesGatilhos.length === 11, 'A quantidade de triggers é diferente da esperada.');
  verificar(
    nomesGatilhos.includes('bairros_atualizar_data'),
    'O trigger de atualização do catálogo de bairros não existe.'
  );
  verificar(
    nomesGatilhos.includes('campanha_contatos_validar_inclusao'),
    'O trigger de elegibilidade de campanha não existe.'
  );
  verificar(
    nomesGatilhos.includes('envios_campanha_validar_novo_envio'),
    'O trigger de bloqueio de envio não existe.'
  );

  const configuracoes = await cliente.query(
    `
      SELECT
        (SELECT COUNT(*)::integer FROM bairros WHERE ativo = TRUE) AS bairros,
        (SELECT COUNT(*)::integer FROM origens WHERE ativa = TRUE) AS origens,
        (SELECT COUNT(*)::integer FROM textos_formulario WHERE ativo = TRUE) AS textos,
        to_regclass('public.schema_migrations') IS NULL AS sem_ledger_antigo
    `
  );

  verificar(configuracoes.rows[0].bairros === 166, 'Os 166 bairros ativos não existem.');
  verificar(configuracoes.rows[0].origens === 2, 'As duas origens iniciais não existem.');
  verificar(configuracoes.rows[0].textos === 3, 'Os três textos ativos não existem.');
  verificar(
    configuracoes.rows[0].sem_ledger_antigo === true,
    'O ledger das migrations antigas não deveria existir no banco reorganizado.'
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

async function validarManyChat(cliente) {
  const origem = await cliente.query(
    "SELECT id FROM origens WHERE slug = 'cadastro-manual'"
  );
  const usuario = await cliente.query(
    `
      INSERT INTO usuarios (nome, email, senha_hash, perfil)
      VALUES (
        'Administrador Estrutural',
        'estrutura.banco@invalid.local',
        'hash_bcrypt_substituido_no_teste',
        'administrador'
      )
      RETURNING id
    `
  );
  const origemId = origem.rows[0].id;
  const usuarioId = usuario.rows[0].id;
  const campanha = await cliente.query(
    `
      INSERT INTO campanhas (nome, descricao, criado_por_usuario_id)
      VALUES ('Campanha de validação', 'Registro revertido ao final do teste.', $1)
      RETURNING id
    `,
    [usuarioId]
  );
  const campanhaId = campanha.rows[0].id;

  const contatoAutorizado = await criarContato(
    cliente,
    origemId,
    usuarioId,
    '21900000001',
    { nome: 'Contato autorizado' }
  );
  await esperarErro(
    cliente,
    'UPDATE contatos SET bairro = $1 WHERE id = $2',
    ['Bairro inexistente', contatoAutorizado],
    '23503'
  );
  await registrarConsentimentoMensagens(
    cliente,
    contatoAutorizado,
    origemId,
    usuarioId,
    'autorizado'
  );

  const contatoSemConsentimento = await criarContato(
    cliente,
    origemId,
    usuarioId,
    '21900000002',
    { nome: 'Contato sem consentimento' }
  );
  const contatoRevogado = await criarContato(
    cliente,
    origemId,
    usuarioId,
    '21900000003',
    { nome: 'Contato revogado', bloqueadoParaMensagens: true }
  );
  await registrarConsentimentoMensagens(
    cliente,
    contatoRevogado,
    origemId,
    usuarioId,
    'revogado'
  );

  const contatoComExclusao = await criarContato(
    cliente,
    origemId,
    usuarioId,
    '21900000004',
    {
      nome: 'Contato com exclusão',
      bloqueadoParaMensagens: true,
      bloqueadoParaCampanhas: true,
      exclusaoSolicitada: true
    }
  );
  await registrarConsentimentoMensagens(
    cliente,
    contatoComExclusao,
    origemId,
    usuarioId,
    'autorizado'
  );

  const participacao = await cliente.query(
    `
      INSERT INTO campanha_contatos (
        campanha_id,
        contato_id,
        incluido_por_usuario_id
      )
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [campanhaId, contatoAutorizado, usuarioId]
  );
  const participacaoId = participacao.rows[0].id;

  verificar(Boolean(participacaoId), 'O contato autorizado não entrou na campanha.');

  await esperarErro(
    cliente,
    `
      INSERT INTO campanha_contatos (campanha_id, contato_id, incluido_por_usuario_id)
      VALUES ($1, $2, $3)
    `,
    [campanhaId, contatoAutorizado, usuarioId],
    '23505'
  );
  await esperarErro(
    cliente,
    `
      INSERT INTO campanha_contatos (campanha_id, contato_id, incluido_por_usuario_id)
      VALUES ($1, $2, $3)
    `,
    [campanhaId, contatoSemConsentimento, usuarioId],
    '23514'
  );
  await esperarErro(
    cliente,
    `
      INSERT INTO campanha_contatos (campanha_id, contato_id, incluido_por_usuario_id)
      VALUES ($1, $2, $3)
    `,
    [campanhaId, contatoRevogado, usuarioId],
    '23514'
  );
  await esperarErro(
    cliente,
    `
      INSERT INTO campanha_contatos (campanha_id, contato_id, incluido_por_usuario_id)
      VALUES ($1, $2, $3)
    `,
    [campanhaId, contatoComExclusao, usuarioId],
    '23514'
  );

  const envio = await cliente.query(
    `
      INSERT INTO envios_campanha (campanha_contato_id, numero_tentativa)
      VALUES ($1, 1)
      RETURNING id
    `,
    [participacaoId]
  );
  verificar(Boolean(envio.rows[0].id), 'O primeiro envio elegível não foi registrado.');

  await cliente.query(
    'UPDATE contatos SET bloqueado_para_mensagens = TRUE WHERE id = $1',
    [contatoAutorizado]
  );
  await esperarErro(
    cliente,
    `
      INSERT INTO envios_campanha (campanha_contato_id, numero_tentativa)
      VALUES ($1, 2)
    `,
    [participacaoId],
    '23514'
  );

  await cliente.query(
    `
      INSERT INTO eventos_manychat (identificador_externo, tipo, payload)
      VALUES ('evento-externo-teste', 'resposta.recebida', '{}'::jsonb)
    `
  );
  await esperarErro(
    cliente,
    `
      INSERT INTO eventos_manychat (identificador_externo, tipo, payload)
      VALUES ('evento-externo-teste', 'resposta.recebida', '{}'::jsonb)
    `,
    [],
    '23505'
  );

  await cliente.query(
    'UPDATE contatos SET manychat_contact_id = $1 WHERE id = $2',
    ['manychat-contato-teste', contatoAutorizado]
  );
  await esperarErro(
    cliente,
    'UPDATE contatos SET manychat_contact_id = $1 WHERE id = $2',
    ['manychat-contato-teste', contatoSemConsentimento],
    '23505'
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
    await validarManyChat(cliente);
    await cliente.query('ROLLBACK');

    console.log('Banco validado: ' + identidade.rows[0].banco + '.');
    console.log('Estrutura atual, catálogo de bairros e base ManyChat: ' + totalVerificacoes + ' verificações aprovadas.');
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
