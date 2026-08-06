require('dotenv').config({ quiet: true });

const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');
const formatarTelefone = require('../src/utils/formatarTelefone');

const TELEFONE = '21999984001';
const EMAIL_TESTE = 'relatorios.teste@invalid.local';

async function limpar() {
  const resultado = await banco.query('SELECT id FROM contatos WHERE telefone_normalizado = $1', [TELEFONE]);
  if (resultado.rows[0]) {
    const id = resultado.rows[0].id;
    await banco.query('DELETE FROM aceites_privacidade WHERE contato_id = $1', [id]);
    await banco.query('DELETE FROM consentimentos WHERE contato_id = $1', [id]);
    await banco.query('DELETE FROM historico_contatos WHERE contato_id = $1', [id]);
    await banco.query('DELETE FROM contatos WHERE id = $1', [id]);
  }

  await banco.query('DELETE FROM tentativas_login WHERE email_informado = $1', [EMAIL_TESTE]);
  await banco.query('DELETE FROM usuarios WHERE email = $1', [EMAIL_TESTE]);
}

async function executar() {
  let servidor;

  try {
    await limpar();
    const senhaHash = await bcrypt.hash('SenhaRelatorios123!', 4);
    const usuario = await banco.query(
      `
        INSERT INTO usuarios (nome, email, senha_hash, perfil)
        VALUES ('Operador Relatórios', $1, $2, 'operador')
        RETURNING id, email, perfil
      `,
      [EMAIL_TESTE, senhaHash]
    );
    const token = jwt.sign(
      usuario.rows[0],
      process.env.JWT_SECRET || process.env.JWT_SEGREDO,
      { expiresIn: '10m' }
    );
    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;
    const cadastro = await fetch(baseUrl + '/api/publico/contatos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Relatório Teste',
        telefone: TELEFONE,
        idade: 37,
        bairro: 'Vila Kennedy',
        problema: 'Saúde',
        aceitePrivacidade: true,
        autorizacaoMensagens: true,
        autorizacaoLigacoes: false
      })
    });
    assert.strictEqual(cadastro.status, 201);
    assert.strictEqual((await fetch(
      baseUrl + '/api/admin/relatorios/resumo?telefone=' + TELEFONE
    )).status, 401);

    const cabecalhos = { Authorization: 'Bearer ' + token };
    const respostaResumo = await fetch(
      baseUrl + '/api/admin/relatorios/resumo?telefone=' + TELEFONE,
      { headers: cabecalhos }
    );
    assert.strictEqual(respostaResumo.status, 200);
    const resumo = (await respostaResumo.json()).resumo;
    assert.strictEqual(resumo.totalContatos, 1);
    assert.strictEqual(resumo.porBairro[0].nome, 'Vila Kennedy');
    assert.strictEqual(resumo.porProblema[0].nome, 'Saúde');
    assert.strictEqual(resumo.problemasPorBairro[0].bairro, 'Vila Kennedy');
    assert.strictEqual(resumo.problemasPorBairro[0].problemas[0].nome, 'Saúde');
    assert.strictEqual(resumo.porFaixaEtaria[0].nome, '35 a 44');
    assert.strictEqual(Array.isArray(resumo.porOrigem), true);
    assert.strictEqual(resumo.porAutorizacaoMensagens[0].nome, 'autorizado');
    assert.strictEqual(resumo.porAutorizacaoLigacoes[0].nome, 'nao_informado');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(resumo.porPeriodo[0].nome));

    const respostaCsv = await fetch(
      baseUrl + '/api/admin/relatorios/exportar.csv?telefone=' + TELEFONE,
      { headers: cabecalhos }
    );
    assert.strictEqual(respostaCsv.status, 403);
    const respostaExcelOperador = await fetch(
      baseUrl + '/api/admin/relatorios/exportar.xlsx?telefone=' + TELEFONE,
      { headers: cabecalhos }
    );
    assert.strictEqual(respostaExcelOperador.status, 403);
    await banco.query('UPDATE usuarios SET perfil = \'administrador\' WHERE id = $1', [usuario.rows[0].id]);
    const tokenAdministrador = jwt.sign(
      Object.assign({}, usuario.rows[0], { perfil: 'administrador' }),
      process.env.JWT_SECRET || process.env.JWT_SEGREDO,
      { expiresIn: '10m' }
    );
    const respostaCsvAdministrador = await fetch(
      baseUrl + '/api/admin/relatorios/exportar.csv?telefone=' + TELEFONE,
      { headers: { Authorization: 'Bearer ' + tokenAdministrador } }
    );
    assert.strictEqual(respostaCsvAdministrador.status, 200);
    assert.ok(respostaCsvAdministrador.headers.get('content-type').includes('text/csv'));
    assert.match(
      respostaCsvAdministrador.headers.get('content-disposition') || '',
      /^attachment; filename="acorda-rj-contatos-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv"$/
    );
    const csv = await respostaCsvAdministrador.text();
    assert.ok(csv.includes('Relatório Teste'));
    assert.ok(csv.includes(formatarTelefone(TELEFONE)));
    assert.ok(csv.includes('autorizado'));
    assert.strictEqual(csv.includes('telefone_normalizado'), false);

    const respostaExcel = await fetch(
      baseUrl + '/api/admin/relatorios/exportar.xlsx?telefone=' + TELEFONE,
      { headers: { Authorization: 'Bearer ' + tokenAdministrador } }
    );
    assert.strictEqual(respostaExcel.status, 200);
    assert.ok(respostaExcel.headers.get('content-type').includes('spreadsheetml.sheet'));
    assert.match(
      respostaExcel.headers.get('content-disposition') || '',
      /^attachment; filename="acorda-rj-contatos-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.xlsx"$/
    );
    const pasta = new ExcelJS.Workbook();
    await pasta.xlsx.load(Buffer.from(await respostaExcel.arrayBuffer()));
    const planilha = pasta.getWorksheet('Contatos');
    assert.ok(planilha, 'A planilha Contatos não foi encontrada.');
    assert.strictEqual(planilha.rowCount, 2);
    assert.strictEqual(planilha.getCell('B2').value, 'Relatório Teste');
    assert.strictEqual(planilha.getCell('C2').value, formatarTelefone(TELEFONE));

    console.log('Relatórios: 25 verificações aprovadas.');
    console.log('Agregações e exportações CSV/XLSX autenticadas aprovadas.');
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
