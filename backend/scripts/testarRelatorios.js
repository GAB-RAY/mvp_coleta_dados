require('dotenv').config({ quiet: true });

const assert = require('assert');
const jwt = require('jsonwebtoken');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');

const TELEFONE = '21999984001';

async function limpar() {
  const resultado = await banco.query('SELECT id FROM contatos WHERE telefone_normalizado = $1', [TELEFONE]);
  if (!resultado.rows[0]) {
    return;
  }
  const id = resultado.rows[0].id;
  await banco.query('DELETE FROM aceites_privacidade WHERE contato_id = $1', [id]);
  await banco.query('DELETE FROM consentimentos WHERE contato_id = $1', [id]);
  await banco.query('DELETE FROM historico_contatos WHERE contato_id = $1', [id]);
  await banco.query('DELETE FROM contatos WHERE id = $1', [id]);
}

async function executar() {
  let servidor;

  try {
    await limpar();
    const usuario = await banco.query('SELECT id, email FROM usuarios ORDER BY id LIMIT 1');
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
        participouEleicaoAnterior: 'sim',
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
    assert.strictEqual(resumo.porFaixaEtaria[0].nome, '35 a 44');
    assert.strictEqual(resumo.porParticipacaoEleitoral[0].nome, 'sim');
    assert.strictEqual(resumo.porAutorizacaoMensagens[0].nome, 'autorizado');
    assert.strictEqual(resumo.porAutorizacaoLigacoes[0].nome, 'nao_informado');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(resumo.porPeriodo[0].nome));

    const respostaCsv = await fetch(
      baseUrl + '/api/admin/relatorios/exportar.csv?telefone=' + TELEFONE,
      { headers: cabecalhos }
    );
    assert.strictEqual(respostaCsv.status, 200);
    assert.ok(respostaCsv.headers.get('content-type').includes('text/csv'));
    const csv = await respostaCsv.text();
    assert.ok(csv.includes('Relatório Teste'));
    assert.ok(csv.includes(TELEFONE));
    assert.ok(csv.includes('autorizado'));
    assert.strictEqual(csv.includes('telefone_normalizado'), false);

    console.log('Relatórios: 15 verificações aprovadas.');
    console.log('Agregações filtradas e exportação CSV autenticada aprovadas.');
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
