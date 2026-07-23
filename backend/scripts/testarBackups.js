require('dotenv').config({ quiet: true });

const assert = require('assert');
const bcrypt = require('bcrypt');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');

const EMAIL_ADMIN = 'backup.admin@invalid.local';
const EMAIL_OPERADOR = 'backup.operador@invalid.local';
const SENHA = 'BackupTeste123!';
let total = 0;

function verificar(condicao, mensagem) {
  total += 1;
  assert.ok(condicao, mensagem);
}

async function limpar() {
  const emails = [EMAIL_ADMIN, EMAIL_OPERADOR];
  await banco.query(
    `DELETE FROM backups_banco
     WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1::text[]))`,
    [emails]
  );
  await banco.query('DELETE FROM tentativas_login WHERE email_informado = ANY($1::text[])', [emails]);
  await banco.query('DELETE FROM usuarios WHERE email = ANY($1::text[])', [emails]);
}

async function requisitarJson(baseUrl, caminho, opcoes) {
  const resposta = await fetch(baseUrl + caminho, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opcoes || {}));
  return { status: resposta.status, corpo: await resposta.json() };
}

async function login(baseUrl, email) {
  return requisitarJson(baseUrl, '/api/autenticacao/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: SENHA })
  });
}

function caminhoPgRestore() {
  if (process.env.PG_RESTORE_CAMINHO) {
    return process.env.PG_RESTORE_CAMINHO;
  }
  const windows = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe';
  return process.platform === 'win32' && fs.existsSync(windows) ? windows : 'pg_restore';
}

async function executar() {
  let servidor;
  let diretorio;

  try {
    await limpar();
    const hash = await bcrypt.hash(SENHA, 4);
    await banco.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       VALUES ('Admin Backup', $1, $3, 'administrador'),
              ('Operador Backup', $2, $3, 'operador')`,
      [EMAIL_ADMIN, EMAIL_OPERADOR, hash]
    );
    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;
    const admin = await login(baseUrl, EMAIL_ADMIN);
    const operador = await login(baseUrl, EMAIL_OPERADOR);
    verificar(admin.status === 200, 'Login do administrador falhou.');
    verificar(operador.status === 200, 'Login do operador falhou.');
    const adminHeaders = { Authorization: 'Bearer ' + admin.corpo.token };
    const operadorHeaders = { Authorization: 'Bearer ' + operador.corpo.token };

    verificar((await fetch(baseUrl + '/api/admin/backups')).status === 401, 'Histórico sem token não retornou 401.');
    verificar((await fetch(baseUrl + '/api/admin/backups', { headers: operadorHeaders })).status === 403, 'Operador acessou histórico de backup.');
    verificar((await fetch(baseUrl + '/api/admin/backups/banco', { method: 'POST', headers: operadorHeaders })).status === 403, 'Operador gerou backup.');

    const resposta = await fetch(baseUrl + '/api/admin/backups/banco', {
      method: 'POST',
      headers: adminHeaders
    });
    verificar(resposta.status === 200, 'Administrador não conseguiu gerar backup.');
    verificar(
      /^attachment; filename="a-voz-do-bairro-backup-completo-postgresql-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.backup"$/.test(
        resposta.headers.get('content-disposition') || ''
      ),
      'Nome do arquivo de backup não segue o padrão oficial.'
    );
    const buffer = Buffer.from(await resposta.arrayBuffer());
    verificar(buffer.subarray(0, 5).toString() === 'PGDMP', 'Arquivo não está no formato custom do PostgreSQL.');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
    verificar(resposta.headers.get('x-backup-sha256') === sha256, 'SHA-256 do download não confere.');

    diretorio = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'teste-backup-'));
    const arquivo = path.join(diretorio, 'teste.backup');
    await fs.promises.writeFile(arquivo, buffer);
    const validacao = childProcess.spawnSync(caminhoPgRestore(), ['--list', arquivo], {
      encoding: 'utf8',
      windowsHide: true,
      shell: false
    });
    verificar(validacao.status === 0, 'pg_restore não reconheceu o backup gerado.');
    verificar(validacao.stdout.includes('TABLE'), 'Backup não contém estruturas de tabela.');

    const historico = await requisitarJson(baseUrl, '/api/admin/backups', {
      headers: Object.assign({ 'Content-Type': 'application/json' }, adminHeaders)
    });
    verificar(historico.status === 200, 'Histórico de backups falhou.');
    const backupExecutado = historico.corpo.backups.find(function (backup) {
      return backup.sha256 === sha256;
    });
    verificar(Boolean(backupExecutado), 'Histórico não contém a operação executada.');
    verificar(backupExecutado.status === 'concluido', 'Backup não foi marcado como concluído.');
    verificar(backupExecutado.sha256 === sha256, 'Histórico não preservou o SHA-256.');

    const caminhoOriginal = process.env.PG_DUMP_CAMINHO;
    process.env.PG_DUMP_CAMINHO = path.join(diretorio, 'pg_dump_inexistente');
    const falha = await fetch(baseUrl + '/api/admin/backups/banco', {
      method: 'POST',
      headers: adminHeaders
    });
    if (caminhoOriginal === undefined) {
      delete process.env.PG_DUMP_CAMINHO;
    } else {
      process.env.PG_DUMP_CAMINHO = caminhoOriginal;
    }
    verificar(falha.status === 500, 'Falha do pg_dump não retornou erro controlado.');
    const historicoComFalha = await requisitarJson(baseUrl, '/api/admin/backups', {
      headers: Object.assign({ 'Content-Type': 'application/json' }, adminHeaders)
    });
    verificar(historicoComFalha.corpo.backups[0].status === 'falhou', 'Falha do backup não foi auditada.');
    verificar(Boolean(historicoComFalha.corpo.backups[0].mensagemErro), 'Auditoria da falha não guardou diagnóstico.');

    console.log('Backups administrativos: ' + total + ' verificações aprovadas.');
  } finally {
    if (servidor) {
      await new Promise(function (resolver) { servidor.close(resolver); });
    }
    if (diretorio) {
      await fs.promises.rm(diretorio, { recursive: true, force: true });
    }
    await limpar();
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro.stack || erro.message);
  process.exitCode = 1;
});
