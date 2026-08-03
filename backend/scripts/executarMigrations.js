require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const banco = require('../src/config/banco');

const DIRETORIO_MIGRATIONS = path.join(__dirname, '..', 'database', 'migrations');
const NOME_TRAVA = 'acorda-vk-migrations-v1';

function calcularChecksum(conteudo) {
  return crypto.createHash('sha256').update(conteudo, 'utf8').digest('hex');
}

function listarMigrations() {
  return fs.readdirSync(DIRETORIO_MIGRATIONS)
    .filter(function (nomeArquivo) {
      return /^\d{3}_[a-z0-9_]+\.sql$/.test(nomeArquivo);
    })
    .sort()
    .map(function (nomeArquivo) {
      const caminho = path.join(DIRETORIO_MIGRATIONS, nomeArquivo);
      const conteudo = fs.readFileSync(caminho, 'utf8');

      return {
        versao: nomeArquivo.slice(0, 3),
        nomeArquivo: nomeArquivo,
        conteudo: conteudo,
        checksum: calcularChecksum(conteudo)
      };
    });
}

function validarSequencia(migrations) {
  const versoes = new Set();

  migrations.forEach(function (migration) {
    if (versoes.has(migration.versao)) {
      throw new Error('Existem duas migrations com a versao ' + migration.versao + '.');
    }

    versoes.add(migration.versao);
  });
}

async function garantirLedger(cliente) {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      versao VARCHAR(20) NOT NULL,
      nome_arquivo VARCHAR(255) NOT NULL,
      checksum_sha256 CHAR(64) NOT NULL,
      executada_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT schema_migrations_pkey PRIMARY KEY (versao),
      CONSTRAINT schema_migrations_nome_arquivo_unico UNIQUE (nome_arquivo),
      CONSTRAINT schema_migrations_checksum_formato CHECK (
        checksum_sha256 ~ '^[a-f0-9]{64}$'
      )
    )
  `);
}

async function buscarExecutadas(cliente) {
  const resultado = await cliente.query(`
    SELECT versao, nome_arquivo, checksum_sha256
    FROM public.schema_migrations
    ORDER BY versao
  `);
  const executadas = new Map();

  resultado.rows.forEach(function (linha) {
    executadas.set(linha.versao, linha);
  });

  return executadas;
}

function validarMigrationExecutada(migration, registro) {
  if (registro.nome_arquivo !== migration.nomeArquivo) {
    throw new Error(
      'A migration ' + migration.versao + ' foi registrada com outro nome de arquivo.'
    );
  }

  if (registro.checksum_sha256 !== migration.checksum) {
    throw new Error(
      'A migration aplicada ' + migration.nomeArquivo + ' foi alterada. Execucao abortada.'
    );
  }
}

async function aplicarMigration(cliente, migration) {
  await cliente.query('BEGIN');

  try {
    await cliente.query(migration.conteudo);
    await cliente.query(
      `
        INSERT INTO public.schema_migrations (
          versao,
          nome_arquivo,
          checksum_sha256
        )
        VALUES ($1, $2, $3)
      `,
      [migration.versao, migration.nomeArquivo, migration.checksum]
    );
    await cliente.query('COMMIT');
    console.log('Migration aplicada: ' + migration.nomeArquivo);
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  }
}

async function executar() {
  const migrations = listarMigrations();
  const cliente = await banco.connect();

  validarSequencia(migrations);

  try {
    await cliente.query('SELECT pg_advisory_lock(hashtext($1))', [NOME_TRAVA]);
    await garantirLedger(cliente);

    const executadas = await buscarExecutadas(cliente);
    let quantidadeAplicada = 0;

    for (const migration of migrations) {
      const registro = executadas.get(migration.versao);

      if (registro) {
        validarMigrationExecutada(migration, registro);
        continue;
      }

      await aplicarMigration(cliente, migration);
      quantidadeAplicada += 1;
    }

    console.log(
      quantidadeAplicada === 0
        ? 'Banco atualizado. Nenhuma migration pendente.'
        : 'Banco atualizado. ' + quantidadeAplicada + ' migration(s) aplicada(s).'
    );
  } finally {
    try {
      await cliente.query('SELECT pg_advisory_unlock(hashtext($1))', [NOME_TRAVA]);
    } finally {
      cliente.release();
      await banco.end();
    }
  }
}

executar().catch(function (erro) {
  console.error('Falha ao executar migrations:', erro.stack || erro.message);
  process.exitCode = 1;
});
