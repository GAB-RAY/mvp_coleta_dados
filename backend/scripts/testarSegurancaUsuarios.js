require('dotenv').config({ quiet: true });

const assert = require('assert');
const bcrypt = require('bcrypt');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');

const EMAIL_ADMIN = 'seguranca.admin@invalid.local';
const EMAIL_OPERADOR = 'seguranca.operador@invalid.local';
const EMAIL_NOVO_ADMIN = 'novo.admin@invalid.local';
const EMAIL_NOVO_OPERADOR = 'novo.operador@invalid.local';
const EMAIL_DESCONHECIDO = 'nao.existe@invalid.local';
const EMAILS_TESTE = [
  EMAIL_ADMIN,
  EMAIL_OPERADOR,
  EMAIL_NOVO_ADMIN,
  EMAIL_NOVO_OPERADOR,
  EMAIL_DESCONHECIDO
];
const SENHA = 'SenhaSeguraTeste123!';
const NOVA_SENHA_OPERADOR = 'NovaSenhaOperador123!';
const NOVA_SENHA_ADMIN = 'NovaSenhaAdmin123!';

async function requisitar(baseUrl, caminho, opcoes) {
  const resposta = await fetch(baseUrl + caminho, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opcoes || {}));
  const corpo = await resposta.json();

  return { status: resposta.status, corpo };
}

async function limpar() {
  await banco.query(
    'DELETE FROM tentativas_login WHERE LOWER(email_informado) = ANY($1::text[])',
    [EMAILS_TESTE]
  );
  await banco.query(
    'DELETE FROM usuarios WHERE LOWER(email) = ANY($1::text[])',
    [EMAILS_TESTE]
  );
}

async function criarUsuarioTemporario(nome, email, perfil, senhaHash) {
  await banco.query(
    `
      INSERT INTO usuarios (nome, email, senha_hash, perfil)
      VALUES ($1, $2, $3, $4)
    `,
    [nome, email, senhaHash, perfil]
  );
}

async function login(baseUrl, email, senha) {
  return requisitar(baseUrl, '/api/autenticacao/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha })
  });
}

async function executar() {
  let servidor;

  try {
    await limpar();
    const senhaHash = await bcrypt.hash(SENHA, 4);
    await criarUsuarioTemporario('Admin Segurança', EMAIL_ADMIN, 'administrador', senhaHash);
    await criarUsuarioTemporario('Operador Segurança', EMAIL_OPERADOR, 'operador', senhaHash);

    servidor = aplicacao.listen(0);
    await new Promise(function (resolver, rejeitar) {
      servidor.once('listening', resolver);
      servidor.once('error', rejeitar);
    });
    const baseUrl = 'http://127.0.0.1:' + servidor.address().port;

    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios')).status, 401);

    const loginAdmin = await login(baseUrl, EMAIL_ADMIN, SENHA);
    assert.strictEqual(loginAdmin.status, 200);
    assert.strictEqual(loginAdmin.corpo.usuario.perfil, 'administrador');
    const cabecalhosAdmin = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + loginAdmin.corpo.token
    };

    const loginOperador = await login(baseUrl, EMAIL_OPERADOR, SENHA);
    assert.strictEqual(loginOperador.status, 200);
    assert.strictEqual(loginOperador.corpo.usuario.perfil, 'operador');
    const cabecalhosOperador = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + loginOperador.corpo.token
    };

    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios/meu-perfil', {
      method: 'PATCH',
      body: JSON.stringify({ nome: 'Admin sem token' })
    })).status, 401);
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios/meu-perfil', {
      method: 'PATCH',
      headers: cabecalhosOperador,
      body: JSON.stringify({ nome: 'Operador sem permissão' })
    })).status, 403);
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios/meu-perfil', {
      method: 'PATCH',
      headers: cabecalhosAdmin,
      body: JSON.stringify({ nome: 'A' })
    })).status, 400);
    const nomeAtualizado = await requisitar(baseUrl, '/api/admin/usuarios/meu-perfil', {
      method: 'PATCH',
      headers: cabecalhosAdmin,
      body: JSON.stringify({ nome: 'Gabriel Administrador' })
    });
    assert.strictEqual(nomeAtualizado.status, 200);
    assert.strictEqual(nomeAtualizado.corpo.usuario.nome, 'Gabriel Administrador');

    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios', {
      headers: cabecalhosOperador
    })).status, 403);
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios', {
      method: 'POST',
      headers: cabecalhosOperador,
      body: JSON.stringify({
        nome: 'Sem permissão',
        email: 'sem.permissao@invalid.local',
        senha: SENHA,
        perfil: 'operador'
      })
    })).status, 403);

    const listagem = await requisitar(baseUrl, '/api/admin/usuarios', {
      headers: cabecalhosAdmin
    });
    assert.strictEqual(listagem.status, 200);
    assert.ok(listagem.corpo.usuarios.length >= 2);
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(listagem.corpo.usuarios[0], 'senhaHash'),
      false
    );

    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify({
        nome: 'Senha curta',
        email: 'senha.curta@invalid.local',
        senha: 'curta',
        perfil: 'operador'
      })
    })).status, 400);
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify({
        nome: 'Perfil inválido',
        email: 'perfil.invalido@invalid.local',
        senha: SENHA,
        perfil: 'gerente'
      })
    })).status, 400);

    const novoOperador = await requisitar(baseUrl, '/api/admin/usuarios', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify({
        nome: 'Novo Operador',
        email: EMAIL_NOVO_OPERADOR,
        senha: SENHA,
        perfil: 'operador'
      })
    });
    assert.strictEqual(novoOperador.status, 201);
    assert.strictEqual(novoOperador.corpo.usuario.perfil, 'operador');
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(novoOperador.corpo.usuario, 'senhaHash'),
      false
    );

    const novoAdmin = await requisitar(baseUrl, '/api/admin/usuarios', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify({
        nome: 'Novo Admin',
        email: EMAIL_NOVO_ADMIN,
        senha: SENHA,
        perfil: 'administrador'
      })
    });
    assert.strictEqual(novoAdmin.status, 201);
    assert.strictEqual(novoAdmin.corpo.usuario.perfil, 'administrador');
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios', {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify({
        nome: 'Duplicado',
        email: EMAIL_NOVO_ADMIN,
        senha: SENHA,
        perfil: 'administrador'
      })
    })).status, 409);

    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + novoOperador.corpo.usuario.id + '/senha',
      {
        method: 'PATCH',
        body: JSON.stringify({ novaSenha: NOVA_SENHA_OPERADOR })
      }
    )).status, 401);
    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + novoOperador.corpo.usuario.id + '/senha',
      {
        method: 'PATCH',
        headers: cabecalhosOperador,
        body: JSON.stringify({ novaSenha: NOVA_SENHA_OPERADOR })
      }
    )).status, 403);
    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/invalido/senha',
      {
        method: 'PATCH',
        headers: cabecalhosAdmin,
        body: JSON.stringify({ novaSenha: NOVA_SENHA_OPERADOR })
      }
    )).status, 400);
    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + novoOperador.corpo.usuario.id + '/senha',
      {
        method: 'PATCH',
        headers: cabecalhosAdmin,
        body: JSON.stringify({ novaSenha: 'curta' })
      }
    )).status, 400);
    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + loginAdmin.corpo.usuario.id + '/senha',
      {
        method: 'PATCH',
        headers: cabecalhosAdmin,
        body: JSON.stringify({ novaSenha: NOVA_SENHA_ADMIN })
      }
    )).status, 400);
    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/999999/senha',
      {
        method: 'PATCH',
        headers: cabecalhosAdmin,
        body: JSON.stringify({ novaSenha: NOVA_SENHA_OPERADOR })
      }
    )).status, 404);

    const senhaOperadorRedefinida = await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + novoOperador.corpo.usuario.id + '/senha',
      {
        method: 'PATCH',
        headers: cabecalhosAdmin,
        body: JSON.stringify({ novaSenha: NOVA_SENHA_OPERADOR })
      }
    );
    assert.strictEqual(senhaOperadorRedefinida.status, 200);
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(senhaOperadorRedefinida.corpo.usuario, 'senhaHash'),
      false
    );
    assert.strictEqual((await login(baseUrl, EMAIL_NOVO_OPERADOR, SENHA)).status, 401);
    assert.strictEqual(
      (await login(baseUrl, EMAIL_NOVO_OPERADOR, NOVA_SENHA_OPERADOR)).status,
      200
    );

    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + novoAdmin.corpo.usuario.id + '/senha',
      {
        method: 'PATCH',
        headers: cabecalhosAdmin,
        body: JSON.stringify({ novaSenha: NOVA_SENHA_ADMIN })
      }
    )).status, 403);
    assert.strictEqual(
      (await login(baseUrl, EMAIL_NOVO_ADMIN, SENHA)).status,
      200
    );

    let indice;
    for (indice = 0; indice < 5; indice += 1) {
      assert.strictEqual((await login(baseUrl, EMAIL_OPERADOR, 'SenhaIncorreta!')).status, 401);
    }
    assert.strictEqual((await login(baseUrl, EMAIL_OPERADOR, SENHA)).status, 429);

    const estadoBloqueio = await banco.query(
      `
        SELECT tentativas_login_falhas, bloqueado_ate
        FROM usuarios
        WHERE email = $1
      `,
      [EMAIL_OPERADOR]
    );
    assert.strictEqual(estadoBloqueio.rows[0].tentativas_login_falhas, 5);
    assert.ok(estadoBloqueio.rows[0].bloqueado_ate);

    const auditoria = await banco.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE sucesso = TRUE)::integer AS sucessos,
          COUNT(*) FILTER (WHERE motivo = 'credenciais_invalidas')::integer AS falhas,
          COUNT(*) FILTER (WHERE motivo = 'conta_bloqueada')::integer AS bloqueios
        FROM tentativas_login
        WHERE email_informado = $1
      `,
      [EMAIL_OPERADOR]
    );
    assert.ok(auditoria.rows[0].sucessos >= 1);
    assert.strictEqual(auditoria.rows[0].falhas, 5);
    assert.strictEqual(auditoria.rows[0].bloqueios, 1);

    await banco.query(
      `
        UPDATE usuarios
        SET tentativas_login_falhas = 0, bloqueado_ate = NULL
        WHERE email = $1
      `,
      [EMAIL_OPERADOR]
    );
    await banco.query(
      'DELETE FROM tentativas_login WHERE email_informado = $1 AND sucesso = FALSE',
      [EMAIL_OPERADOR]
    );
    assert.strictEqual((await login(baseUrl, EMAIL_OPERADOR, SENHA)).status, 200);

    for (indice = 0; indice < 5; indice += 1) {
      assert.strictEqual((await login(baseUrl, EMAIL_DESCONHECIDO, 'SenhaIncorreta!')).status, 401);
    }
    assert.strictEqual((await login(baseUrl, EMAIL_DESCONHECIDO, 'SenhaIncorreta!')).status, 429);

    console.log('Segurança e usuários: 54 verificações aprovadas.');
    console.log('Perfis, redefinição de senha, permissões, auditoria e bloqueio aprovados.');
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
