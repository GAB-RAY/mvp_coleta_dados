require('dotenv').config({ quiet: true });

const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');
const configuracaoImportacao = require('../src/config/importacao');

const QUANTIDADE_CONTATOS = Number(process.env.TESTE_IMPORTACAO_QUANTIDADE || 15000);
const PREFIXO_TELEFONE = '00000';
const NOME_ORIGEM = 'Teste de carga de importacao';
const EMAIL_TESTE = 'importacao.carga@invalid.local';
const TABELAS_TESTE = [
  'contatos',
  'importacoes',
  'importacao_linhas',
  'origens',
  'usuarios'
];

function criarTelefone(indice) {
  return PREFIXO_TELEFONE + String(indice).padStart(6, '0');
}

function criarCsv(quantidade) {
  const linhas = ['telefone;nome'];
  let indice;

  for (indice = 1; indice <= quantidade; indice += 1) {
    linhas.push(criarTelefone(indice) + ';Contato carga ' + indice);
  }

  return linhas.join('\n');
}

function criarFormulario(conteudo) {
  const formulario = new FormData();
  formulario.append('origem', NOME_ORIGEM);
  formulario.append('arquivo', new Blob([conteudo], { type: 'text/csv' }), 'carga.csv');
  return formulario;
}

async function requisitar(baseUrl, caminho, opcoes) {
  const resposta = await fetch(baseUrl + caminho, opcoes);
  const corpo = await resposta.json();

  return { status: resposta.status, corpo };
}

async function sincronizarSequenciasTeste() {
  let indice;

  for (indice = 0; indice < TABELAS_TESTE.length; indice += 1) {
    const tabela = TABELAS_TESTE[indice];

    if (!/^[a-z0-9_]+$/.test(tabela)) {
      throw new Error('Tabela de teste inválida.');
    }

    await banco.query(
      `
        SELECT setval(
          pg_get_serial_sequence($1, 'id'),
          COALESCE(MAX(id), 1),
          COUNT(*) > 0
        )
        FROM public."${tabela}"
      `,
      ['public.' + tabela]
    );
  }
}

async function limpar() {
  const origem = await banco.query(
    'SELECT id FROM origens WHERE nome = $1',
    [NOME_ORIGEM]
  );
  const idsOrigens = origem.rows.map(function (registro) {
    return registro.id;
  });

  if (idsOrigens.length > 0) {
    await banco.query(
      'DELETE FROM importacoes WHERE origem_id = ANY($1::bigint[])',
      [idsOrigens]
    );
  }

  const contatos = await banco.query(
    'SELECT id FROM contatos WHERE telefone_normalizado LIKE $1',
    [PREFIXO_TELEFONE + '%']
  );
  const idsContatos = contatos.rows.map(function (contato) {
    return contato.id;
  });

  if (idsContatos.length > 0) {
    await banco.query(
      'DELETE FROM historico_contatos WHERE contato_id = ANY($1::bigint[])',
      [idsContatos]
    );
    await banco.query(
      'DELETE FROM contatos WHERE id = ANY($1::bigint[])',
      [idsContatos]
    );
  }

  if (idsOrigens.length > 0) {
    await banco.query('DELETE FROM origens WHERE id = ANY($1::bigint[])', [idsOrigens]);
  }

  await banco.query('DELETE FROM tentativas_login WHERE email_informado = $1', [EMAIL_TESTE]);
  await banco.query('DELETE FROM usuarios WHERE email = $1', [EMAIL_TESTE]);
  await sincronizarSequenciasTeste();
}

async function executar() {
  let servidor;

  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('O teste de carga não pode ser executado em produção.');
    }

    await limpar();
    const senhaHash = await bcrypt.hash('SenhaImportacaoCarga123!', 4);
    const usuario = await banco.query(
      `
        INSERT INTO usuarios (nome, email, senha_hash, perfil)
        VALUES ('Operador Teste Carga', $1, $2, 'operador')
        RETURNING id, email, perfil
      `,
      [EMAIL_TESTE, senhaHash]
    );
    const segredo = process.env.JWT_SECRET || process.env.JWT_SEGREDO;
    const token = jwt.sign(usuario.rows[0], segredo, { expiresIn: '15m' });
    const cabecalhos = { Authorization: 'Bearer ' + token };

    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });

    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;
    const inicioPreVisualizacao = Date.now();
    const preVisualizacao = await requisitar(baseUrl, '/api/admin/importacoes/pre-visualizar', {
      method: 'POST',
      headers: cabecalhos,
      body: criarFormulario(criarCsv(QUANTIDADE_CONTATOS))
    });
    const duracaoPreVisualizacao = Date.now() - inicioPreVisualizacao;

    assert.strictEqual(preVisualizacao.status, 201);
    assert.strictEqual(preVisualizacao.corpo.importacao.totalRecebido, QUANTIDADE_CONTATOS);
    assert.strictEqual(preVisualizacao.corpo.importacao.validos, QUANTIDADE_CONTATOS);

    const inicioConfirmacao = Date.now();
    const confirmacao = await requisitar(
      baseUrl,
      '/api/admin/importacoes/' + preVisualizacao.corpo.importacao.importacaoId + '/confirmar',
      { method: 'POST', headers: cabecalhos }
    );
    const duracaoConfirmacao = Date.now() - inicioConfirmacao;

    assert.strictEqual(confirmacao.status, 200);
    assert.strictEqual(confirmacao.corpo.relatorio.criados, QUANTIDADE_CONTATOS);
    assert.strictEqual(confirmacao.corpo.relatorio.erros.length, 0);

    const arquivoAcimaDoLimite = await requisitar(
      baseUrl,
      '/api/admin/importacoes/pre-visualizar',
      {
        method: 'POST',
        headers: cabecalhos,
        body: criarFormulario(criarCsv(configuracaoImportacao.LIMITE_LINHAS + 1))
      }
    );
    assert.strictEqual(arquivoAcimaDoLimite.status, 400);

    const totalPersistido = await banco.query(
      'SELECT COUNT(*)::integer AS total FROM contatos WHERE telefone_normalizado LIKE $1',
      [PREFIXO_TELEFONE + '%']
    );
    assert.strictEqual(totalPersistido.rows[0].total, QUANTIDADE_CONTATOS);

    console.log('Importacao de carga aprovada: ' + QUANTIDADE_CONTATOS + ' contatos.');
    console.log('Pre-visualizacao: ' + duracaoPreVisualizacao + ' ms.');
    console.log('Confirmacao: ' + duracaoConfirmacao + ' ms.');
  } finally {
    if (servidor) {
      await new Promise(function (resolver) {
        servidor.close(resolver);
      });
    }

    await limpar();
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro);
  process.exitCode = 1;
});
