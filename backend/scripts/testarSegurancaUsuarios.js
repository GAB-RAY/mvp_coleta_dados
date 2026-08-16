require('dotenv').config({ quiet: true });

const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');
const usuarioService = require('../src/modules/usuarios/usuarioService');

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

  return { status: resposta.status, corpo, headers: resposta.headers };
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
  let eventoPreservadoId;
  let templatePreservadoId;
  let importacaoHistoricaId;
  let solicitacaoHistoricaId;
  let historicoConfiguracaoId;

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

    const acessoSemToken = await requisitar(baseUrl, '/api/admin/usuarios');
    assert.strictEqual(acessoSemToken.status, 401);
    assert.strictEqual(acessoSemToken.headers.get('cache-control'), 'no-store');

    const loginAdmin = await login(baseUrl, EMAIL_ADMIN, SENHA);
    assert.strictEqual(loginAdmin.status, 200);
    assert.strictEqual(loginAdmin.headers.get('cache-control'), 'no-store');
    assert.strictEqual(loginAdmin.headers.get('pragma'), 'no-cache');
    assert.strictEqual(loginAdmin.corpo.usuario.perfil, 'administrador');
    const cabecalhosAdmin = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + loginAdmin.corpo.token
    };
    const dadosTokenAdmin = jwt.decode(loginAdmin.corpo.token);
    const tokenAlgoritmoNaoPermitido = jwt.sign(
      {
        id: dadosTokenAdmin.id,
        email: dadosTokenAdmin.email,
        perfil: dadosTokenAdmin.perfil
      },
      process.env.JWT_SECRET || process.env.JWT_SEGREDO,
      { algorithm: 'HS384', expiresIn: '5m' }
    );
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios', {
      headers: { Authorization: 'Bearer ' + tokenAlgoritmoNaoPermitido }
    })).status, 401);

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
    assert.strictEqual(listagem.headers.get('cache-control'), 'no-store');
    assert.strictEqual(listagem.headers.get('pragma'), 'no-cache');
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
    const loginNovoAdmin = await login(baseUrl, EMAIL_NOVO_ADMIN, SENHA);
    assert.strictEqual(loginNovoAdmin.status, 200);

    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios/meu-perfil/senha', {
      method: 'PATCH',
      body: JSON.stringify({ senhaAtual: SENHA, novaSenha: NOVA_SENHA_ADMIN })
    })).status, 401);
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios/meu-perfil/senha', {
      method: 'PATCH',
      headers: cabecalhosOperador,
      body: JSON.stringify({ senhaAtual: SENHA, novaSenha: NOVA_SENHA_ADMIN })
    })).status, 403);
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios/meu-perfil/senha', {
      method: 'PATCH',
      headers: cabecalhosAdmin,
      body: JSON.stringify({ senhaAtual: 'SenhaAtualIncorreta!', novaSenha: NOVA_SENHA_ADMIN })
    })).status, 400);
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios/meu-perfil/senha', {
      method: 'PATCH',
      headers: cabecalhosAdmin,
      body: JSON.stringify({ senhaAtual: SENHA, novaSenha: 'curta' })
    })).status, 400);
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios/meu-perfil/senha', {
      method: 'PATCH',
      headers: cabecalhosAdmin,
      body: JSON.stringify({ senhaAtual: SENHA, novaSenha: SENHA })
    })).status, 400);

    const alteracaoPropriaSenha = await requisitar(
      baseUrl,
      '/api/admin/usuarios/meu-perfil/senha',
      {
        method: 'PATCH',
        headers: cabecalhosAdmin,
        body: JSON.stringify({ senhaAtual: SENHA, novaSenha: NOVA_SENHA_ADMIN })
      }
    );
    assert.strictEqual(alteracaoPropriaSenha.status, 200);
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(alteracaoPropriaSenha.corpo.usuario, 'senhaHash'),
      false
    );
    assert.strictEqual((await login(baseUrl, EMAIL_ADMIN, SENHA)).status, 401);
    assert.strictEqual((await login(baseUrl, EMAIL_ADMIN, NOVA_SENHA_ADMIN)).status, 200);

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

    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + novoAdmin.corpo.usuario.id,
      { method: 'DELETE', headers: cabecalhosOperador }
    )).status, 403);
    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + loginAdmin.corpo.usuario.id,
      { method: 'DELETE', headers: cabecalhosAdmin }
    )).status, 400);

    const origemId = (await banco.query('SELECT id FROM origens ORDER BY id LIMIT 1')).rows[0].id;
    eventoPreservadoId = (await banco.query(`
      INSERT INTO eventos (nome,motivo,data_inicial,data_final,inscricoes_inicio,
        inscricoes_fim,status,criado_por_usuario_id,atualizado_por_usuario_id)
      VALUES ('Evento preservado QA','Teste de exclusao',CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + INTERVAL '1 day',CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + INTERVAL '1 hour','rascunho',$1,$1) RETURNING id
    `, [novoAdmin.corpo.usuario.id])).rows[0].id;
    await banco.query(`INSERT INTO historico_eventos
      (evento_id,tipo_acao,dados_novos,usuario_id)
      VALUES ($1,'criacao','{}'::jsonb,$2)`, [eventoPreservadoId, novoAdmin.corpo.usuario.id]);
    templatePreservadoId = (await banco.query(`
      INSERT INTO modelos_mensagem (nome,categoria,texto,criado_por_usuario_id,atualizado_por_usuario_id)
      VALUES ('Template preservado QA','Teste','Mensagem preservada',$1,$1) RETURNING id
    `, [novoAdmin.corpo.usuario.id])).rows[0].id;
    await banco.query(`INSERT INTO historico_modelos_mensagem_meta
      (modelo_id,acao,origem,usuario_id)
      VALUES ($1,'rascunho_criado','sistema',$2)`, [templatePreservadoId, novoAdmin.corpo.usuario.id]);
    importacaoHistoricaId = (await banco.query(`
      INSERT INTO importacoes (nome_arquivo,formato,origem_id,usuario_id,status)
      VALUES ('historico-usuario.csv','csv',$1,$2,'concluida') RETURNING id
    `, [origemId, novoAdmin.corpo.usuario.id])).rows[0].id;
    solicitacaoHistoricaId = (await banco.query(`
      INSERT INTO solicitacoes_exclusao
        (contato_id,contato_id_original,status,solicitada_por_usuario_id)
      VALUES (NULL,999999999,'pendente',$1) RETURNING id
    `, [novoAdmin.corpo.usuario.id])).rows[0].id;
    historicoConfiguracaoId = (await banco.query(`
      INSERT INTO historico_configuracoes_sistema
        (chave,valor_anterior,valor_novo,motivo,usuario_id)
      VALUES ('qa_exclusao_usuario',1,2,'Teste de exclusao',$1) RETURNING id
    `, [novoAdmin.corpo.usuario.id])).rows[0].id;

    const exclusaoAdmin = await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + novoAdmin.corpo.usuario.id,
      { method: 'DELETE', headers: cabecalhosAdmin }
    );
    assert.strictEqual(exclusaoAdmin.status, 200);
    assert.strictEqual((await requisitar(baseUrl, '/api/admin/usuarios', {
      headers: { Authorization: 'Bearer ' + loginNovoAdmin.corpo.token }
    })).status, 401);
    assert.strictEqual((await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + novoAdmin.corpo.usuario.id,
      { method: 'DELETE', headers: cabecalhosAdmin }
    )).status, 404);

    const rastrosAdminExcluido = (await banco.query(`SELECT
      (SELECT COUNT(*)::integer FROM tentativas_login WHERE email_informado=$1) AS logins,
      (SELECT COUNT(*)::integer FROM historico_eventos WHERE usuario_id=$2) AS historicos_eventos,
      (SELECT COUNT(*)::integer FROM historico_modelos_mensagem_meta WHERE usuario_id=$2) AS historicos_modelos,
      (SELECT COUNT(*)::integer FROM importacoes WHERE id=$3) AS importacoes,
      (SELECT COUNT(*)::integer FROM solicitacoes_exclusao WHERE id=$4) AS exclusoes,
      (SELECT COUNT(*)::integer FROM historico_configuracoes_sistema WHERE id=$5) AS historicos_configuracoes
    `, [EMAIL_NOVO_ADMIN, novoAdmin.corpo.usuario.id, importacaoHistoricaId,
      solicitacaoHistoricaId, historicoConfiguracaoId])).rows[0];
    assert.ok(Object.values(rastrosAdminExcluido).every(function (total) { return Number(total) === 0; }));
    const eventoPreservado = (await banco.query(`SELECT criado_por_usuario_id,atualizado_por_usuario_id
      FROM eventos WHERE id=$1`, [eventoPreservadoId])).rows[0];
    assert.strictEqual(Number(eventoPreservado.criado_por_usuario_id), Number(loginAdmin.corpo.usuario.id));
    assert.strictEqual(Number(eventoPreservado.atualizado_por_usuario_id), Number(loginAdmin.corpo.usuario.id));
    const templatePreservado = (await banco.query(`SELECT criado_por_usuario_id,atualizado_por_usuario_id
      FROM modelos_mensagem WHERE id=$1`, [templatePreservadoId])).rows[0];
    assert.strictEqual(templatePreservado.criado_por_usuario_id, null);
    assert.strictEqual(templatePreservado.atualizado_por_usuario_id, null);

    const exclusaoOperador = await requisitar(
      baseUrl,
      '/api/admin/usuarios/' + novoOperador.corpo.usuario.id,
      { method: 'DELETE', headers: cabecalhosAdmin }
    );
    assert.strictEqual(exclusaoOperador.status, 200);
    assert.strictEqual((await login(baseUrl, EMAIL_NOVO_OPERADOR, NOVA_SENHA_OPERADOR)).status, 401);

    const outrosAdministradores = await banco.query(
      `UPDATE usuarios SET ativo = FALSE
       WHERE perfil = 'administrador' AND ativo = TRUE AND id <> $1
       RETURNING id`,
      [loginAdmin.corpo.usuario.id]
    );
    try {
      await assert.rejects(
        usuarioService.excluirUsuario(loginAdmin.corpo.usuario.id, {
          id: 999999,
          perfil: 'administrador'
        }),
        function (erro) { return erro.statusHttp === 409; }
      );
    } finally {
      if (outrosAdministradores.rows.length > 0) {
        await banco.query(
          'UPDATE usuarios SET ativo = TRUE WHERE id = ANY($1::bigint[])',
          [outrosAdministradores.rows.map(function (item) { return item.id; })]
        );
      }
    }

    console.log('Segurança e usuários aprovados.');
    console.log('Perfis, senhas, exclusão de administrador e operador, último administrador, permissões, auditoria e bloqueio aprovados.');
  } finally {
    if (servidor) {
      await new Promise(function (resolver) {
        servidor.close(resolver);
      });
    }

    if (solicitacaoHistoricaId) await banco.query('DELETE FROM solicitacoes_exclusao WHERE id=$1', [solicitacaoHistoricaId]);
    if (importacaoHistoricaId) await banco.query('DELETE FROM importacoes WHERE id=$1', [importacaoHistoricaId]);
    if (historicoConfiguracaoId) await banco.query('DELETE FROM historico_configuracoes_sistema WHERE id=$1', [historicoConfiguracaoId]);
    if (templatePreservadoId) {
      await banco.query('DELETE FROM historico_modelos_mensagem_meta WHERE modelo_id=$1', [templatePreservadoId]);
      await banco.query('DELETE FROM modelos_mensagem WHERE id=$1', [templatePreservadoId]);
    }
    if (eventoPreservadoId) {
      await banco.query('DELETE FROM historico_eventos WHERE evento_id=$1', [eventoPreservadoId]);
      await banco.query('DELETE FROM eventos WHERE id=$1', [eventoPreservadoId]);
    }

    await limpar();
    await banco.end();
  }
}

executar().catch(function (erro) {
  console.error(erro);
  process.exitCode = 1;
});
