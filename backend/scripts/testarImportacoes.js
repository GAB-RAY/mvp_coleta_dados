require('dotenv').config({ quiet: true });

const assert = require('assert');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');

const PREFIXO = '21999985';
const ORIGENS = ['Importação CSV Teste', 'Importação XLSX Teste'];

async function requisitar(baseUrl, caminho, opcoes) {
  const resposta = await fetch(baseUrl + caminho, opcoes || {});
  const corpo = await resposta.json();

  return { status: resposta.status, corpo };
}

function criarFormulario(conteudo, nomeArquivo, origem, tipo) {
  const formulario = new FormData();
  formulario.append('origem', origem);
  formulario.append('arquivo', new Blob([conteudo], { type: tipo }), nomeArquivo);
  return formulario;
}

async function limpar() {
  const origens = await banco.query(
    'SELECT id FROM origens WHERE nome = ANY($1::text[])',
    [ORIGENS]
  );
  const idsOrigens = origens.rows.map(function (origem) { return origem.id; });

  if (idsOrigens.length > 0) {
    await banco.query('DELETE FROM importacoes WHERE origem_id = ANY($1::bigint[])', [idsOrigens]);
  }

  const contatos = await banco.query(
    'SELECT id FROM contatos WHERE telefone_normalizado LIKE $1',
    [PREFIXO + '%']
  );
  const idsContatos = contatos.rows.map(function (contato) { return contato.id; });

  if (idsContatos.length > 0) {
    await banco.query('DELETE FROM aceites_privacidade WHERE contato_id = ANY($1::bigint[])', [idsContatos]);
    await banco.query('DELETE FROM consentimentos WHERE contato_id = ANY($1::bigint[])', [idsContatos]);
    await banco.query('DELETE FROM historico_contatos WHERE contato_id = ANY($1::bigint[])', [idsContatos]);
    await banco.query('DELETE FROM contatos WHERE id = ANY($1::bigint[])', [idsContatos]);
  }

  if (idsOrigens.length > 0) {
    await banco.query('DELETE FROM origens WHERE id = ANY($1::bigint[])', [idsOrigens]);
  }
}

async function executar() {
  let servidor;

  try {
    await limpar();
    const usuario = await banco.query('SELECT id, email FROM usuarios ORDER BY id LIMIT 1');
    const segredo = process.env.JWT_SECRET || process.env.JWT_SEGREDO;
    const token = jwt.sign(usuario.rows[0], segredo, { expiresIn: '10m' });
    const cabecalhos = { Authorization: 'Bearer ' + token };
    const origemLegada = await banco.query("SELECT id FROM origens WHERE slug = 'cadastro-legado'");
    await banco.query(
      `
        INSERT INTO contatos (
          nome, telefone, telefone_normalizado, bairro, problema,
          consentimento_armazenamento, consentimento_mensagens,
          consentimento_armazenamento_em, origem_atual, status_contato,
          bloqueado_para_mensagens, excluido_logicamente, origem_id
        )
        VALUES (NULL, $1, $1, NULL, NULL, TRUE, FALSE, CURRENT_TIMESTAMP,
          'Cadastro legado', 'ativo', FALSE, FALSE, $2)
      `,
      [PREFIXO + '003', origemLegada.rows[0].id]
    );

    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;
    const csv = [
      'telefone;nome;bairro;idade;categoria;descricao;eleicao',
      PREFIXO + '001;Contato CSV;Vila Kennedy;32;Saúde;Linha válida;sim',
      '123;Inválido;Centro;30;Saúde;;nao',
      PREFIXO + '001;Duplicado;Centro;33;Educação;;sim',
      PREFIXO + '002;;;;;;',
      PREFIXO + '003;Complementado;Centro;50;Educação;Campo preenchido;prefiro_nao_informar'
    ].join('\n');
    const visualizacao = await requisitar(baseUrl, '/api/admin/importacoes/pre-visualizar', {
      method: 'POST',
      headers: cabecalhos,
      body: criarFormulario(csv, 'contatos.csv', ORIGENS[0], 'text/csv')
    });
    assert.strictEqual(visualizacao.status, 201);
    assert.strictEqual(visualizacao.corpo.importacao.totalRecebido, 5);
    assert.strictEqual(visualizacao.corpo.importacao.validos, 3);
    assert.strictEqual(visualizacao.corpo.importacao.invalidos, 2);

    const confirmacao = await requisitar(
      baseUrl,
      '/api/admin/importacoes/' + visualizacao.corpo.importacao.importacaoId + '/confirmar',
      { method: 'POST', headers: cabecalhos }
    );
    assert.strictEqual(confirmacao.status, 200);
    assert.strictEqual(confirmacao.corpo.relatorio.criados, 2);
    assert.strictEqual(confirmacao.corpo.relatorio.complementados, 1);
    assert.strictEqual(confirmacao.corpo.relatorio.duplicados, 1);
    assert.strictEqual(confirmacao.corpo.relatorio.invalidos, 1);
    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/importacoes/' + visualizacao.corpo.importacao.importacaoId + '/confirmar',
      { method: 'POST', headers: cabecalhos }
    )).status, 409);

    const contatoComplementado = await banco.query(
      `
        SELECT nome, bairro, idade, problema, descricao_problema,
          participou_eleicao_anterior
        FROM contatos WHERE telefone_normalizado = $1
      `,
      [PREFIXO + '003']
    );
    assert.strictEqual(contatoComplementado.rows[0].nome, 'Complementado');
    assert.strictEqual(contatoComplementado.rows[0].idade, 50);
    const historico = await banco.query(
      `
        SELECT COUNT(*)::integer AS total FROM historico_contatos
        WHERE contato_id = (SELECT id FROM contatos WHERE telefone_normalizado = $1)
      `,
      [PREFIXO + '003']
    );
    assert.strictEqual(historico.rows[0].total, 1);

    const registrosComunicacao = await banco.query(
      `
        SELECT
          (SELECT COUNT(*)::integer FROM consentimentos AS c
            INNER JOIN contatos AS t ON t.id = c.contato_id
            WHERE t.telefone_normalizado LIKE $1 AND c.tipo IN ('mensagens','ligacoes')) AS consentimentos,
          (SELECT COUNT(*)::integer FROM aceites_privacidade AS a
            INNER JOIN contatos AS t ON t.id = a.contato_id
            WHERE t.telefone_normalizado LIKE $1) AS aceites
      `,
      [PREFIXO + '%']
    );
    assert.strictEqual(registrosComunicacao.rows[0].consentimentos, 0);
    assert.strictEqual(registrosComunicacao.rows[0].aceites, 0);

    const pasta = new ExcelJS.Workbook();
    const planilha = pasta.addWorksheet('Contatos');
    planilha.addRow(['telefone', 'nome', 'bairro', 'idade', 'categoria']);
    planilha.addRow([PREFIXO + '004', 'Contato XLSX', 'Centro', 29, 'Educação']);
    const bufferXlsx = await pasta.xlsx.writeBuffer();
    const visualizacaoXlsx = await requisitar(baseUrl, '/api/admin/importacoes/pre-visualizar', {
      method: 'POST',
      headers: cabecalhos,
      body: criarFormulario(
        bufferXlsx,
        'contatos.xlsx',
        ORIGENS[1],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    });
    assert.strictEqual(visualizacaoXlsx.status, 201);
    const confirmacaoXlsx = await requisitar(
      baseUrl,
      '/api/admin/importacoes/' + visualizacaoXlsx.corpo.importacao.importacaoId + '/confirmar',
      { method: 'POST', headers: cabecalhos }
    );
    assert.strictEqual(confirmacaoXlsx.status, 200);
    assert.strictEqual(confirmacaoXlsx.corpo.relatorio.criados, 1);

    const novaVisualizacao = await requisitar(baseUrl, '/api/admin/importacoes/pre-visualizar', {
      method: 'POST',
      headers: cabecalhos,
      body: criarFormulario(
        'telefone;nome\n' + PREFIXO + '001;Outro nome',
        'repetido.csv',
        ORIGENS[0],
        'text/csv'
      )
    });
    const repetida = await requisitar(
      baseUrl,
      '/api/admin/importacoes/' + novaVisualizacao.corpo.importacao.importacaoId + '/confirmar',
      { method: 'POST', headers: cabecalhos }
    );
    assert.strictEqual(repetida.corpo.relatorio.ignorados, 1);

    console.log('Importações: 20 verificações aprovadas.');
    console.log('CSV, XLSX, inválidos, duplicados, complementação e reimportação aprovados.');
  } finally {
    if (servidor) {
      await new Promise(function (resolver) { servidor.close(resolver); });
    }
    await limpar();
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro);
  process.exitCode = 1;
});
