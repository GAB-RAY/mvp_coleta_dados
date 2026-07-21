require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const banco = require('../src/config/banco');

async function executarMigracoes() {
  const diretorioMigracoes = path.join(__dirname, '..', 'database', 'migrations');
  const arquivos = fs.readdirSync(diretorioMigracoes)
    .filter(function (arquivo) {
      return arquivo.endsWith('.sql');
    })
    .sort();
  const cliente = await banco.connect();
  let indice;

  try {
    for (indice = 0; indice < arquivos.length; indice += 1) {
      const nomeArquivo = arquivos[indice];
      const caminhoArquivo = path.join(diretorioMigracoes, nomeArquivo);
      const sql = fs.readFileSync(caminhoArquivo, 'utf8');

      await cliente.query(sql);
      console.log('Migração executada: ' + nomeArquivo);
    }

    console.log('Migrações concluídas com sucesso.');
  } catch (erro) {
    try {
      await cliente.query('ROLLBACK');
    } catch (erroRollback) {
      console.error('Não foi possível concluir o rollback da migração.');
    }

    throw erro;
  } finally {
    cliente.release();
    await banco.end();
  }
}

if (require.main === module) {
  executarMigracoes().catch(function (erro) {
    console.error('Falha ao executar migrações: ' + erro.message);
    process.exitCode = 1;
  });
}

module.exports = executarMigracoes;
