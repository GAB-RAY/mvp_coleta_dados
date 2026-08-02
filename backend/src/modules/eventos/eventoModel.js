const banco = require('../../config/banco');

function camposEvento() {
  return `
    SELECT evento.*, criador.nome AS criado_por, atualizador.nome AS atualizado_por,
      COUNT(contato_evento.id)::integer AS total_cadastros
    FROM eventos AS evento
    INNER JOIN usuarios AS criador ON criador.id = evento.criado_por_usuario_id
    INNER JOIN usuarios AS atualizador ON atualizador.id = evento.atualizado_por_usuario_id
    LEFT JOIN contato_eventos AS contato_evento ON contato_evento.evento_id = evento.id
  `;
}

async function listar() {
  const resultado = await banco.query(camposEvento() + `
    WHERE evento.status <> 'excluido'
    GROUP BY evento.id, criador.nome, atualizador.nome
    ORDER BY evento.data_inicial DESC, evento.id DESC
  `);
  return resultado.rows;
}

async function excluir(id, usuarioId) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const atual = await cliente.query(
      "SELECT * FROM eventos WHERE id=$1 AND status<>'excluido' FOR UPDATE",
      [id]
    );
    if (!atual.rows[0]) {
      await cliente.query('ROLLBACK');
      return null;
    }
    const resultado = await cliente.query(`
      UPDATE eventos
      SET status='excluido', atualizado_por_usuario_id=$2
      WHERE id=$1 RETURNING *
    `, [id, usuarioId]);
    await registrarHistorico(
      cliente,
      id,
      'exclusao',
      atual.rows[0],
      resultado.rows[0],
      usuarioId
    );
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function buscarDisponivelPorId(id, clienteRecebido) {
  const executor = clienteRecebido || banco;
  const resultado = await executor.query(`
    SELECT * FROM eventos
    WHERE id = $1 AND status = 'ativo'
      AND CURRENT_TIMESTAMP BETWEEN inscricoes_inicio AND inscricoes_fim
    LIMIT 1
  `, [id]);
  return resultado.rows[0] || null;
}

async function registrarHistorico(cliente, eventoId, tipoAcao, anteriores, novos, usuarioId) {
  await cliente.query(`
    INSERT INTO historico_eventos
      (evento_id, tipo_acao, dados_anteriores, dados_novos, usuario_id)
    VALUES ($1, $2, $3, $4, $5)
  `, [eventoId, tipoAcao, anteriores, novos, usuarioId]);
}

async function criar(dados, usuarioId) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(`
      INSERT INTO eventos (
        nome, motivo, descricao, data_inicial, data_final, local_evento,
        link_evento, inscricoes_inicio, inscricoes_fim, status,
        criado_por_usuario_id, atualizado_por_usuario_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'rascunho',$10,$10)
      RETURNING *
    `, [
      dados.nome, dados.descricao, dados.descricao, dados.dataInicial,
      dados.dataFinal, dados.local, dados.link, dados.inscricoesInicio,
      dados.inscricoesFim, usuarioId
    ]);
    await registrarHistorico(cliente, resultado.rows[0].id, 'criacao', null, resultado.rows[0], usuarioId);
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function editar(id, dados, usuarioId) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const atual = await cliente.query(
      "SELECT * FROM eventos WHERE id=$1 AND status<>'excluido' FOR UPDATE",
      [id]
    );
    if (!atual.rows[0]) {
      await cliente.query('ROLLBACK');
      return null;
    }
    const resultado = await cliente.query(`
      UPDATE eventos SET nome=$2, motivo=$3, descricao=$3, data_inicial=$4,
        data_final=$5, local_evento=$6, link_evento=$7,
        inscricoes_inicio=$8, inscricoes_fim=$9, atualizado_por_usuario_id=$10
      WHERE id=$1 RETURNING *
    `, [id, dados.nome, dados.descricao, dados.dataInicial, dados.dataFinal,
      dados.local, dados.link, dados.inscricoesInicio, dados.inscricoesFim, usuarioId]);
    await registrarHistorico(cliente, id, 'edicao', atual.rows[0], resultado.rows[0], usuarioId);
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function alterarStatus(id, novoStatus, usuarioId) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const atual = await cliente.query(
      "SELECT * FROM eventos WHERE id=$1 AND status<>'excluido' FOR UPDATE",
      [id]
    );
    if (!atual.rows[0]) {
      await cliente.query('ROLLBACK');
      return null;
    }
    if (novoStatus === 'ativo') {
      const agora = Date.now();
      if (agora > new Date(atual.rows[0].inscricoes_fim).getTime()) {
        const erro = new Error('O período de inscrições deste evento já terminou.');
        erro.codigoAplicacao = 'EVENTO_FORA_PERIODO';
        throw erro;
      }
    }
    const resultado = await cliente.query(`
      UPDATE eventos SET status=$2, atualizado_por_usuario_id=$3 WHERE id=$1 RETURNING *
    `, [id, novoStatus, usuarioId]);
    await registrarHistorico(cliente, id, novoStatus === 'ativo' ? 'ativacao' : 'encerramento', atual.rows[0], resultado.rows[0], usuarioId);
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function listarParticipantes(eventoId, filtros) {
  const valores=[eventoId];
  const condicoes=["vinculo.evento_id=$1","evento.status<>'excluido'"];
  if(filtros.nome){valores.push('%'+filtros.nome+'%');condicoes.push('contato.nome ILIKE $'+valores.length);}
  if(filtros.telefone){valores.push('%'+filtros.telefone+'%');condicoes.push('contato.telefone_normalizado LIKE $'+valores.length);}
  if(filtros.statusInscricao){valores.push(filtros.statusInscricao);condicoes.push('vinculo.status_inscricao=$'+valores.length);}
  if(filtros.statusMensagem){valores.push(filtros.statusMensagem);condicoes.push("COALESCE((SELECT status FROM comunicacoes WHERE contato_id=contato.id AND evento_id=vinculo.evento_id ORDER BY criado_em DESC,id DESC LIMIT 1),'nao_contatado')=$"+valores.length);}
  return (await banco.query(`
    SELECT contato.id,contato.nome,contato.telefone,contato.bairro,vinculo.status_inscricao,
      vinculo.cadastrado_em,
      COALESCE((SELECT status FROM comunicacoes WHERE contato_id=contato.id AND evento_id=vinculo.evento_id ORDER BY criado_em DESC,id DESC LIMIT 1),'nao_contatado') AS status_mensagem
    FROM contato_eventos AS vinculo
    INNER JOIN contatos AS contato ON contato.id=vinculo.contato_id
    INNER JOIN eventos AS evento ON evento.id=vinculo.evento_id
    WHERE ${condicoes.join(' AND ')} ORDER BY vinculo.cadastrado_em DESC
  `,valores)).rows;
}

async function atualizarStatusInscricao(eventoId,contatoId,status){
  return (await banco.query(`
    UPDATE contato_eventos SET status_inscricao=$3
    WHERE evento_id=$1 AND contato_id=$2
      AND EXISTS (
        SELECT 1 FROM eventos WHERE id=$1 AND status<>'excluido'
      )
    RETURNING *
  `,[eventoId,contatoId,status])).rows[0]||null;
}

module.exports = { alterarStatus, atualizarStatusInscricao, buscarDisponivelPorId, criar, editar, excluir, listar, listarParticipantes };
