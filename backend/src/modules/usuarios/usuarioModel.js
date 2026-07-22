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
          bloqueado_ate = NULL
      WHERE id = $1
      RETURNING ${CAMPOS_PUBLICOS}
    `,
    [usuarioId, senhaHash]
  );

  return resultado.rows[0] || null;
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
  buscarPorEmail,
  buscarPorId,
  contarFalhasRecentesPorEmail,
  contarFalhasRecentesPorIp,
  criar,
  liberarBloqueioExpirado,
  listar,
  redefinirSenha,
  registrarFalhaDoUsuario,
  registrarLoginBemSucedido,
  registrarTentativa
};
