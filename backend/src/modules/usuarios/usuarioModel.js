const banco = require('../../config/banco');

const CAMPOS_PUBLICOS = `
  id,
  nome,
  email,
  perfil,
  ativo,
  criado_em,
  atualizado_em
`;

async function buscarPorEmail(email) {
  const consulta = `
    SELECT
      id,
      nome,
      email,
      senha_hash,
      perfil,
      ativo,
      tentativas_login_falhas,
      bloqueado_ate
    FROM usuarios
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
  `;

  const resultado = await banco.query(consulta, [email]);

  return resultado.rows[0] || null;
}

async function buscarPorId(id) {
  const resultado = await banco.query(
    `
      SELECT id, nome, email, perfil, ativo
      FROM usuarios
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return resultado.rows[0] || null;
}

async function buscarCredenciaisPorId(id) {
  const resultado = await banco.query(
    `
      SELECT id, nome, email, senha_hash, perfil, ativo
      FROM usuarios
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return resultado.rows[0] || null;
}

async function criar(dadosDoUsuario) {
  const consulta = `
    INSERT INTO usuarios (nome, email, senha_hash, perfil)
    VALUES ($1, $2, $3, $4)
    RETURNING ${CAMPOS_PUBLICOS}
  `;

  const valores = [
    dadosDoUsuario.nome,
    dadosDoUsuario.email,
    dadosDoUsuario.senhaHash,
    dadosDoUsuario.perfil
  ];

  const resultado = await banco.query(consulta, valores);

  return resultado.rows[0];
}

async function listar() {
  const resultado = await banco.query(
    `
      SELECT ${CAMPOS_PUBLICOS}
      FROM usuarios
      ORDER BY nome ASC, id ASC
    `
  );

  return resultado.rows;
}

async function redefinirSenha(usuarioId, senhaHash) {
  const resultado = await banco.query(
    `
      UPDATE usuarios
      SET senha_hash = $2,
          tentativas_login_falhas = 0,
          bloqueado_ate = NULL,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING ${CAMPOS_PUBLICOS}
    `,
    [usuarioId, senhaHash]
  );

  return resultado.rows[0] || null;
}

async function atualizarNome(usuarioId, nome) {
  const resultado = await banco.query(
    `
      UPDATE usuarios
      SET nome = $2,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING ${CAMPOS_PUBLICOS}
    `,
    [usuarioId, nome]
  );

  return resultado.rows[0] || null;
}

async function excluirUsuario(usuarioId, usuarioSubstitutoId) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('usuarios_administradores_ativos'))");
    const atual = await cliente.query(
      'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = $1 FOR UPDATE',
      [usuarioId]
    );
    const usuario = atual.rows[0];

    if (!usuario) {
      await cliente.query('ROLLBACK');
      return null;
    }

    if (usuario.perfil === 'administrador' && usuario.ativo === true) {
      const quantidade = await cliente.query(
        "SELECT COUNT(*)::integer AS total FROM usuarios WHERE perfil = 'administrador' AND ativo = TRUE"
      );

      if (quantidade.rows[0].total <= 1) {
        const erroUltimo = new Error('É necessário manter pelo menos um administrador ativo no sistema.');
        erroUltimo.codigoAplicacao = 'ULTIMO_ADMINISTRADOR';
        throw erroUltimo;
      }
    }

    const substituto = await cliente.query(
      "SELECT id FROM usuarios WHERE id=$1 AND perfil='administrador' AND ativo=TRUE FOR UPDATE",
      [usuarioSubstitutoId]
    );
    if (!substituto.rows[0]) {
      const erroSubstituto = new Error('O administrador responsável pela exclusão não está mais ativo.');
      erroSubstituto.codigoAplicacao = 'ADMINISTRADOR_SUBSTITUTO_INVALIDO';
      throw erroSubstituto;
    }

    const exclusoesHistoricas = [
      await cliente.query('DELETE FROM historico_eventos WHERE usuario_id=$1', [usuarioId]),
      await cliente.query('DELETE FROM historico_comunicacoes WHERE usuario_id=$1', [usuarioId]),
      await cliente.query('DELETE FROM historico_modelos_mensagem_meta WHERE usuario_id=$1', [usuarioId]),
      await cliente.query('DELETE FROM historico_configuracoes_sistema WHERE usuario_id=$1', [usuarioId]),
      await cliente.query('DELETE FROM historico_contatos WHERE registrado_por_usuario_id=$1', [usuarioId]),
      await cliente.query(`DELETE FROM solicitacoes_exclusao
        WHERE solicitada_por_usuario_id=$1 OR analisada_por_usuario_id=$1`, [usuarioId]),
      await cliente.query('DELETE FROM importacoes WHERE usuario_id=$1', [usuarioId]),
      await cliente.query(`DELETE FROM tentativas_login
        WHERE usuario_id=$1 OR lower(email_informado)=lower($2)`, [usuarioId, usuario.email]),
      await cliente.query('DELETE FROM backups_banco WHERE usuario_id=$1', [usuarioId]),
      await cliente.query('DELETE FROM sincronizacoes_limite_meta WHERE usuario_id=$1', [usuarioId])
    ];

    await cliente.query(`UPDATE eventos SET
      criado_por_usuario_id=CASE WHEN criado_por_usuario_id=$1 THEN $2 ELSE criado_por_usuario_id END,
      atualizado_por_usuario_id=CASE WHEN atualizado_por_usuario_id=$1 THEN $2 ELSE atualizado_por_usuario_id END
      WHERE criado_por_usuario_id=$1 OR atualizado_por_usuario_id=$1`, [usuarioId, usuarioSubstitutoId]);
    await cliente.query(`UPDATE campanhas SET
      criado_por_usuario_id=CASE WHEN criado_por_usuario_id=$1 THEN $2 ELSE criado_por_usuario_id END,
      atualizado_por_usuario_id=CASE WHEN atualizado_por_usuario_id=$1 THEN $2 ELSE atualizado_por_usuario_id END,
      responsavel_usuario_id=CASE WHEN responsavel_usuario_id=$1 THEN $2 ELSE responsavel_usuario_id END,
      arquivada_por_usuario_id=CASE WHEN arquivada_por_usuario_id=$1 THEN NULL ELSE arquivada_por_usuario_id END
      WHERE criado_por_usuario_id=$1 OR atualizado_por_usuario_id=$1
        OR responsavel_usuario_id=$1 OR arquivada_por_usuario_id=$1`, [usuarioId, usuarioSubstitutoId]);
    await cliente.query(`UPDATE campanha_lotes SET criado_por_usuario_id=$2
      WHERE criado_por_usuario_id=$1`, [usuarioId, usuarioSubstitutoId]);
    await cliente.query(`UPDATE comunicacoes SET
      operador_usuario_id=CASE WHEN operador_usuario_id=$1 THEN $2 ELSE operador_usuario_id END,
      confirmado_por_usuario_id=CASE WHEN confirmado_por_usuario_id=$1 THEN NULL ELSE confirmado_por_usuario_id END
      WHERE operador_usuario_id=$1 OR confirmado_por_usuario_id=$1`, [usuarioId, usuarioSubstitutoId]);
    await cliente.query(`UPDATE numeros_whatsapp SET
      criado_por_usuario_id=CASE WHEN criado_por_usuario_id=$1 THEN $2 ELSE criado_por_usuario_id END,
      atualizado_por_usuario_id=CASE WHEN atualizado_por_usuario_id=$1 THEN $2 ELSE atualizado_por_usuario_id END
      WHERE criado_por_usuario_id=$1 OR atualizado_por_usuario_id=$1`, [usuarioId, usuarioSubstitutoId]);
    await cliente.query(`UPDATE modelos_mensagem SET
      criado_por_usuario_id=CASE WHEN criado_por_usuario_id=$1 THEN NULL ELSE criado_por_usuario_id END,
      atualizado_por_usuario_id=CASE WHEN atualizado_por_usuario_id=$1 THEN NULL ELSE atualizado_por_usuario_id END
      WHERE criado_por_usuario_id=$1 OR atualizado_por_usuario_id=$1`, [usuarioId]);
    await cliente.query('UPDATE configuracoes_sistema SET atualizado_por_usuario_id=NULL WHERE atualizado_por_usuario_id=$1', [usuarioId]);

    await cliente.query('DELETE FROM usuarios WHERE id = $1', [usuarioId]);

    await cliente.query('COMMIT');
    return {
      id: usuario.id,
      nome: usuario.nome,
      excluido: true,
      registrosHistoricosExcluidos: exclusoesHistoricas.reduce(function (total, resultado) {
        return total + resultado.rowCount;
      }, 0)
    };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function contarFalhasRecentesPorIp(enderecoIp, janelaMinutos) {
  const resultado = await banco.query(
    `
      SELECT COUNT(*)::integer AS total
      FROM tentativas_login
      WHERE endereco_ip = $1
        AND sucesso = FALSE
        AND motivo = 'credenciais_invalidas'
        AND criado_em >= CURRENT_TIMESTAMP - ($2::integer * INTERVAL '1 minute')
    `,
    [enderecoIp, janelaMinutos]
  );

  return resultado.rows[0].total;
}

async function contarFalhasRecentesPorEmail(email, janelaMinutos) {
  const resultado = await banco.query(
    `
      SELECT COUNT(*)::integer AS total
      FROM tentativas_login AS tentativa
      WHERE LOWER(tentativa.email_informado) = LOWER($1)
        AND tentativa.sucesso = FALSE
        AND tentativa.motivo = 'credenciais_invalidas'
        AND tentativa.criado_em >= CURRENT_TIMESTAMP - ($2::integer * INTERVAL '1 minute')
        AND tentativa.criado_em > COALESCE(
          (
            SELECT MAX(sucesso.criado_em)
            FROM tentativas_login AS sucesso
            WHERE LOWER(sucesso.email_informado) = LOWER($1)
              AND sucesso.sucesso = TRUE
          ),
          '-infinity'::TIMESTAMPTZ
        )
    `,
    [email, janelaMinutos]
  );

  return resultado.rows[0].total;
}

async function registrarTentativa(dados) {
  await banco.query(
    `
      INSERT INTO tentativas_login (
        usuario_id,
        email_informado,
        endereco_ip,
        agente_usuario,
        sucesso,
        motivo
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      dados.usuarioId,
      dados.email,
      dados.enderecoIp,
      dados.agenteUsuario,
      dados.sucesso,
      dados.motivo
    ]
  );
}

async function registrarFalhaDoUsuario(usuarioId, limiteFalhas, bloqueioMinutos) {
  const resultado = await banco.query(
    `
      UPDATE usuarios
      SET
        tentativas_login_falhas = tentativas_login_falhas + 1,
        bloqueado_ate = CASE
          WHEN tentativas_login_falhas + 1 >= $2
            THEN CURRENT_TIMESTAMP + ($3::integer * INTERVAL '1 minute')
          ELSE NULL
        END
      WHERE id = $1
      RETURNING tentativas_login_falhas, bloqueado_ate
    `,
    [usuarioId, limiteFalhas, bloqueioMinutos]
  );

  return resultado.rows[0] || null;
}

async function liberarBloqueioExpirado(usuarioId) {
  await banco.query(
    `
      UPDATE usuarios
      SET tentativas_login_falhas = 0,
          bloqueado_ate = NULL
      WHERE id = $1
        AND bloqueado_ate IS NOT NULL
        AND bloqueado_ate <= CURRENT_TIMESTAMP
    `,
    [usuarioId]
  );
}

async function registrarLoginBemSucedido(usuarioId) {
  await banco.query(
    `
      UPDATE usuarios
      SET tentativas_login_falhas = 0,
          bloqueado_ate = NULL
      WHERE id = $1
    `,
    [usuarioId]
  );
}

module.exports = {
  buscarCredenciaisPorId,
  atualizarNome,
  buscarPorEmail,
  buscarPorId,
  contarFalhasRecentesPorEmail,
  contarFalhasRecentesPorIp,
  criar,
  excluirUsuario,
  liberarBloqueioExpirado,
  listar,
  redefinirSenha,
  registrarFalhaDoUsuario,
  registrarLoginBemSucedido,
  registrarTentativa
};
