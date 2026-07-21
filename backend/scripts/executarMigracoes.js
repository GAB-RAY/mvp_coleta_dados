require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const banco = require('../src/config/banco');

const NOME_BANCO_OFICIAL = 'criar_banco';
const NOME_ARQUIVO_BASELINE = '003_consentimentos_publicos_e_listagem.sql';
const NOME_ARQUIVO_CONTROLE = '004_criar_schema_migrations.sql';
const CHAVE_ADVISORY_LOCK = 'a_voz_do_bairro_schema_migrations';

function calcularChecksum(conteudo) {
  const conteudoNormalizado = conteudo.replace(/\r\n/g, '\n');

  return crypto
    .createHash('sha256')
    .update(conteudoNormalizado, 'utf8')
    .digest('hex');
}

function carregarMigracoes() {
  const diretorioMigracoes = path.join(__dirname, '..', 'database', 'migrations');
  const nomesArquivos = fs.readdirSync(diretorioMigracoes)
    .filter(function (nomeArquivo) {
      return nomeArquivo.endsWith('.sql');
    })
    .sort();

  return nomesArquivos.map(function (nomeArquivo) {
    const caminhoArquivo = path.join(diretorioMigracoes, nomeArquivo);
    const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');

    return {
      nomeArquivo,
      conteudo,
      checksum: calcularChecksum(conteudo)
    };
  });
}

function buscarMigracao(migracoes, nomeArquivo) {
  return migracoes.find(function (migracao) {
    return migracao.nomeArquivo === nomeArquivo;
  });
}

async function validarBancoDestino(cliente) {
  const resultado = await cliente.query(
    'SELECT current_database() AS banco, current_schema() AS schema'
  );
  const identidade = resultado.rows[0];

  if (identidade.banco !== NOME_BANCO_OFICIAL || identidade.schema !== 'public') {
    throw new Error(
      'Destino recusado. O runner exige o banco criar_banco e o schema public.'
    );
  }

  console.log('Banco validado: ' + identidade.banco + ', schema ' + identidade.schema + '.');
}

async function tabelaControleExiste(cliente) {
  const resultado = await cliente.query(
    "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS existe"
  );

  return resultado.rows[0].existe;
}

async function validarEstruturaDaMigration003(cliente) {
  const tabelasEsperadas = ['consentimentos', 'contatos', 'usuarios'];
  const colunasContatosEsperadas = [
    'atualizado_em',
    'bloqueado_para_mensagens',
    'consentimento_ligacoes',
    'consentimento_tratamento_dados',
    'consentimento_whatsapp',
    'consentimentos_atualizados_em',
    'excluido_logicamente',
    'origem_atual',
    'status_contato'
  ];
  const colunasConsentimentosEsperadas = [
    'ativo',
    'canal',
    'contato_id',
    'criado_em',
    'id',
    'origem_registro',
    'registrado_por_usuario_id',
    'resposta',
    'revogado_em',
    'texto_apresentado',
    'tipo',
    'versao_texto'
  ];
  const constraintsEsperadas = [
    'consentimentos_canal_valido',
    'consentimentos_contato_id_fkey',
    'consentimentos_origem_registro_valida',
    'consentimentos_pkey',
    'consentimentos_registrado_por_usuario_id_fkey',
    'consentimentos_revogacao_coerente',
    'consentimentos_tipo_valido'
  ];
  const indicesEsperados = [
    'consentimentos_contato_id_indice',
    'consentimentos_contato_tipo_ativo_unico',
    'consentimentos_criado_em_indice',
    'contatos_consentimento_ligacoes_indice',
    'contatos_consentimento_whatsapp_indice',
    'contatos_origem_atual_indice',
    'contatos_status_contato_indice'
  ];
  const resultados = [];

  resultados.push(
    await cliente.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
    )
  );
  resultados.push(
    await cliente.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contatos'
          AND column_name = ANY($1::text[])
        ORDER BY column_name
      `,
      [colunasContatosEsperadas]
    )
  );
  resultados.push(
    await cliente.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'consentimentos'
          AND column_name = ANY($1::text[])
        ORDER BY column_name
      `,
      [colunasConsentimentosEsperadas]
    )
  );
  resultados.push(
    await cliente.query(
      `
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'consentimentos'
          AND constraint_name = ANY($1::text[])
        ORDER BY constraint_name
      `,
      [constraintsEsperadas]
    )
  );
  resultados.push(
    await cliente.query(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = ANY($1::text[])
        ORDER BY indexname
      `,
      [indicesEsperados]
    )
  );
  resultados.push(
    await cliente.query(
      `
        SELECT
          (SELECT COUNT(*)::integer FROM contatos) AS contatos,
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
          (
            SELECT COUNT(*)::integer
            FROM consentimentos AS consentimento
            LEFT JOIN contatos AS contato ON contato.id = consentimento.contato_id
            WHERE contato.id IS NULL
          ) AS orfaos
      `
    )
  );
  const tabelasEncontradas = resultados[0].rows.map(function (item) {
    return item.table_name;
  });
  const colunasContatosEncontradas = resultados[1].rows.map(function (item) {
    return item.column_name;
  });
  const colunasConsentimentosEncontradas = resultados[2].rows.map(function (item) {
    return item.column_name;
  });
  const constraintsEncontradas = resultados[3].rows.map(function (item) {
    return item.constraint_name;
  });
  const indicesEncontrados = resultados[4].rows.map(function (item) {
    return item.indexname;
  });
  const contagens = resultados[5].rows[0];

  if (JSON.stringify(tabelasEncontradas) !== JSON.stringify(tabelasEsperadas)) {
    throw new Error('A lista de tabelas diverge do diagnóstico anterior à Fase 1.');
  }

  if (
    JSON.stringify(colunasContatosEncontradas) !==
    JSON.stringify(colunasContatosEsperadas)
  ) {
    throw new Error('A estrutura de contatos não corresponde à migration 003.');
  }

  if (
    JSON.stringify(colunasConsentimentosEncontradas) !==
    JSON.stringify(colunasConsentimentosEsperadas)
  ) {
    throw new Error('A estrutura de consentimentos não corresponde à migration 003.');
  }

  if (JSON.stringify(constraintsEncontradas) !== JSON.stringify(constraintsEsperadas)) {
    throw new Error('As constraints de consentimentos divergem da migration 003.');
  }

  if (JSON.stringify(indicesEncontrados) !== JSON.stringify(indicesEsperados)) {
    throw new Error('Os índices da migration 003 estão incompletos ou divergentes.');
  }

  if (
    contagens.contatos < 4 ||
    contagens.usuarios < 1 ||
    contagens.consentimentos < 8 ||
    contagens.legados < 8 ||
    contagens.novos_consentimentos !== 0 ||
    contagens.orfaos !== 0
  ) {
    throw new Error('Os dados existentes divergem do preflight aprovado.');
  }

  console.log('Estrutura e dados da migration 003 confirmados sem reaplicação.');
}

async function validarEstruturaDoControle(cliente) {
  const colunasEsperadas = [
    'baseline',
    'checksum_sha256',
    'executada_em',
    'nome_arquivo'
  ];
  const resultado = await cliente.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
      ORDER BY column_name
    `
  );
  const colunasEncontradas = resultado.rows.map(function (item) {
    return item.column_name;
  });

  if (JSON.stringify(colunasEncontradas) !== JSON.stringify(colunasEsperadas)) {
    throw new Error('A tabela schema_migrations possui estrutura inesperada.');
  }
}

async function criarControleERegistrarBaseline(cliente, migracoes) {
  const migration003 = buscarMigracao(migracoes, NOME_ARQUIVO_BASELINE);
  const migration004 = buscarMigracao(migracoes, NOME_ARQUIVO_CONTROLE);

  if (!migration003 || !migration004) {
    throw new Error('As migrations 003 e 004 são obrigatórias para o bootstrap.');
  }

  await validarEstruturaDaMigration003(cliente);
  await cliente.query('BEGIN');

  try {
    await cliente.query(migration004.conteudo);
    await cliente.query(
      `
        INSERT INTO schema_migrations (
          nome_arquivo,
          checksum_sha256,
          baseline
        )
        VALUES ($1, $2, TRUE), ($3, $4, FALSE)
      `,
      [
        migration003.nomeArquivo,
        migration003.checksum,
        migration004.nomeArquivo,
        migration004.checksum
      ]
    );
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  }

  console.log('Migration 003 registrada como baseline sem executar seu SQL.');
  console.log('Migração executada: ' + migration004.nomeArquivo);
}

async function buscarRegistrosDoControle(cliente) {
  const resultado = await cliente.query(
    `
      SELECT nome_arquivo, checksum_sha256, baseline, executada_em
      FROM schema_migrations
      ORDER BY nome_arquivo
    `
  );
  const registrosPorArquivo = {};

  resultado.rows.forEach(function (registro) {
    registrosPorArquivo[registro.nome_arquivo] = registro;
  });

  return registrosPorArquivo;
}

function validarBaseline(registrosPorArquivo) {
  const registro003 = registrosPorArquivo[NOME_ARQUIVO_BASELINE];
  const registro004 = registrosPorArquivo[NOME_ARQUIVO_CONTROLE];

  if (!registro003 || registro003.baseline !== true) {
    throw new Error('A migration 003 não está registrada corretamente como baseline.');
  }

  if (!registro004 || registro004.baseline !== false) {
    throw new Error('A migration 004 não está registrada corretamente.');
  }
}

async function executarMigrationPendente(cliente, migracao) {
  await cliente.query('BEGIN');

  try {
    await cliente.query(migracao.conteudo);
    await cliente.query(
      `
        INSERT INTO schema_migrations (
          nome_arquivo,
          checksum_sha256,
          baseline
        )
        VALUES ($1, $2, FALSE)
      `,
      [migracao.nomeArquivo, migracao.checksum]
    );
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  }

  console.log('Migração executada: ' + migracao.nomeArquivo);
}

async function executarMigracoes() {
  const migracoes = carregarMigracoes();
  const cliente = await banco.connect();
  let lockObtido = false;
  let indice;

  try {
    await validarBancoDestino(cliente);
    await cliente.query('SELECT pg_advisory_lock(hashtext($1))', [CHAVE_ADVISORY_LOCK]);
    lockObtido = true;
    console.log('Advisory lock obtido.');

    if (!(await tabelaControleExiste(cliente))) {
      await criarControleERegistrarBaseline(cliente, migracoes);
    }

    await validarEstruturaDoControle(cliente);
    const registrosPorArquivo = await buscarRegistrosDoControle(cliente);

    validarBaseline(registrosPorArquivo);

    for (indice = 0; indice < migracoes.length; indice += 1) {
      const migracao = migracoes[indice];
      const registro = registrosPorArquivo[migracao.nomeArquivo];

      if (registro) {
        if (registro.checksum_sha256 !== migracao.checksum) {
          throw new Error(
            'Checksum divergente para migration já executada: ' +
            migracao.nomeArquivo
          );
        }

        console.log('Migração já registrada, ignorada: ' + migracao.nomeArquivo);
        continue;
      }

      if (migracao.nomeArquivo === NOME_ARQUIVO_BASELINE) {
        throw new Error('A migration 003 nunca pode ser reaplicada pelo runner.');
      }

      await executarMigrationPendente(cliente, migracao);
      registrosPorArquivo[migracao.nomeArquivo] = {
        nome_arquivo: migracao.nomeArquivo,
        checksum_sha256: migracao.checksum,
        baseline: false
      };
    }

    console.log('Migrations concluídas com sucesso.');
  } finally {
    if (lockObtido) {
      await cliente.query('SELECT pg_advisory_unlock(hashtext($1))', [
        CHAVE_ADVISORY_LOCK
      ]);
      console.log('Advisory lock liberado.');
    }

    cliente.release();
    await banco.end();
  }
}

if (require.main === module) {
  executarMigracoes().catch(function (erro) {
    console.error('Falha ao executar migrations: ' + erro.message);
    process.exitCode = 1;
  });
}

module.exports = executarMigracoes;
