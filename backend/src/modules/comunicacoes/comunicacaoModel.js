const banco = require('../../config/banco');

async function listarNumeros() {
  return (await banco.query('SELECT * FROM numeros_whatsapp ORDER BY ativo DESC, nome')).rows;
}

async function salvarNumero(id, dados, usuarioId) {
  if (id) {
    return (await banco.query(`
      UPDATE numeros_whatsapp SET nome=$2, numero=$3, numero_normalizado=$4,
        responsavel=$5, observacao=$6, ativo=$7, atualizado_por_usuario_id=$8
      WHERE id=$1 RETURNING *
    `, [id, dados.nome, dados.numero, dados.numeroNormalizado, dados.responsavel,
      dados.observacao, dados.ativo, usuarioId])).rows[0] || null;
  }

  return (await banco.query(`
    INSERT INTO numeros_whatsapp
      (nome,numero,numero_normalizado,responsavel,observacao,ativo,
       criado_por_usuario_id,atualizado_por_usuario_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *
  `, [dados.nome, dados.numero, dados.numeroNormalizado, dados.responsavel,
    dados.observacao, dados.ativo, usuarioId])).rows[0];
}

async function contarComunicacoesDoNumero(id) {
  return Number((await banco.query(
    'SELECT COUNT(*) AS total FROM comunicacoes WHERE numero_whatsapp_id=$1',
    [id]
  )).rows[0].total);
}

async function excluirNumero(id) {
  return (await banco.query(
    'DELETE FROM numeros_whatsapp WHERE id=$1 RETURNING id',
    [id]
  )).rows[0] || null;
}

async function cancelarPreparada(id, usuarioId, administrador) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(
      'SELECT id,status,operador_usuario_id FROM comunicacoes WHERE id=$1 FOR UPDATE',
      [id]
    );
    const comunicacao = resultado.rows[0];
    if (!comunicacao) {
      await cliente.query('ROLLBACK');
      return 'nao_encontrada';
    }
    if (comunicacao.status !== 'preparada') {
      await cliente.query('ROLLBACK');
      return 'ja_enviada';
    }
    if (!administrador && Number(comunicacao.operador_usuario_id) !== Number(usuarioId)) {
      await cliente.query('ROLLBACK');
      return 'sem_permissao';
    }
    await cliente.query('DELETE FROM comunicacoes WHERE id=$1', [id]);
    await cliente.query('COMMIT');
    return 'cancelada';
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function cancelarPreparadas(usuarioId, administrador) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const parametros = administrador ? ['preparada'] : ['preparada', usuarioId];
    const filtroUsuario = administrador ? '' : ' AND operador_usuario_id=$2';
    const resultado = await cliente.query(
      'SELECT id FROM comunicacoes WHERE status=$1' + filtroUsuario + ' FOR UPDATE',
      parametros
    );
    const ids = resultado.rows.map(function (linha) {
      return linha.id;
    });

    if (ids.length > 0) {
      await cliente.query('DELETE FROM comunicacoes WHERE id = ANY($1::integer[])', [ids]);
    }

    await cliente.query('COMMIT');
    return ids.length;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function listarModelos() {
  return (await banco.query(`
    SELECT modelo.*, evento.nome AS evento_nome
    FROM modelos_mensagem AS modelo
    LEFT JOIN eventos AS evento ON evento.id=modelo.evento_id
    ORDER BY modelo.ativo DESC, modelo.nome
  `)).rows;
}

async function salvarModelo(id, dados, usuarioId) {
  if (id) {
    return (await banco.query(`
      UPDATE modelos_mensagem SET nome=$2,categoria=$3,texto=$4,evento_id=$5,
        ativo=$6,atualizado_por_usuario_id=$7 WHERE id=$1 RETURNING *
    `, [id, dados.nome, dados.categoria, dados.texto, dados.eventoId,
      dados.ativo, usuarioId])).rows[0] || null;
  }

  return (await banco.query(`
    INSERT INTO modelos_mensagem
      (nome,categoria,texto,evento_id,ativo,criado_por_usuario_id,atualizado_por_usuario_id)
    VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *
  `, [dados.nome, dados.categoria, dados.texto, dados.eventoId,
    dados.ativo, usuarioId])).rows[0];
}

async function listarCampanhas() {
  return (await banco.query('SELECT * FROM campanhas ORDER BY ativo DESC, criado_em DESC')).rows;
}

async function salvarCampanha(id, dados, usuarioId) {
  if (id) {
    return (await banco.query(`
      UPDATE campanhas SET nome=$2,descricao=$3,ativo=$4,atualizado_por_usuario_id=$5
      WHERE id=$1 RETURNING *
    `, [id, dados.nome, dados.descricao, dados.ativo, usuarioId])).rows[0] || null;
  }

  return (await banco.query(`
    INSERT INTO campanhas (nome,descricao,ativo,criado_por_usuario_id,atualizado_por_usuario_id)
    VALUES ($1,$2,$3,$4,$4) RETURNING *
  `, [dados.nome, dados.descricao, dados.ativo, usuarioId])).rows[0];
}

async function listarOperadores() {
  return (await banco.query(`
    SELECT id,nome,perfil FROM usuarios
    WHERE ativo=TRUE ORDER BY nome
  `)).rows;
}

async function buscarContexto(contatoIds, eventoId, modeloId, numeroId, campanhaId) {
  const resultados = await Promise.all([
    banco.query(`
      SELECT id,nome,telefone,telefone_normalizado,bairro,problema,
        bloqueado_para_mensagens
      FROM contatos WHERE id=ANY($1::bigint[])
    `, [contatoIds]),
    eventoId ? banco.query('SELECT * FROM eventos WHERE id=$1', [eventoId]) : Promise.resolve({ rows: [null] }),
    modeloId ? banco.query('SELECT * FROM modelos_mensagem WHERE id=$1 AND ativo=TRUE', [modeloId]) : Promise.resolve({ rows: [null] }),
    banco.query('SELECT * FROM numeros_whatsapp WHERE id=$1 AND ativo=TRUE', [numeroId]),
    campanhaId ? banco.query('SELECT * FROM campanhas WHERE id=$1 AND ativo=TRUE', [campanhaId]) : Promise.resolve({ rows: [null] })
  ]);

  return {
    contatos: resultados[0].rows,
    evento: resultados[1].rows[0] || null,
    modelo: resultados[2].rows[0] || null,
    numero: resultados[3].rows[0] || null,
    campanha: resultados[4].rows[0] || null
  };
}

async function buscarRecebimentosDaCampanha(contatoIds, campanhaId) {
  if (!campanhaId) {
    return [];
  }

  return (await banco.query(`
    SELECT DISTINCT ON (contato_id) contato_id,id,enviada_em
    FROM comunicacoes
    WHERE contato_id=ANY($1::bigint[]) AND campanha_id=$2 AND enviada_em IS NOT NULL
    ORDER BY contato_id,enviada_em DESC
  `, [contatoIds, campanhaId])).rows;
}

async function preparar(dados, usuarioId) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const registros = [];

    for (const item of dados.contatos) {
      const resultado = await cliente.query(`
        INSERT INTO comunicacoes
          (contato_id,evento_id,modelo_id,campanha_id,numero_whatsapp_id,
           operador_usuario_id,texto_preparado,status,observacoes,motivo_reenvio)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'preparada',$8,$9) RETURNING *
      `, [item.contatoId, dados.eventoId, dados.modeloId, dados.campanhaId,
        dados.numeroId, usuarioId, item.texto, dados.observacoes, item.motivoReenvio]);

      await cliente.query(`
        INSERT INTO historico_comunicacoes
          (comunicacao_id,status_anterior,status_novo,usuario_id,observacoes)
        VALUES ($1,NULL,'preparada',$2,$3)
      `, [resultado.rows[0].id, usuarioId,
        item.motivoReenvio || dados.observacoes]);

      registros.push(resultado.rows[0]);
    }

    await cliente.query('COMMIT');
    return registros;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function buscarPorIdParaAtualizar(cliente, id) {
  return (await cliente.query(
    'SELECT * FROM comunicacoes WHERE id=$1 FOR UPDATE',
    [id]
  )).rows[0] || null;
}

async function confirmarEnvio(id, observacoes, usuarioId, administrador) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const atual = await buscarPorIdParaAtualizar(cliente, id);

    if (!atual) {
      await cliente.query('ROLLBACK');
      return null;
    }
    if (atual.enviada_em) {
      await cliente.query('ROLLBACK');
      return Object.assign({}, atual, { jaConfirmada: true });
    }
    if (!administrador && Number(atual.operador_usuario_id) !== Number(usuarioId)) {
      await cliente.query('ROLLBACK');
      return Object.assign({}, atual, { semPermissao: true });
    }

    const atualizado = (await cliente.query(`
      UPDATE comunicacoes SET status='enviada',
        enviada_em=COALESCE(enviada_em,CURRENT_TIMESTAMP),
        confirmado_por_usuario_id=$2,
        observacoes=COALESCE($3,observacoes)
      WHERE id=$1 RETURNING *
    `, [id, usuarioId, observacoes])).rows[0];

    await cliente.query(`
      INSERT INTO historico_comunicacoes
        (comunicacao_id,status_anterior,status_novo,usuario_id,observacoes)
      VALUES ($1,$2,'enviada',$3,$4)
    `, [id, atual.status, usuarioId, observacoes]);

    await cliente.query('COMMIT');
    return atualizado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function desfazerConfirmacao(id, usuarioId, administrador) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const atual = await buscarPorIdParaAtualizar(cliente, id);

    if (!atual) {
      await cliente.query('ROLLBACK');
      return null;
    }
    if (atual.status !== 'enviada' || !atual.enviada_em) {
      await cliente.query('ROLLBACK');
      return Object.assign({}, atual, { statusInvalido: true });
    }
    if (!administrador && Number(atual.operador_usuario_id) !== Number(usuarioId)) {
      await cliente.query('ROLLBACK');
      return Object.assign({}, atual, { semPermissao: true });
    }

    const atualizado = (await cliente.query(`
      UPDATE comunicacoes SET status='preparada',
        enviada_em=NULL,
        confirmado_por_usuario_id=NULL,
        respondida_em=NULL
      WHERE id=$1 RETURNING *
    `, [id])).rows[0];

    await cliente.query(`
      INSERT INTO historico_comunicacoes
        (comunicacao_id,status_anterior,status_novo,usuario_id,observacoes)
      VALUES ($1,$2,'preparada',$3,$4)
    `, [id, atual.status, usuarioId, 'Confirmacao de envio desfeita.']);

    await cliente.query('COMMIT');
    return atualizado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function desfazerConfirmacoes(idsRecebidos, usuarioId, administrador) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const parametros = administrador ? [idsRecebidos] : [idsRecebidos, usuarioId];
    const filtroUsuario = administrador ? '' : ' AND operador_usuario_id=$2';
    const resultado = await cliente.query(
      "SELECT id,status FROM comunicacoes WHERE id=ANY($1::integer[]) AND status='enviada' AND enviada_em IS NOT NULL" + filtroUsuario + ' FOR UPDATE',
      parametros
    );
    const ids = resultado.rows.map(function (linha) {
      return linha.id;
    });

    if (ids.length > 0) {
      await cliente.query(`
        UPDATE comunicacoes SET status='preparada',
          enviada_em=NULL,
          confirmado_por_usuario_id=NULL,
          respondida_em=NULL
        WHERE id=ANY($1::integer[])
      `, [ids]);

      await cliente.query(`
        INSERT INTO historico_comunicacoes
          (comunicacao_id,status_anterior,status_novo,usuario_id,observacoes)
        SELECT id,'enviada','preparada',$2,'Confirmacao de envio desfeita em lote.'
        FROM comunicacoes WHERE id=ANY($1::integer[])
      `, [ids, usuarioId]);
    }

    await cliente.query('COMMIT');
    return ids.length;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function confirmarPreparadas(usuarioId, administrador) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const parametros = administrador ? ['preparada'] : ['preparada', usuarioId];
    const filtroUsuario = administrador ? '' : ' AND operador_usuario_id=$2';
    const resultado = await cliente.query(
      'SELECT id FROM comunicacoes WHERE status=$1 AND enviada_em IS NULL' + filtroUsuario + ' FOR UPDATE',
      parametros
    );
    const ids = resultado.rows.map(function (linha) {
      return linha.id;
    });

    if (ids.length > 0) {
      await cliente.query(
        `UPDATE comunicacoes SET status='enviada',
          enviada_em=COALESCE(enviada_em,CURRENT_TIMESTAMP),
          confirmado_por_usuario_id=$2
        WHERE id = ANY($1::integer[])`,
        [ids, usuarioId]
      );

      await cliente.query(
        `INSERT INTO historico_comunicacoes
          (comunicacao_id,status_anterior,status_novo,usuario_id,observacoes)
        SELECT id,'preparada','enviada',$2,NULL
        FROM comunicacoes WHERE id = ANY($1::integer[])`,
        [ids, usuarioId]
      );
    }

    await cliente.query('COMMIT');
    return ids.length;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function atualizar(id, dados, usuarioId) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const atual = await buscarPorIdParaAtualizar(cliente, id);

    if (!atual) {
      await cliente.query('ROLLBACK');
      return null;
    }

    const atualizado = (await cliente.query(`
      UPDATE comunicacoes SET status=$2::varchar,
        respondida_em=CASE WHEN $2::varchar IN ('respondido','em_atendimento','concluido')
          THEN COALESCE(respondida_em,CURRENT_TIMESTAMP) ELSE respondida_em END,
        observacoes=COALESCE($3,observacoes),
        proxima_acao=COALESCE($4,proxima_acao)
      WHERE id=$1 RETURNING *
    `, [id, dados.status, dados.observacoes, dados.proximaAcao])).rows[0];

    await cliente.query(`
      INSERT INTO historico_comunicacoes
        (comunicacao_id,status_anterior,status_novo,usuario_id,observacoes)
      VALUES ($1,$2,$3,$4,$5)
    `, [id, atual.status, dados.status, usuarioId, dados.observacoes]);

    await cliente.query('COMMIT');
    return atualizado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

function adicionarFiltroIgual(condicoes, valores, coluna, valor) {
  if (valor !== null && valor !== undefined && valor !== '') {
    valores.push(valor);
    condicoes.push(coluna + '=$' + valores.length);
  }
}

async function listar(filtros) {
  const valores = [];
  const condicoes = [];
  adicionarFiltroIgual(condicoes, valores, 'comunicacao.evento_id', filtros.eventoId);
  adicionarFiltroIgual(condicoes, valores, 'comunicacao.contato_id', filtros.contatoId);
  adicionarFiltroIgual(condicoes, valores, 'comunicacao.status', filtros.status);
  adicionarFiltroIgual(condicoes, valores, 'comunicacao.numero_whatsapp_id', filtros.numeroId);
  adicionarFiltroIgual(condicoes, valores, 'comunicacao.operador_usuario_id', filtros.operadorId);
  adicionarFiltroIgual(condicoes, valores, 'comunicacao.modelo_id', filtros.modeloId);
  adicionarFiltroIgual(condicoes, valores, 'comunicacao.campanha_id', filtros.campanhaId);

  if (filtros.bairro) {
    if (filtros.bairro === 'nao_informado') {
      condicoes.push("NULLIF(BTRIM(contato.bairro), '') IS NULL");
    } else {
      valores.push('%' + filtros.bairro + '%');
      condicoes.push('contato.bairro ILIKE $' + valores.length);
    }
  }
  if (filtros.problema) {
    if (filtros.problema === 'nao_informado') {
      condicoes.push("NULLIF(BTRIM(contato.problema), '') IS NULL");
    } else {
      valores.push('%' + filtros.problema + '%');
      condicoes.push('contato.problema ILIKE $' + valores.length);
    }
  }
  if (filtros.ultimoContatoInicio) {
    valores.push(filtros.ultimoContatoInicio);
    condicoes.push('comunicacao.criado_em >= $' + valores.length + '::date');
  }
  if (filtros.ultimoContatoFim) {
    valores.push(filtros.ultimoContatoFim);
    condicoes.push("comunicacao.criado_em < $" + valores.length + "::date + INTERVAL '1 day'");
  }

  const where = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : '';
  return (await banco.query(`
    SELECT comunicacao.*,contato.nome AS contato_nome,contato.telefone,
      contato.bairro,contato.problema,evento.nome AS evento_nome,
      modelo.nome AS modelo_nome,campanha.nome AS campanha_nome,
      numero.nome AS numero_nome,numero.numero AS numero_whatsapp,
      usuario.nome AS operador_nome,confirmador.nome AS confirmador_nome
    FROM comunicacoes AS comunicacao
    INNER JOIN contatos AS contato ON contato.id=comunicacao.contato_id
    LEFT JOIN eventos AS evento ON evento.id=comunicacao.evento_id
    LEFT JOIN modelos_mensagem AS modelo ON modelo.id=comunicacao.modelo_id
    LEFT JOIN campanhas AS campanha ON campanha.id=comunicacao.campanha_id
    INNER JOIN numeros_whatsapp AS numero ON numero.id=comunicacao.numero_whatsapp_id
    INNER JOIN usuarios AS usuario ON usuario.id=comunicacao.operador_usuario_id
    LEFT JOIN usuarios AS confirmador ON confirmador.id=comunicacao.confirmado_por_usuario_id
    ${where} ORDER BY comunicacao.criado_em DESC LIMIT 500
  `, valores)).rows;
}

async function listarContatos(filtros) {
  const valores = [];
  const condicoes = ['contato.bloqueado_para_mensagens=FALSE'];

  if (filtros.busca) {
    valores.push('%' + filtros.busca + '%');
    condicoes.push("(contato.nome ILIKE $" + valores.length +
      " OR (REGEXP_REPLACE($" + valores.length + ",'[^0-9]','','g') <> ''" +
      " AND contato.telefone_normalizado LIKE '%' || REGEXP_REPLACE($" +
      valores.length + ",'[^0-9]','','g') || '%'))");
  }
  if (filtros.bairro) {
    if (filtros.bairro === 'nao_informado') {
      condicoes.push("NULLIF(BTRIM(contato.bairro), '') IS NULL");
    } else {
      valores.push('%' + filtros.bairro + '%');
      condicoes.push('contato.bairro ILIKE $' + valores.length);
    }
  }
  if (filtros.problema) {
    if (filtros.problema === 'nao_informado') {
      condicoes.push("NULLIF(BTRIM(contato.problema), '') IS NULL");
    } else {
      valores.push('%' + filtros.problema + '%');
      condicoes.push('contato.problema ILIKE $' + valores.length);
    }
  }
  if (filtros.eventoId) {
    valores.push(filtros.eventoId);
    condicoes.push('EXISTS (SELECT 1 FROM contato_eventos ce WHERE ce.contato_id=contato.id AND ce.evento_id=$' + valores.length + ')');
  }
  if (filtros.cadastroIncompleto) {
    condicoes.push("(contato.nome IS NULL OR TRIM(contato.nome)='' OR contato.bairro IS NULL OR TRIM(contato.bairro)='' OR contato.problema IS NULL OR TRIM(contato.problema)='' OR contato.idade IS NULL)");
  }
  if (filtros.consentimento === 'autorizado') {
    condicoes.push("COALESCE(consentimento.estado,'nao_informado')='autorizado'");
  } else if (filtros.consentimento === 'nao_informado') {
    condicoes.push("COALESCE(consentimento.estado,'nao_informado')='nao_informado'");
  } else if (filtros.consentimento === 'recusado') {
    condicoes.push("COALESCE(consentimento.estado,'nao_informado') IN ('recusado','revogado')");
  }
  if (filtros.situacao === 'nunca_enviado') {
    condicoes.push('NOT EXISTS (SELECT 1 FROM comunicacoes cm WHERE cm.contato_id=contato.id AND cm.enviada_em IS NOT NULL)');
  } else if (filtros.situacao) {
    valores.push(filtros.situacao);
    condicoes.push('ultima.status=$' + valores.length);
  }
  if (filtros.campanhaNaoRecebidaId) {
    valores.push(filtros.campanhaNaoRecebidaId);
    condicoes.push('NOT EXISTS (SELECT 1 FROM comunicacoes cc WHERE cc.contato_id=contato.id AND cc.campanha_id=$' + valores.length + ' AND cc.enviada_em IS NOT NULL)');
  }

  const juncoes = `
    FROM contatos AS contato
    LEFT JOIN LATERAL (
      SELECT estado FROM consentimentos
      WHERE contato_id=contato.id AND tipo='mensagens'
      ORDER BY criado_em DESC,id DESC LIMIT 1
    ) AS consentimento ON TRUE
    LEFT JOIN LATERAL (
      SELECT status,criado_em FROM comunicacoes
      WHERE contato_id=contato.id ORDER BY criado_em DESC,id DESC LIMIT 1
    ) AS ultima ON TRUE
  `;
  const where = 'WHERE ' + condicoes.join(' AND ');
  const totalRegistros = Number((await banco.query(`
    SELECT COUNT(*) AS total
    ${juncoes}
    ${where}
  `, valores)).rows[0].total);

  valores.push(filtros.limite);
  const parametroLimite = '$' + valores.length;
  valores.push(filtros.deslocamento);
  const parametroDeslocamento = '$' + valores.length;
  const contatos = (await banco.query(`
    SELECT contato.id,contato.nome,contato.telefone,contato.bairro,contato.problema,
      contato.idade,COALESCE(consentimento.estado,'nao_informado') AS consentimento_mensagens,
      ultima.status AS ultimo_status,ultima.criado_em AS ultimo_contato_em
    ${juncoes}
    ${where}
    ORDER BY contato.nome NULLS LAST,contato.id
    LIMIT ${parametroLimite} OFFSET ${parametroDeslocamento}
  `, valores)).rows;

  return { contatos, totalRegistros };
}

async function listarHistorico(id) {
  return (await banco.query(`
    SELECT historico.*,usuario.nome AS usuario_nome
    FROM historico_comunicacoes AS historico
    INNER JOIN usuarios AS usuario ON usuario.id=historico.usuario_id
    WHERE historico.comunicacao_id=$1 ORDER BY historico.criado_em,id
  `, [id])).rows;
}

module.exports = {
  atualizar,
  buscarContexto,
  buscarRecebimentosDaCampanha,
  cancelarPreparada,
  cancelarPreparadas,
  contarComunicacoesDoNumero,
  confirmarEnvio,
  desfazerConfirmacao,
  desfazerConfirmacoes,
  confirmarPreparadas,
  excluirNumero,
  listar,
  listarCampanhas,
  listarContatos,
  listarHistorico,
  listarModelos,
  listarNumeros,
  listarOperadores,
  preparar,
  salvarCampanha,
  salvarModelo,
  salvarNumero
};
