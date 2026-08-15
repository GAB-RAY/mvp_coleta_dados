const banco = require('../../config/banco');
const consentimentoModel = require('../contatos/consentimentoModel');
const historicoContatoModel = require('../contatos/historicoContatoModel');
const ORDEM_STATUS = { pendente: 0, enviando: 1, enviada: 2, entregue: 3, lida: 4, falhou: 5 };

function avaliarTransicao(atual, novo) {
  if (atual === novo) return { deveAtualizar: false, motivo: 'status_repetido' };
  if (atual === 'falhou' || atual === 'lida') return { deveAtualizar: false, motivo: 'status_terminal' };
  if (novo === 'falhou') return { deveAtualizar: true };
  if (ORDEM_STATUS[novo] < ORDEM_STATUS[atual]) return { deveAtualizar: false, motivo: 'evento_atrasado' };
  return { deveAtualizar: true };
}

async function buscarTentativaPorIdentificador(cliente, identificadorExterno) {
  const resultado = await cliente.query(`
    SELECT tentativa.*, participacao.status AS participacao_status,
      participacao.id AS participacao_id
    FROM campanha_tentativas tentativa
    INNER JOIN campanha_participacoes participacao ON participacao.id = tentativa.participacao_id
    WHERE tentativa.identificador_externo = $1
    FOR UPDATE OF tentativa, participacao
  `, [identificadorExterno]);
  return resultado.rows[0] || null;
}

async function registrarEventoExterno(cliente, identificadorEvento, tipoEvento) {
  const resultado = await cliente.query(`
    INSERT INTO eventos_webhook_mensageria (identificador_externo, tipo_evento)
    VALUES ($1, $2)
    ON CONFLICT (identificador_externo) DO NOTHING
    RETURNING id
  `, [identificadorEvento, tipoEvento]);
  return Boolean(resultado.rows[0]);
}

async function registrarMensagemRecebida(identificadorExterno) {
  const resultado = await banco.query(`
    INSERT INTO eventos_webhook_mensageria (identificador_externo, tipo_evento)
    VALUES ($1, 'mensagem_recebida')
    ON CONFLICT (identificador_externo) DO NOTHING
    RETURNING id
  `, ['recebida:' + identificadorExterno]);
  return Boolean(resultado.rows[0]);
}

function candidatosTelefone(telefone) {
  const normalizado = String(telefone || '').replace(/\D/g, '');
  const candidatos = [normalizado];
  if (normalizado.startsWith('55')) candidatos.push(normalizado.slice(2));
  else candidatos.push('55' + normalizado);
  return Array.from(new Set(candidatos.filter(Boolean)));
}

async function registrarOptOut(dados) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const novoEvento = await registrarEventoExterno(cliente, 'recebida:' + dados.identificadorEvento, 'opt_out_whatsapp');
    if (!novoEvento) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: 'evento_repetido' };
    }
    const resultadoContato = await cliente.query(`
      SELECT id, origem_id, bloqueado_para_mensagens
      FROM contatos
      WHERE telefone_normalizado = ANY($1::text[])
      ORDER BY id LIMIT 1
      FOR UPDATE
    `, [candidatosTelefone(dados.telefone)]);
    const contato = resultadoContato.rows[0];
    if (!contato) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: 'contato_nao_encontrado' };
    }
    const resultadoConsentimento = await cliente.query(`
      SELECT texto_apresentado, versao_texto, origem_id
      FROM consentimentos
      WHERE contato_id=$1 AND tipo='mensagens' AND ativo=TRUE
      ORDER BY id DESC LIMIT 1
    `, [contato.id]);
    const atual = resultadoConsentimento.rows[0];
    const registro = await consentimentoModel.registrarRespostaSeDiferente(cliente, contato.id, {
      tipo: 'mensagens', resposta: false, estado: 'revogado',
      texto: atual && atual.texto_apresentado || 'Solicitacao de descadastramento recebida pelo WhatsApp.',
      versao: atual && atual.versao_texto || 'meta_optout_v1',
      canal: 'whatsapp', origemRegistro: 'revogacao', registradoPorUsuarioId: null,
      origemId: atual && atual.origem_id || contato.origem_id,
      motivoRevogacao: 'Solicitacao recebida pelo WhatsApp.'
    });
    const bloqueioAlterado = contato.bloqueado_para_mensagens !== true;
    if (bloqueioAlterado) {
      await cliente.query('UPDATE contatos SET bloqueado_para_mensagens=TRUE, atualizado_em=CURRENT_TIMESTAMP WHERE id=$1', [contato.id]);
    }
    if (registro || bloqueioAlterado) {
      await historicoContatoModel.registrar(cliente, contato.id, {
        tipoEvento: 'opt_out_whatsapp',
        dadosAnteriores: { bloqueadoParaMensagens: contato.bloqueado_para_mensagens },
        dadosNovos: {
          bloqueadoParaMensagens: true,
          origem: 'WhatsApp/Meta',
          campanhaId: dados.campanhaId || null,
          tentativaId: dados.tentativaId || null
        },
        origemId: contato.origem_id,
        registradoPorUsuarioId: null
      });
    }
    await cliente.query('COMMIT');
    return { processado: true, contatoId: contato.id, alterado: Boolean(registro || bloqueioAlterado) };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally { cliente.release(); }
}

async function iniciarEnvio(tentativaId, agora) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(41028, $1)', [tentativaId]);
    await cliente.query('SELECT pg_advisory_xact_lock(41027, 0)');
    const resultado = await cliente.query(`
      SELECT tentativa.id, tentativa.status, tentativa.participacao_id,
        participacao.campanha_id, participacao.contato_id, participacao.lote_original_id,
        participacao.reservado_em, campanha.status AS campanha_status,
        contato.nome AS contato_nome, contato.bairro AS contato_bairro,
        contato.problema AS contato_problema, contato.telefone_normalizado,
        contato.bloqueado_para_mensagens,
        EXISTS (
          SELECT 1
          FROM consentimentos AS consentimento_mensagens
          WHERE consentimento_mensagens.contato_id = contato.id
            AND consentimento_mensagens.tipo = 'mensagens'
            AND consentimento_mensagens.ativo = TRUE
            AND (
              consentimento_mensagens.estado IN ('recusado', 'revogado')
              OR consentimento_mensagens.resposta = FALSE
            )
        ) AS mensagens_recusadas,
        modelo.ativo AS modelo_ativo, modelo.meta_nome, modelo.meta_idioma,
        modelo.meta_status, modelo.meta_template_id, modelo.meta_status_oficial,
        modelo.meta_componentes, modelo.meta_configuracao_envio, modelo.meta_origem
      FROM campanha_tentativas tentativa
      INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id
      INNER JOIN campanha_lotes lote ON lote.id=participacao.lote_original_id AND lote.campanha_id=participacao.campanha_id
      INNER JOIN campanhas campanha ON campanha.id=participacao.campanha_id
      INNER JOIN contatos contato ON contato.id=participacao.contato_id
      INNER JOIN modelos_mensagem modelo ON modelo.id=campanha.modelo_id
      WHERE tentativa.id=$1
      FOR UPDATE OF tentativa, participacao, campanha, contato, modelo
    `, [tentativaId]);
    const tentativa = resultado.rows[0];
    if (!tentativa) { const erro = new Error('Tentativa nao encontrada.'); erro.codigo='TENTATIVA_NAO_ENCONTRADA'; throw erro; }
    if (tentativa.status !== 'pendente') { const erro = new Error('Esta tentativa ja foi processada ou esta em processamento.'); erro.codigo='ENVIO_DUPLICADO'; throw erro; }
    if (tentativa.campanha_status !== 'ativa') { const erro = new Error('A campanha precisa estar ativa para enviar mensagens.'); erro.codigo='CAMPANHA_INDISPONIVEL'; throw erro; }
    if (!tentativa.modelo_ativo || tentativa.meta_status_oficial !== 'APPROVED' ||
      !tentativa.meta_template_id || !tentativa.meta_nome || !tentativa.meta_idioma) {
      const erro = new Error('O template precisa estar aprovado e configurado na Meta.'); erro.codigo='TEMPLATE_NAO_APROVADO'; throw erro;
    }
    if (tentativa.bloqueado_para_mensagens) {
      const erro = new Error('O contato bloqueou mensagens pelo WhatsApp.');
      erro.codigo='CONTATO_BLOQUEADO';
      throw erro;
    }
    if (tentativa.mensagens_recusadas) {
      const erro = new Error('O contato recusou ou revogou mensagens pelo WhatsApp.');
      erro.codigo='CONTATO_BLOQUEADO';
      throw erro;
    }
    const exclusao = await cliente.query("SELECT 1 FROM solicitacoes_exclusao WHERE contato_id=$1 AND status='pendente'", [tentativa.contato_id]);
    if (exclusao.rows[0]) { const erro = new Error('O contato possui solicitacao de exclusao pendente.'); erro.codigo='CONTATO_BLOQUEADO'; throw erro; }
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
    const limite = limiteMeta === null ? limiteInterno : Math.min(limiteInterno, limiteMeta);
    const usados = await cliente.query(`SELECT COUNT(*)::integer total FROM campanha_participacoes
      WHERE reservado_em >= $1::timestamptz - INTERVAL '24 hours' AND reservado_em <= $1::timestamptz`, [agora]);
    const reservaNaJanela = new Date(tentativa.reservado_em) >= new Date(new Date(agora).getTime() - 86400000);
    if (reservaNaJanela && usados.rows[0].total > limite) {
      const erro = new Error('A capacidade configurada esta excedida. Aguarde a liberacao da janela de 24 horas.'); erro.codigo='CAPACIDADE_INSUFICIENTE'; erro.capacidade=0; throw erro;
    }
    if (!reservaNaJanela && usados.rows[0].total >= limite) {
      const erro = new Error('Nao ha capacidade disponivel na janela de 24 horas.'); erro.codigo='CAPACIDADE_INSUFICIENTE'; erro.capacidade=0; throw erro;
    }
    if (!reservaNaJanela) await cliente.query('UPDATE campanha_participacoes SET reservado_em=$2, atualizado_em=$2 WHERE id=$1', [tentativa.participacao_id, agora]);
    await cliente.query("UPDATE campanha_tentativas SET status='enviando', iniciada_em=$2 WHERE id=$1", [tentativa.id, agora]);
    await cliente.query("UPDATE campanha_participacoes SET status='enviando', atualizado_em=$2 WHERE id=$1", [tentativa.participacao_id, agora]);
    await cliente.query(`INSERT INTO historico_status_mensageria
      (participacao_id,tentativa_id,status_anterior,status_novo,origem,criado_em)
      VALUES ($1,$2,'pendente','enviando','processamento',$3)`, [tentativa.participacao_id, tentativa.id, agora]);
    await cliente.query('COMMIT');
    return tentativa;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally { cliente.release(); }
}

async function concluirEnvio(tentativaId, identificadorExterno, agora) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(`UPDATE campanha_tentativas
      SET status='enviada', identificador_externo=$2 WHERE id=$1 AND status='enviando'
      RETURNING participacao_id`, [tentativaId, identificadorExterno]);
    if (!resultado.rows[0]) throw new Error('Tentativa nao esta pronta para confirmacao.');
    const participacaoId = resultado.rows[0].participacao_id;
    await cliente.query("UPDATE campanha_participacoes SET status='enviada',atualizado_em=$2 WHERE id=$1", [participacaoId, agora]);
    await cliente.query(`INSERT INTO historico_status_mensageria
      (participacao_id,tentativa_id,status_anterior,status_novo,origem,criado_em)
      VALUES ($1,$2,'enviando','enviada','processamento',$3)`, [participacaoId, tentativaId, agora]);
    await cliente.query('COMMIT');
    return { id: tentativaId, status: 'enviada', identificadorExterno };
  } catch (erro) { await cliente.query('ROLLBACK'); throw erro; }
  finally { cliente.release(); }
}

async function registrarFalhaEnvio(tentativaId, erroSanitizado, agora) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(`UPDATE campanha_tentativas SET status='falhou',
      codigo_erro_externo=$2,titulo_erro=$3,descricao_erro=$4,categoria_erro=$5,
      permite_nova_tentativa=$6,finalizada_em=$7
      WHERE id=$1 AND status='enviando' RETURNING participacao_id`,
    [tentativaId, erroSanitizado.codigo, erroSanitizado.titulo, erroSanitizado.descricao,
      erroSanitizado.categoria, erroSanitizado.permiteNovaTentativa, agora]);
    if (resultado.rows[0]) {
      const participacaoId=resultado.rows[0].participacao_id;
      await cliente.query("UPDATE campanha_participacoes SET status='falhou',atualizado_em=$2 WHERE id=$1",[participacaoId,agora]);
      await cliente.query(`INSERT INTO historico_status_mensageria
        (participacao_id,tentativa_id,status_anterior,status_novo,origem,codigo_erro_sanitizado,descricao_erro_sanitizada,criado_em)
        VALUES ($1,$2,'enviando','falhou','processamento',$3,$4,$5)`,[participacaoId,tentativaId,erroSanitizado.codigo,erroSanitizado.descricao,agora]);
    }
    await cliente.query('COMMIT');
  } catch (erro) { await cliente.query('ROLLBACK'); throw erro; }
  finally { cliente.release(); }
}

async function atualizarStatusPorIdentificador(dados) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const novoEvento = await registrarEventoExterno(cliente, dados.chaveEvento, dados.status);
    if (!novoEvento) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: 'evento_repetido' };
    }
    const tentativa = await buscarTentativaPorIdentificador(cliente, dados.identificadorExterno);
    if (!tentativa) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: 'tentativa_nao_encontrada' };
    }
    const transicao = avaliarTransicao(tentativa.status, dados.status);
    if (!transicao.deveAtualizar) {
      await cliente.query('COMMIT');
      return { processado: false, motivo: transicao.motivo };
    }
    await cliente.query(`
      UPDATE campanha_tentativas
      SET status=$2::varchar, codigo_erro_externo=$3, titulo_erro=$4,
        descricao_erro=$5, categoria_erro=$6,
        permite_nova_tentativa=$7,
        finalizada_em=CASE WHEN $2::varchar IN ('lida','falhou') THEN CURRENT_TIMESTAMP ELSE finalizada_em END
      WHERE id=$1
    `, [tentativa.id, dados.status, dados.erro.codigo, dados.erro.titulo,
      dados.erro.descricao, dados.erro.categoria, dados.erro.permiteNovaTentativa]);
    await cliente.query(`
      UPDATE campanha_participacoes SET status=$2::varchar, atualizado_em=CURRENT_TIMESTAMP WHERE id=$1
    `, [tentativa.participacao_id, dados.status]);
    await cliente.query(`
      INSERT INTO historico_status_mensageria (
        participacao_id,tentativa_id,status_anterior,status_novo,origem,
        codigo_erro_sanitizado,descricao_erro_sanitizada
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [tentativa.participacao_id, tentativa.id, tentativa.status, dados.status,
      dados.origem, dados.erro.codigo, dados.erro.descricao]);
    await cliente.query('COMMIT');
    return { processado: true, participacaoId: tentativa.participacao_id };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function vincularIdentificadorExterno(tentativaId, identificadorExterno) {
  const resultado = await banco.query(`
    UPDATE campanha_tentativas SET identificador_externo=$2
    WHERE id=$1 AND identificador_externo IS NULL
    RETURNING *
  `, [tentativaId, identificadorExterno]);
  return resultado.rows[0] || null;
}

async function buscarTentativa(id) {
  const resultado = await banco.query(`
    SELECT tentativa.*, participacao.campanha_id, participacao.contato_id,
      participacao.lote_original_id
    FROM campanha_tentativas tentativa
    INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id
    WHERE tentativa.id=$1
  `, [id]);
  return resultado.rows[0] || null;
}

async function buscarTentativaPorIdentificadorPublico(identificadorExterno) {
  const resultado = await banco.query(`
    SELECT tentativa.id, participacao.campanha_id
    FROM campanha_tentativas tentativa
    INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id
    WHERE tentativa.identificador_externo=$1
  `, [identificadorExterno]);
  return resultado.rows[0] || null;
}

async function reprocessarFalha(tentativaId) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const atualResultado = await cliente.query(`
      SELECT tentativa.*, participacao.status AS participacao_status
      FROM campanha_tentativas tentativa
      INNER JOIN campanha_participacoes participacao ON participacao.id=tentativa.participacao_id
      WHERE tentativa.id=$1
        AND NOT EXISTS (
          SELECT 1 FROM campanha_tentativas tentativa_nova
          WHERE tentativa_nova.participacao_id=tentativa.participacao_id
            AND tentativa_nova.numero_tentativa>tentativa.numero_tentativa
        )
      FOR UPDATE OF tentativa, participacao
    `, [tentativaId]);
    const atual = atualResultado.rows[0];
    if (!atual || atual.status !== 'falhou') {
      const erro = new Error('Tentativa nao encontrada ou nao esta com falha.');
      erro.codigo = 'REPROCESSAMENTO_INVALIDO';
      throw erro;
    }
    const proximoResultado = await cliente.query(`
      SELECT COALESCE(MAX(numero_tentativa),0)+1 AS numero
      FROM campanha_tentativas WHERE participacao_id=$1
    `, [atual.participacao_id]);
    const nova = await cliente.query(`
      INSERT INTO campanha_tentativas (participacao_id,numero_tentativa,status)
      VALUES ($1,$2,'pendente') RETURNING *
    `, [atual.participacao_id, proximoResultado.rows[0].numero]);
    await cliente.query("UPDATE campanha_participacoes SET status='pendente',atualizado_em=CURRENT_TIMESTAMP WHERE id=$1", [atual.participacao_id]);
    await cliente.query(`
      INSERT INTO historico_status_mensageria (participacao_id,tentativa_id,status_anterior,status_novo,origem)
      VALUES ($1,$2,'falhou','pendente','reprocessamento')
    `, [atual.participacao_id, nova.rows[0].id]);
    await cliente.query('COMMIT');
    return nova.rows[0];
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = {
  atualizarStatusPorIdentificador, buscarTentativa, buscarTentativaPorIdentificadorPublico,
  concluirEnvio, iniciarEnvio,
  registrarFalhaEnvio, registrarMensagemRecebida, registrarOptOut,
  reprocessarFalha, vincularIdentificadorExterno
};
