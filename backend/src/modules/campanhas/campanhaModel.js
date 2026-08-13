const banco = require('../../config/banco');
const contatoModel = require('../contatos/contatoModel');

const CAMPOS_CAMPANHA = `
  campanha.id, campanha.nome, campanha.finalidade, campanha.modelo_id,
  campanha.filtros_snapshot, campanha.status, campanha.responsavel_usuario_id,
  campanha.criado_por_usuario_id, campanha.criado_em, campanha.atualizado_em,
  modelo.nome AS modelo_nome, modelo.meta_status AS modelo_meta_status,
  modelo.meta_status_oficial AS modelo_meta_status_oficial,
  modelo.meta_nome AS modelo_meta_nome, modelo.meta_idioma AS modelo_meta_idioma,
  responsavel.nome AS responsavel_nome
`;

function montarConsultaPublico(filtros, somenteAptos) {
  const filtrosSql = contatoModel.construirFiltros(filtros);
  const condicoesExtras = [];

  if (somenteAptos) {
    condicoesExtras.push('contato.bloqueado_para_mensagens = FALSE');
    condicoesExtras.push(`NOT EXISTS (
      SELECT 1
      FROM consentimentos AS consentimento_mensagens
      WHERE consentimento_mensagens.contato_id = contato.id
        AND consentimento_mensagens.tipo = 'mensagens'
        AND consentimento_mensagens.ativo = TRUE
        AND (
          consentimento_mensagens.estado IN ('recusado', 'revogado')
          OR consentimento_mensagens.resposta = FALSE
        )
    )`);
    condicoesExtras.push(`NOT EXISTS (
      SELECT 1 FROM solicitacoes_exclusao AS solicitacao
      WHERE solicitacao.contato_id = contato.id AND solicitacao.status = 'pendente'
    )`);
  }

  let clausula = filtrosSql.clausulaWhere;
  if (condicoesExtras.length > 0) {
    clausula += (clausula ? ' AND ' : 'WHERE ') + condicoesExtras.join(' AND ');
  }

  return { clausula, valores: filtrosSql.valores };
}

function adicionarCondicao(clausula, condicao) {
  return clausula + (clausula ? ' AND ' : 'WHERE ') + condicao;
}

function expressaoTelefoneMascarado() {
  const digitos = "REGEXP_REPLACE(COALESCE(contato.telefone_normalizado, contato.telefone, ''), '[^0-9]', '', 'g')";
  return `CASE
    WHEN LENGTH(${digitos}) >= 4
      THEN REPEAT('*', GREATEST(LENGTH(${digitos}) - 4, 0)) || RIGHT(${digitos}, 4)
    ELSE 'Nao informado'
  END`;
}

async function listar() {
  const resultado = await banco.query(`
    SELECT ${CAMPOS_CAMPANHA},
      COUNT(DISTINCT lote.id)::integer AS quantidade_lotes,
      COUNT(DISTINCT participacao.id)::integer AS reservado,
      COUNT(DISTINCT participacao.id) FILTER (WHERE participacao.status = 'pendente')::integer AS pendente,
      COUNT(DISTINCT participacao.id) FILTER (WHERE participacao.status = 'enviando')::integer AS enviando,
      COUNT(DISTINCT participacao.id) FILTER (WHERE participacao.status = 'enviada')::integer AS enviado,
      COUNT(DISTINCT participacao.id) FILTER (WHERE participacao.status = 'entregue')::integer AS entregue,
      COUNT(DISTINCT participacao.id) FILTER (WHERE participacao.status = 'lida')::integer AS lido,
      COUNT(DISTINCT participacao.id) FILTER (WHERE participacao.status = 'falhou')::integer AS falhou
    FROM campanhas AS campanha
    LEFT JOIN modelos_mensagem AS modelo ON modelo.id = campanha.modelo_id
    INNER JOIN usuarios AS responsavel ON responsavel.id = campanha.responsavel_usuario_id
    LEFT JOIN campanha_lotes AS lote ON lote.campanha_id = campanha.id
    LEFT JOIN campanha_participacoes AS participacao ON participacao.campanha_id = campanha.id
    GROUP BY campanha.id, modelo.id, responsavel.id
    ORDER BY campanha.criado_em DESC, campanha.id DESC
  `);
  return resultado.rows;
}

async function buscarPorId(id, clienteRecebido) {
  const executor = clienteRecebido || banco;
  const resultado = await executor.query(`
    SELECT ${CAMPOS_CAMPANHA},
      (SELECT COUNT(*)::integer FROM campanha_lotes lote WHERE lote.campanha_id = campanha.id) AS quantidade_lotes,
      (SELECT COUNT(*)::integer FROM campanha_participacoes participacao WHERE participacao.campanha_id = campanha.id) AS reservado
    FROM campanhas AS campanha
    LEFT JOIN modelos_mensagem AS modelo ON modelo.id = campanha.modelo_id
    INNER JOIN usuarios AS responsavel ON responsavel.id = campanha.responsavel_usuario_id
    WHERE campanha.id = $1
  `, [id]);
  return resultado.rows[0] || null;
}

async function criar(dados, usuarioId) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');

    const referencias = await cliente.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM modelos_mensagem
          WHERE id = $1 AND ativo IS TRUE
        ) AS template_valido,
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE id = $2 AND ativo IS TRUE
        ) AS usuario_valido
    `, [dados.modeloId, usuarioId]);

    if (!referencias.rows[0].template_valido) {
      const erro = new Error('O template selecionado não existe ou está inativo.');
      erro.codigo = 'TEMPLATE_INVALIDO';
      throw erro;
    }

    if (!referencias.rows[0].usuario_valido) {
      const erro = new Error('O usuário responsável não existe ou está inativo.');
      erro.codigo = 'USUARIO_INVALIDO';
      throw erro;
    }

    const resultado = await cliente.query(`
      INSERT INTO campanhas (
        nome, descricao, finalidade, modelo_id, filtros_snapshot, status, ativo,
        responsavel_usuario_id, criado_por_usuario_id, atualizado_por_usuario_id
      ) VALUES ($1, $2, $2, $3, $4::jsonb, 'rascunho', TRUE, $5, $5, $5)
      RETURNING id
    `, [dados.nome, dados.finalidade, dados.modeloId, JSON.stringify(dados.filtros), usuarioId]);
    const campanha = await buscarPorId(resultado.rows[0].id, cliente);

    if (!campanha) {
      throw new Error('A campanha foi gravada, mas não pôde ser confirmada.');
    }

    await cliente.query('COMMIT');
    return campanha;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function atualizar(id, dados, usuarioId) {
  const resultado = await banco.query(`
    UPDATE campanhas
    SET nome = $2,
        descricao = $3,
        finalidade = $3,
        modelo_id = $4,
        filtros_snapshot = $5::jsonb,
        atualizado_por_usuario_id = $6,
        atualizado_em = CURRENT_TIMESTAMP
    WHERE id = $1
      AND status IN ('rascunho','pronta','pausada')
      AND NOT EXISTS (
        SELECT 1 FROM campanha_participacoes participacao
        WHERE participacao.campanha_id = campanhas.id
      )
    RETURNING id
  `, [id, dados.nome, dados.finalidade, dados.modeloId, JSON.stringify(dados.filtros), usuarioId]);
  return resultado.rows[0] ? buscarPorId(id) : null;
}

async function alterarStatus(id, status, usuarioId) {
  const colunasData = {
    pronta: 'pronta_em', ativa: 'ativada_em', pausada: 'pausada_em',
    concluida: 'concluida_em', cancelada: 'cancelada_em'
  };
  const colunaData = colunasData[status];
  const resultado = await banco.query(`
    UPDATE campanhas
    SET status = $2::varchar,
        ${colunaData} = CURRENT_TIMESTAMP,
        ativo = $2::varchar <> 'cancelada',
        atualizado_por_usuario_id = $3,
        atualizado_em = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id
  `, [id, status, usuarioId]);
  return resultado.rows[0] ? buscarPorId(id) : null;
}

async function contarPublico(filtros, somenteAptos) {
  const consulta = montarConsultaPublico(filtros, somenteAptos);
  const resultado = await banco.query(`
    SELECT COUNT(*)::integer AS total
    FROM contatos AS contato
    LEFT JOIN origens AS origem ON origem.id = contato.origem_id
    ${consulta.clausula}
  `, consulta.valores);
  return resultado.rows[0].total;
}

async function contarDisponiveis(filtros, campanhaId) {
  const consulta = montarConsultaPublico(filtros, true);
  const valores = consulta.valores.slice();
  valores.push(campanhaId);
  const clausula = adicionarCondicao(consulta.clausula, `NOT EXISTS (
    SELECT 1 FROM campanha_participacoes participacao_existente
    WHERE participacao_existente.campanha_id = $${valores.length}
      AND participacao_existente.contato_id = contato.id
  )`);
  const resultado = await banco.query(`
    SELECT COUNT(*)::integer AS total
    FROM contatos AS contato
    LEFT JOIN origens AS origem ON origem.id = contato.origem_id
    ${clausula}
  `, valores);
  return resultado.rows[0].total;
}

async function listarCandidatos(filtros, campanhaId, limite) {
  const consulta = montarConsultaPublico(filtros, true);
  const valores = consulta.valores.slice();
  let clausula = consulta.clausula;
  if (campanhaId) {
    valores.push(campanhaId);
    clausula = adicionarCondicao(clausula, `NOT EXISTS (
      SELECT 1 FROM campanha_participacoes participacao_existente
      WHERE participacao_existente.campanha_id = $${valores.length}
        AND participacao_existente.contato_id = contato.id
    )`);
  }
  valores.push(limite);
  const resultado = await banco.query(`
    SELECT contato.nome,
      ${expressaoTelefoneMascarado()} AS telefone_mascarado,
      contato.bairro,
      contato.problema
    FROM contatos AS contato
    LEFT JOIN origens AS origem ON origem.id = contato.origem_id
    ${clausula}
    ORDER BY contato.id
    LIMIT $${valores.length}
  `, valores);
  return resultado.rows;
}

async function listarLotes(campanhaId) {
  const resultado = await banco.query(`
    SELECT lote.*, usuario.nome AS criador_nome
    FROM campanha_lotes AS lote
    INNER JOIN usuarios AS usuario ON usuario.id = lote.criado_por_usuario_id
    WHERE lote.campanha_id = $1
    ORDER BY lote.ordem, lote.id
  `, [campanhaId]);
  return resultado.rows;
}

async function listarContatosLote(campanhaId, loteId) {
  const resultado = await banco.query(`
    SELECT contato.nome,
      ${expressaoTelefoneMascarado()} AS telefone_mascarado,
      contato.bairro,
      contato.problema,
      participacao.status,
      tentativa_atual.id AS tentativa_id,
      tentativa_atual.status AS tentativa_status
    FROM campanha_participacoes AS participacao
    INNER JOIN campanha_lotes AS lote ON lote.id = participacao.lote_original_id
    INNER JOIN contatos AS contato ON contato.id = participacao.contato_id
    LEFT JOIN LATERAL (
      SELECT tentativa.id, tentativa.status
      FROM campanha_tentativas tentativa
      WHERE tentativa.participacao_id=participacao.id
      ORDER BY tentativa.numero_tentativa DESC LIMIT 1
    ) tentativa_atual ON TRUE
    WHERE participacao.campanha_id = $1
      AND lote.id = $2
      AND lote.campanha_id = $1
    ORDER BY participacao.id
  `, [campanhaId, loteId]);
  return resultado.rows;
}

async function listarFalhas(campanhaId) {
  const resultado = await banco.query(`
    SELECT tentativa.id, tentativa.numero_tentativa, tentativa.codigo_erro_externo,
      tentativa.titulo_erro, tentativa.descricao_erro, tentativa.criado_em,
      contato.nome AS contato_nome, lote.ordem AS lote_ordem
    FROM campanha_tentativas tentativa
    INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id
    INNER JOIN campanha_lotes lote ON lote.id=participacao.lote_original_id
    INNER JOIN contatos contato ON contato.id=participacao.contato_id
    WHERE participacao.campanha_id=$1 AND tentativa.status='falhou'
      AND NOT EXISTS (
        SELECT 1 FROM campanha_tentativas tentativa_nova
        WHERE tentativa_nova.participacao_id=tentativa.participacao_id
          AND tentativa_nova.numero_tentativa>tentativa.numero_tentativa
      )
    ORDER BY tentativa.criado_em DESC, tentativa.id DESC
  `, [campanhaId]);
  return resultado.rows;
}

async function buscarLotePorChave(cliente, campanhaId, chave) {
  const resultado = await cliente.query(`
    SELECT * FROM campanha_lotes
    WHERE campanha_id = $1 AND chave_idempotencia = $2
  `, [campanhaId, chave]);
  return resultado.rows[0] || null;
}

async function criarLoteAtomico(campanhaId, tamanhoSolicitado, chave, usuarioId, agora) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(41027, 0)');
    await cliente.query('SELECT pg_advisory_xact_lock(41027, $1)', [campanhaId]);

    const existente = await buscarLotePorChave(cliente, campanhaId, chave);
    if (existente) {
      await cliente.query('COMMIT');
      return { lote: existente, repetido: true };
    }

    const campanhaResultado = await cliente.query(
      "SELECT * FROM campanhas WHERE id = $1 AND status IN ('pronta','ativa') FOR UPDATE",
      [campanhaId]
    );
    const campanha = campanhaResultado.rows[0];
    if (!campanha) {
      const erro = new Error('Campanha inexistente ou indisponivel para criar lote.');
      erro.codigo = 'CAMPANHA_INDISPONIVEL';
      throw erro;
    }

    const configuracao = await cliente.query(`
      SELECT
        configuracao.valor_inteiro AS limite_interno,
        sincronizacao.limite_novo AS limite_meta
      FROM configuracoes_sistema AS configuracao
      LEFT JOIN LATERAL (
        SELECT limite_novo
        FROM sincronizacoes_limite_meta
        WHERE status = 'sucesso'
        ORDER BY id DESC
        LIMIT 1
      ) AS sincronizacao ON TRUE
      WHERE configuracao.chave = 'limite_mensagens_24h'
      FOR UPDATE OF configuracao
    `);
    const limiteInterno = configuracao.rows[0].limite_interno;
    const limiteMeta = configuracao.rows[0].limite_meta;
    const limite = limiteMeta === null
      ? limiteInterno
      : Math.min(limiteInterno, limiteMeta);
    const usados = await cliente.query(`
      SELECT COUNT(*)::integer AS total
      FROM campanha_participacoes
      WHERE reservado_em >= $1::timestamptz - INTERVAL '24 hours'
        AND reservado_em <= $1::timestamptz
    `, [agora]);
    const capacidade = Math.max(0, limite - usados.rows[0].total);

    if (tamanhoSolicitado > capacidade) {
      const erro = new Error('A solicitacao ultrapassa a capacidade disponivel de 24 horas.');
      erro.codigo = 'CAPACIDADE_INSUFICIENTE';
      erro.capacidade = capacidade;
      erro.limite = limite;
      erro.utilizado = usados.rows[0].total;
      throw erro;
    }

    const publico = montarConsultaPublico(campanha.filtros_snapshot, true);
    const valores = publico.valores.slice();
    valores.push(campanhaId, tamanhoSolicitado);
    const candidatos = await cliente.query(`
      SELECT contato.id
      FROM contatos AS contato
      LEFT JOIN origens AS origem ON origem.id = contato.origem_id
      ${publico.clausula}
        AND NOT EXISTS (
          SELECT 1 FROM campanha_participacoes participacao_existente
          WHERE participacao_existente.campanha_id = $${valores.length - 1}
            AND participacao_existente.contato_id = contato.id
        )
      ORDER BY contato.id
      FOR UPDATE OF contato SKIP LOCKED
      LIMIT $${valores.length}
    `, valores);

    if (candidatos.rows.length === 0) {
      const erro = new Error('Nao existem novos contatos aptos para este lote.');
      erro.codigo = 'SEM_CONTATOS';
      throw erro;
    }

    const ordemResultado = await cliente.query(
      'SELECT COALESCE(MAX(ordem), 0) + 1 AS ordem FROM campanha_lotes WHERE campanha_id = $1',
      [campanhaId]
    );
    const loteResultado = await cliente.query(`
      INSERT INTO campanha_lotes (
        campanha_id, tamanho_solicitado, tamanho_efetivo, ordem,
        chave_idempotencia, criado_por_usuario_id, criado_em, atualizado_em
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING *
    `, [campanhaId, tamanhoSolicitado, candidatos.rows.length, ordemResultado.rows[0].ordem, chave, usuarioId, agora]);
    const lote = loteResultado.rows[0];

    for (const candidato of candidatos.rows) {
      const participacaoResultado = await cliente.query(`
        INSERT INTO campanha_participacoes (
          campanha_id, contato_id, lote_original_id, status, reservado_em, atualizado_em
        ) VALUES ($1, $2, $3, 'pendente', $4, $4)
        RETURNING id
      `, [campanhaId, candidato.id, lote.id, agora]);
      const participacaoId = participacaoResultado.rows[0].id;
      const tentativaResultado = await cliente.query(`
        INSERT INTO campanha_tentativas (participacao_id, numero_tentativa, status, iniciada_em, criado_em)
        VALUES ($1, 1, 'pendente', $2, $2)
        RETURNING id
      `, [participacaoId, agora]);
      await cliente.query(`
        INSERT INTO historico_status_mensageria (
          participacao_id, tentativa_id, status_anterior, status_novo, origem, criado_em
        ) VALUES ($1, $2, NULL, 'pendente', 'reserva', $3)
      `, [participacaoId, tentativaResultado.rows[0].id, agora]);
    }

    await cliente.query("UPDATE campanhas SET status = 'ativa', ativada_em = COALESCE(ativada_em, $2), atualizado_em = $2 WHERE id = $1", [campanhaId, agora]);
    await cliente.query('COMMIT');
    return { lote, repetido: false, capacidadeRestante: capacidade - candidatos.rows.length };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function obterCapacidade(agora) {
  const resultado = await banco.query(`
    SELECT
      configuracao.valor_inteiro AS limite_interno,
      sincronizacao.limite_novo AS limite_meta,
      sincronizacao.tier_novo AS tier_meta,
      sincronizacao.criado_em AS sincronizado_em,
      sincronizacao.origem AS origem_sincronizacao,
      COUNT(participacao.id) FILTER (
        WHERE participacao.reservado_em >= $1::timestamptz - INTERVAL '24 hours'
          AND participacao.reservado_em <= $1::timestamptz
      )::integer AS utilizado
    FROM configuracoes_sistema configuracao
    LEFT JOIN LATERAL (
      SELECT limite_novo, tier_novo, criado_em, origem
      FROM sincronizacoes_limite_meta
      WHERE status = 'sucesso'
      ORDER BY id DESC
      LIMIT 1
    ) AS sincronizacao ON TRUE
    LEFT JOIN campanha_participacoes participacao ON TRUE
    WHERE configuracao.chave = 'limite_mensagens_24h'
    GROUP BY configuracao.valor_inteiro, sincronizacao.limite_novo,
      sincronizacao.tier_novo, sincronizacao.criado_em, sincronizacao.origem
  `, [agora]);
  const linha = resultado.rows[0];
  const limite = linha.limite_meta === null
    ? linha.limite_interno
    : Math.min(linha.limite_interno, linha.limite_meta);
  return {
    limite,
    limiteInterno: linha.limite_interno,
    limiteMeta: linha.limite_meta,
    tierMeta: linha.tier_meta,
    utilizado: linha.utilizado,
    disponivel: Math.max(0, limite - linha.utilizado),
    sincronizadoEm: linha.sincronizado_em,
    origemSincronizacao: linha.origem_sincronizacao
  };
}

async function atualizarLimite(novoValor, motivo, usuarioId) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(41027, 0)');
    const atual = await cliente.query("SELECT valor_inteiro FROM configuracoes_sistema WHERE chave = 'limite_mensagens_24h' FOR UPDATE");
    await cliente.query(`
      UPDATE configuracoes_sistema
      SET valor_inteiro = $1, atualizado_por_usuario_id = $2, atualizado_em = CURRENT_TIMESTAMP
      WHERE chave = 'limite_mensagens_24h'
    `, [novoValor, usuarioId]);
    await cliente.query(`
      INSERT INTO historico_configuracoes_sistema (chave, valor_anterior, valor_novo, motivo, usuario_id)
      VALUES ('limite_mensagens_24h', $1, $2, $3, $4)
    `, [atual.rows[0].valor_inteiro, novoValor, motivo, usuarioId]);
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function registrarSincronizacaoLimiteMeta(dados) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(41027, 0)');
    const anterior = await cliente.query(`
      SELECT limite_novo, tier_novo, origem
      FROM sincronizacoes_limite_meta
      WHERE status = 'sucesso'
      ORDER BY id DESC
      LIMIT 1
    `);
    const registroAnterior = anterior.rows[0] || {};
    const limiteAnterior = registroAnterior.limite_novo === undefined
      ? null
      : registroAnterior.limite_novo;
    const tierAnterior = registroAnterior.tier_novo || null;

    if (
      dados.origem === 'webhook_meta' &&
      registroAnterior.origem === 'webhook_meta' &&
      limiteAnterior === dados.limite &&
      tierAnterior === dados.tier
    ) {
      await cliente.query('COMMIT');
      return { alterado: false };
    }

    await cliente.query(`
      INSERT INTO sincronizacoes_limite_meta (
        limite_anterior, limite_novo, tier_anterior, tier_novo,
        origem, status, usuario_id
      ) VALUES ($1, $2, $3, $4, $5, 'sucesso', $6)
    `, [
      limiteAnterior,
      dados.limite,
      tierAnterior,
      dados.tier,
      dados.origem,
      dados.usuarioId || null
    ]);
    await cliente.query('COMMIT');
    return { alterado: true };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function registrarFalhaSincronizacaoLimiteMeta(dados) {
  await banco.query(`
    INSERT INTO sincronizacoes_limite_meta (
      origem, status, codigo_erro, usuario_id
    ) VALUES ($1, 'falha', $2, $3)
  `, [dados.origem, dados.codigoErro, dados.usuarioId || null]);
}

async function listarTemplates() {
  const resultado = await banco.query(`
    SELECT id, nome, categoria, texto, ativo, meta_nome, meta_idioma,
      meta_categoria, meta_status, meta_template_id, meta_componentes,
      meta_status_oficial, meta_origem, meta_submetido_em,
      meta_sincronizado_em, meta_configuracao_envio, criado_em, atualizado_em
    FROM modelos_mensagem
    WHERE meta_status_oficial IS DISTINCT FROM 'NOT_FOUND'
    ORDER BY ativo DESC, nome
  `);
  return resultado.rows;
}

async function salvarTemplate(id, dados, usuarioId) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    let template;
    if (id) {
      await cliente.query('SELECT pg_advisory_xact_lock(41030, $1)', [id]);
      const atual = await cliente.query('SELECT meta_template_id FROM modelos_mensagem WHERE id=$1 FOR UPDATE', [id]);
      if (!atual.rows[0]) { await cliente.query('ROLLBACK'); return null; }
      if (atual.rows[0].meta_template_id) { const erro = new Error('Template oficial nao pode ser editado como rascunho.'); erro.codigo='TEMPLATE_JA_SUBMETIDO'; throw erro; }
      template = (await cliente.query(`
        UPDATE modelos_mensagem SET nome=$1, categoria=$2, texto=$3, ativo=$4,
          meta_nome=$5, meta_idioma=$6, meta_categoria=$7, meta_status='rascunho',
          meta_componentes=$8::jsonb, meta_configuracao_envio=$9::jsonb,
          atualizado_por_usuario_id=$10, atualizado_em=CURRENT_TIMESTAMP
        WHERE id=$11 RETURNING *
      `, [dados.nome,dados.categoria,dados.conteudo,dados.ativo,dados.metaNome,
        dados.metaIdioma,dados.metaCategoria,JSON.stringify(dados.componentes),
        JSON.stringify(dados.configuracaoEnvio),usuarioId,id])).rows[0];
      await cliente.query(`INSERT INTO historico_modelos_mensagem_meta
        (modelo_id,acao,origem,usuario_id) VALUES ($1,'rascunho_atualizado','sistema',$2)`, [id,usuarioId]);
    } else {
      template = (await cliente.query(`
        INSERT INTO modelos_mensagem (nome,categoria,texto,ativo,meta_nome,meta_idioma,
          meta_categoria,meta_status,meta_componentes,meta_configuracao_envio,
          criado_por_usuario_id,atualizado_por_usuario_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'rascunho',$8::jsonb,$9::jsonb,$10,$10)
        RETURNING *
      `, [dados.nome,dados.categoria,dados.conteudo,dados.ativo,dados.metaNome,
        dados.metaIdioma,dados.metaCategoria,JSON.stringify(dados.componentes),
        JSON.stringify(dados.configuracaoEnvio),usuarioId])).rows[0];
      await cliente.query(`INSERT INTO historico_modelos_mensagem_meta
        (modelo_id,acao,origem,usuario_id) VALUES ($1,'rascunho_criado','sistema',$2)`, [template.id,usuarioId]);
    }
    await cliente.query('COMMIT');
    return template;
  } catch (erro) { await cliente.query('ROLLBACK'); throw erro; }
  finally { cliente.release(); }
}

async function buscarTemplatePorId(id) {
  return (await banco.query('SELECT * FROM modelos_mensagem WHERE id=$1', [id])).rows[0] || null;
}

async function configurarEnvioTemplate(id, configuracaoEnvio, usuarioId) {
  const resultado = await banco.query(`UPDATE modelos_mensagem SET meta_configuracao_envio=$1::jsonb,
    atualizado_por_usuario_id=$2,atualizado_em=CURRENT_TIMESTAMP
    WHERE id=$3 AND meta_template_id IS NOT NULL RETURNING *`, [JSON.stringify(configuracaoEnvio),usuarioId,id]);
  if (!resultado.rows[0]) return null;
  await banco.query(`INSERT INTO historico_modelos_mensagem_meta
    (modelo_id,meta_template_id,acao,origem,usuario_id)
    VALUES ($1,$2,'configuracao_envio','sistema',$3)`, [id,resultado.rows[0].meta_template_id,usuarioId]);
  return resultado.rows[0];
}

function statusInternoOficial(status) {
  if (status === 'APPROVED') return 'aprovado';
  if (status === 'PENDING') return 'em_analise';
  if (status === 'REJECTED') return 'rejeitado';
  return 'indisponivel';
}

function jsonCanonico(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(jsonCanonico).join(',') + ']';
  if (valor && typeof valor === 'object') return '{' + Object.keys(valor).sort().map(function(chave){return JSON.stringify(chave)+':'+jsonCanonico(valor[chave]);}).join(',') + '}';
  return JSON.stringify(valor);
}

async function submeterTemplateAtomico(id, usuarioId, enviarParaMeta) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(41030, $1)', [id]);
    const atual = (await cliente.query('SELECT * FROM modelos_mensagem WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!atual) { const erro = new Error('Template nao encontrado.'); erro.codigo='TEMPLATE_NAO_ENCONTRADO'; throw erro; }
    if (atual.meta_template_id) { await cliente.query('COMMIT'); return { template: atual, repetido: true }; }
    const oficial = await enviarParaMeta(atual);
    const status = String(oficial.status || '').toUpperCase();
    const template = (await cliente.query(`UPDATE modelos_mensagem SET
      meta_template_id=$1, meta_status_oficial=$2, meta_status=$3,
      meta_categoria=COALESCE($4,meta_categoria), meta_submetido_em=CURRENT_TIMESTAMP,
      meta_sincronizado_em=CURRENT_TIMESTAMP, atualizado_por_usuario_id=$5,
      atualizado_em=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *`,
    [String(oficial.id),status,statusInternoOficial(status),oficial.category || null,usuarioId,id])).rows[0];
    await cliente.query(`INSERT INTO historico_modelos_mensagem_meta
      (modelo_id,meta_template_id,acao,status_anterior,status_novo,origem,usuario_id)
      VALUES ($1,$2,'submissao',$3,$4,'api_meta',$5)`, [id,String(oficial.id),atual.meta_status_oficial,status,usuarioId]);
    await cliente.query('COMMIT');
    return { template, repetido: false };
  } catch (erro) { await cliente.query('ROLLBACK'); throw erro; }
  finally { cliente.release(); }
}

async function sincronizarTemplatesOficiais(templates, usuarioId) {
  const cliente = await banco.connect();
  const resumo = { criados: 0, atualizados: 0, vinculados: 0, inalterados: 0, indisponibilizados: 0 };
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(41031, 0)');
    for (const oficial of templates) {
      let atual = (await cliente.query('SELECT * FROM modelos_mensagem WHERE meta_template_id=$1 FOR UPDATE', [oficial.id])).rows[0];
      let acao = 'sincronizacao';
      if (!atual) {
        const candidatos = await cliente.query(`SELECT * FROM modelos_mensagem
          WHERE meta_template_id IS NULL AND meta_nome=$1 AND meta_idioma=$2 FOR UPDATE`, [oficial.name,oficial.language]);
        if (candidatos.rowCount === 1) { atual = candidatos.rows[0]; acao='vinculo_inicial'; resumo.vinculados += 1; }
      }
      const status = String(oficial.status).toUpperCase();
      const componentes = JSON.stringify(oficial.components);
      if (atual) {
        const mudou = atual.meta_template_id !== String(oficial.id) || atual.meta_status_oficial !== status ||
          atual.meta_categoria !== oficial.category || jsonCanonico(atual.meta_componentes || []) !== jsonCanonico(oficial.components);
        if (!mudou) { resumo.inalterados += 1; continue; }
        await cliente.query(`UPDATE modelos_mensagem SET meta_template_id=$1,meta_nome=$2,
          meta_idioma=$3,meta_categoria=$4,meta_status_oficial=$5,meta_status=$6,
          meta_componentes=$7::jsonb,meta_origem=CASE WHEN $8='vinculo_inicial' THEN meta_origem ELSE 'meta' END,
          meta_sincronizado_em=CURRENT_TIMESTAMP,atualizado_em=CURRENT_TIMESTAMP WHERE id=$9`,
        [String(oficial.id),oficial.name,oficial.language,oficial.category,status,
          statusInternoOficial(status),componentes,acao,atual.id]);
        await cliente.query(`INSERT INTO historico_modelos_mensagem_meta
          (modelo_id,meta_template_id,acao,status_anterior,status_novo,origem,usuario_id)
          VALUES ($1,$2,$3,$4,$5,'sincronizacao_meta',$6)`,
        [atual.id,String(oficial.id),acao,atual.meta_status_oficial,status,usuarioId]);
        resumo.atualizados += 1;
      } else {
        const corpo = oficial.components.find(function(item){return item.type === 'BODY';});
        const nomeInterno = oficial.name.replace(/_/g,' ').replace(/\b\w/g,function(letra){return letra.toUpperCase();}).slice(0,150);
        const criado = (await cliente.query(`INSERT INTO modelos_mensagem
          (nome,categoria,texto,ativo,meta_nome,meta_idioma,meta_categoria,meta_status,
          meta_template_id,meta_componentes,meta_status_oficial,meta_origem,meta_sincronizado_em,
          criado_por_usuario_id,atualizado_por_usuario_id)
          VALUES ($1,$2,$3,TRUE,$4,$5,$6,$7,$8,$9::jsonb,$10,'meta',CURRENT_TIMESTAMP,$11,$11) RETURNING id`,
        [nomeInterno,oficial.category,(corpo && corpo.text) || 'Template oficial da Meta',oficial.name,
          oficial.language,oficial.category,statusInternoOficial(status),String(oficial.id),componentes,status,usuarioId])).rows[0];
        await cliente.query(`INSERT INTO historico_modelos_mensagem_meta
          (modelo_id,meta_template_id,acao,status_novo,origem,usuario_id)
          VALUES ($1,$2,'sincronizacao',$3,'sincronizacao_meta',$4)`, [criado.id,String(oficial.id),status,usuarioId]);
        resumo.criados += 1;
      }
    }

    const idsOficiais = templates.map(function (template) { return String(template.id); });
    const ausentes = await cliente.query(`SELECT id,meta_template_id,meta_status_oficial
      FROM modelos_mensagem
      WHERE meta_template_id IS NOT NULL
        AND NOT (meta_template_id = ANY($1::varchar[]))
        AND (meta_status <> 'indisponivel' OR meta_status_oficial IS DISTINCT FROM 'NOT_FOUND')
      FOR UPDATE`, [idsOficiais]);

    for (const ausente of ausentes.rows) {
      await cliente.query(`UPDATE modelos_mensagem SET meta_status='indisponivel',
        meta_status_oficial='NOT_FOUND',meta_sincronizado_em=CURRENT_TIMESTAMP,
        atualizado_em=CURRENT_TIMESTAMP WHERE id=$1`, [ausente.id]);
      await cliente.query(`INSERT INTO historico_modelos_mensagem_meta
        (modelo_id,meta_template_id,acao,status_anterior,status_novo,origem,usuario_id)
        VALUES ($1,$2,'sincronizacao',$3,'NOT_FOUND','sincronizacao_meta',$4)`,
      [ausente.id,ausente.meta_template_id,ausente.meta_status_oficial,usuarioId]);
      resumo.indisponibilizados += 1;
    }

    await cliente.query('COMMIT');
    return resumo;
  } catch (erro) { await cliente.query('ROLLBACK'); throw erro; }
  finally { cliente.release(); }
}

async function sincronizarTemplateOficialDoWebhook(oficial) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(41031, 0)');
    let atual = (await cliente.query(
      'SELECT * FROM modelos_mensagem WHERE meta_template_id=$1 FOR UPDATE',
      [oficial.id]
    )).rows[0];
    let acao = 'webhook_status';
    if (!atual) {
      const candidatos = await cliente.query(`SELECT * FROM modelos_mensagem
        WHERE meta_template_id IS NULL AND meta_nome=$1 AND meta_idioma=$2 FOR UPDATE`,
      [oficial.name, oficial.language]);
      if (candidatos.rowCount === 1) {
        atual = candidatos.rows[0];
        acao = 'vinculo_inicial';
      }
    }

    const status = String(oficial.status).toUpperCase();
    const componentes = JSON.stringify(oficial.components);
    if (atual) {
      const mudou = atual.meta_template_id !== String(oficial.id) ||
        atual.meta_status_oficial !== status || atual.meta_categoria !== oficial.category ||
        atual.meta_nome !== oficial.name || atual.meta_idioma !== oficial.language ||
        jsonCanonico(atual.meta_componentes || []) !== jsonCanonico(oficial.components);
      if (!mudou) {
        await cliente.query('COMMIT');
        return { processado: false, motivo: 'status_template_repetido', templateId: atual.id };
      }
      await cliente.query(`UPDATE modelos_mensagem SET meta_template_id=$1,meta_nome=$2,
        meta_idioma=$3,meta_categoria=$4,meta_status_oficial=$5,meta_status=$6,
        meta_componentes=$7::jsonb,meta_origem='meta',meta_sincronizado_em=CURRENT_TIMESTAMP,
        atualizado_em=CURRENT_TIMESTAMP WHERE id=$8`,
      [String(oficial.id),oficial.name,oficial.language,oficial.category,status,
        statusInternoOficial(status),componentes,atual.id]);
      await cliente.query(`INSERT INTO historico_modelos_mensagem_meta
        (modelo_id,meta_template_id,acao,status_anterior,status_novo,origem,usuario_id)
        VALUES ($1,$2,$3,$4,$5,'webhook_meta',NULL)`,
      [atual.id,String(oficial.id),acao,atual.meta_status_oficial,status]);
      await cliente.query('COMMIT');
      return { processado: true, motivo: 'status_template_atualizado', templateId: atual.id };
    }

    const corpo = oficial.components.find(function (item) { return item.type === 'BODY'; });
    const nomeInterno = oficial.name.replace(/_/g, ' ').replace(/\b\w/g, function (letra) {
      return letra.toUpperCase();
    }).slice(0, 150);
    const criado = (await cliente.query(`INSERT INTO modelos_mensagem
      (nome,categoria,texto,ativo,meta_nome,meta_idioma,meta_categoria,meta_status,
       meta_template_id,meta_componentes,meta_status_oficial,meta_origem,meta_sincronizado_em,
       criado_por_usuario_id,atualizado_por_usuario_id)
      VALUES ($1,$2,$3,TRUE,$4,$5,$6,$7,$8,$9::jsonb,$10,'meta',CURRENT_TIMESTAMP,NULL,NULL)
      RETURNING id`,
    [nomeInterno,oficial.category,(corpo && corpo.text) || 'Template oficial da Meta',
      oficial.name,oficial.language,oficial.category,statusInternoOficial(status),
      String(oficial.id),componentes,status])).rows[0];
    await cliente.query(`INSERT INTO historico_modelos_mensagem_meta
      (modelo_id,meta_template_id,acao,status_novo,origem,usuario_id)
      VALUES ($1,$2,'webhook_status',$3,'webhook_meta',NULL)`,
    [criado.id,String(oficial.id),status]);
    await cliente.query('COMMIT');
    return { processado: true, motivo: 'template_importado_por_webhook', templateId: criado.id };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally { cliente.release(); }
}

async function atualizarStatusTemplateExistenteDoWebhook(metaTemplateId, statusRecebido) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(41031, 0)');
    const atual = (await cliente.query(
      'SELECT * FROM modelos_mensagem WHERE meta_template_id=$1 FOR UPDATE',
      [metaTemplateId]
    )).rows[0];
    if (!atual) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: 'template_desconhecido', templateId: null };
    }

    const status = String(statusRecebido).toUpperCase();
    if (atual.meta_status_oficial === status) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: 'status_template_repetido', templateId: atual.id };
    }

    await cliente.query(`UPDATE modelos_mensagem SET meta_status_oficial=$1,meta_status=$2,
      meta_sincronizado_em=CURRENT_TIMESTAMP,atualizado_em=CURRENT_TIMESTAMP WHERE id=$3`,
    [status,statusInternoOficial(status),atual.id]);
    await cliente.query(`INSERT INTO historico_modelos_mensagem_meta
      (modelo_id,meta_template_id,acao,status_anterior,status_novo,origem,usuario_id)
      VALUES ($1,$2,'webhook_status',$3,$4,'webhook_meta',NULL)`,
    [atual.id,String(metaTemplateId),atual.meta_status_oficial,status]);
    await cliente.query('COMMIT');
    return { processado: true, motivo: 'status_template_atualizado', templateId: atual.id };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally { cliente.release(); }
}

module.exports = {
  alterarStatus,
  atualizar,
  atualizarLimite,
  atualizarStatusTemplateExistenteDoWebhook,
  buscarTemplatePorId,
  buscarPorId,
  contarDisponiveis,
  contarPublico,
  configurarEnvioTemplate,
  criar,
  criarLoteAtomico,
  listar,
  listarCandidatos,
  listarContatosLote,
  listarFalhas,
  listarLotes,
  listarTemplates,
  obterCapacidade,
  registrarFalhaSincronizacaoLimiteMeta,
  registrarSincronizacaoLimiteMeta,
  salvarTemplate,
  submeterTemplateAtomico,
  sincronizarTemplateOficialDoWebhook,
  sincronizarTemplatesOficiais
};
