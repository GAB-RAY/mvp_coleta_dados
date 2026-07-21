const banco = require('../../config/banco');
const consentimentoModel = require('./consentimentoModel');
const aceitePrivacidadeModel = require('./aceitePrivacidadeModel');
const historicoContatoModel = require('./historicoContatoModel');
const textoFormularioModel = require('./textoFormularioModel');

async function buscarOrigemFormularioPublico(cliente) {
  const resultado = await cliente.query(
    `
      SELECT id, nome
      FROM origens
      WHERE slug = 'formulario-publico'
        AND ativa = TRUE
      LIMIT 1
    `
  );

  if (!resultado.rows[0]) {
    throw new Error('A origem formulario-publico não está configurada.');
  }

  return resultado.rows[0];
}

function campoEstaVazio(valor) {
  return valor === null || valor === undefined || (
    typeof valor === 'string' && valor.trim() === ''
  );
}

async function criarContatoPublico(cliente, dadosDoContato, origem) {
  const consulta = `
    INSERT INTO contatos (
      nome,
      telefone,
      telefone_normalizado,
      bairro,
      problema,
      consentimento_armazenamento,
      consentimento_mensagens,
      consentimento_armazenamento_em,
      consentimento_mensagens_em,
      consentimento_tratamento_dados,
      consentimento_whatsapp,
      consentimento_ligacoes,
      consentimentos_atualizados_em,
      origem_atual,
      status_contato,
      bloqueado_para_mensagens,
      excluido_logicamente,
      atualizado_em,
      origem_id,
      idade,
      descricao_problema,
      participou_eleicao_anterior
    )
    VALUES (
      $1, $2, $3, $4, $5,
      TRUE, FALSE, CURRENT_TIMESTAMP, NULL,
      NULL, NULL, NULL, NULL,
      $6, 'ativo', FALSE, FALSE, CURRENT_TIMESTAMP,
      $7, $8, $9, $10
    )
    ON CONFLICT (telefone_normalizado) DO NOTHING
    RETURNING *
  `;
  const valores = [
    dadosDoContato.nome,
    dadosDoContato.telefone,
    dadosDoContato.telefoneNormalizado,
    dadosDoContato.bairro,
    dadosDoContato.problema,
    origem.nome,
    origem.id,
    dadosDoContato.idade,
    dadosDoContato.descricaoProblema,
    dadosDoContato.participouEleicaoAnterior
  ];
  const resultado = await cliente.query(consulta, valores);

  return resultado.rows[0] || null;
}

async function buscarContatoParaAtualizacao(cliente, telefoneNormalizado) {
  const resultado = await cliente.query(
    `
      SELECT *
      FROM contatos
      WHERE telefone_normalizado = $1
      LIMIT 1
      FOR UPDATE
    `,
    [telefoneNormalizado]
  );

  return resultado.rows[0] || null;
}

async function complementarCamposVazios(cliente, contato, dadosDoContato, origemId) {
  const campos = [
    { coluna: 'nome', propriedade: 'nome' },
    { coluna: 'bairro', propriedade: 'bairro' },
    { coluna: 'problema', propriedade: 'problema' },
    { coluna: 'idade', propriedade: 'idade' },
    { coluna: 'descricao_problema', propriedade: 'descricaoProblema' },
    {
      coluna: 'participou_eleicao_anterior',
      propriedade: 'participouEleicaoAnterior'
    }
  ];
  const atribuicoes = [];
  const valores = [];
  const dadosAnteriores = {};
  const dadosNovos = {};

  campos.forEach(function (campo) {
    const valorAtual = contato[campo.coluna];
    const valorRecebido = dadosDoContato[campo.propriedade];

    if (campoEstaVazio(valorAtual) && !campoEstaVazio(valorRecebido)) {
      valores.push(valorRecebido);
      atribuicoes.push(campo.coluna + ' = $' + valores.length);
      dadosAnteriores[campo.propriedade] = valorAtual;
      dadosNovos[campo.propriedade] = valorRecebido;
    }
  });

  if (atribuicoes.length === 0) {
    return [];
  }

  valores.push(contato.id);
  atribuicoes.push('atualizado_em = CURRENT_TIMESTAMP');

  await cliente.query(
    'UPDATE contatos SET ' + atribuicoes.join(', ') +
      ' WHERE id = $' + valores.length,
    valores
  );
  await historicoContatoModel.registrar(cliente, contato.id, {
    tipoEvento: 'complemento_cadastro_publico',
    dadosAnteriores,
    dadosNovos,
    origemId,
    registradoPorUsuarioId: null
  });

  return Object.keys(dadosNovos);
}

async function registrarPrivacidadeEAutorizacoes(
  cliente,
  contatoId,
  dadosDoContato,
  origem,
  textos
) {
  await aceitePrivacidadeModel.registrarSeDiferente(cliente, contatoId, {
    texto: textos.aviso_privacidade.texto,
    versao: textos.aviso_privacidade.versao,
    origemId: origem.id,
    canal: 'formulario_publico',
    registradoPorUsuarioId: null
  });

  if (dadosDoContato.autorizacaoMensagens === true) {
    await consentimentoModel.registrarAutorizacaoSeDiferente(cliente, contatoId, {
      tipo: 'mensagens',
      texto: textos.mensagens.texto,
      versao: textos.mensagens.versao,
      origemId: origem.id,
      canal: 'formulario_publico',
      registradoPorUsuarioId: null
    });
  }

  if (dadosDoContato.autorizacaoLigacoes === true) {
    await consentimentoModel.registrarAutorizacaoSeDiferente(cliente, contatoId, {
      tipo: 'ligacoes',
      texto: textos.ligacoes.texto,
      versao: textos.ligacoes.versao,
      origemId: origem.id,
      canal: 'formulario_publico',
      registradoPorUsuarioId: null
    });
  }
}

async function salvarCadastroPublico(dadosDoContato) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const origem = await buscarOrigemFormularioPublico(cliente);
    const textos = await textoFormularioModel.buscarAtivos(cliente);

    if (!textos.aviso_privacidade || !textos.mensagens || !textos.ligacoes) {
      throw new Error('Os textos ativos do formulário não estão completos.');
    }

    let contato = await criarContatoPublico(cliente, dadosDoContato, origem);
    let contatoCriado = true;
    let camposComplementados = [];

    if (!contato) {
      contatoCriado = false;
      contato = await buscarContatoParaAtualizacao(
        cliente,
        dadosDoContato.telefoneNormalizado
      );

      if (!contato) {
        throw new Error('Não foi possível localizar o contato concorrente.');
      }

      camposComplementados = await complementarCamposVazios(
        cliente,
        contato,
        dadosDoContato,
        origem.id
      );
    }

    await registrarPrivacidadeEAutorizacoes(
      cliente,
      contato.id,
      dadosDoContato,
      origem,
      textos
    );

    await cliente.query('COMMIT');

    return {
      contatoCriado,
      camposComplementados
    };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function buscarOrigemAtivaPorId(cliente, origemId) {
  const resultado = await cliente.query(
    'SELECT id, nome FROM origens WHERE id = $1 AND ativa = TRUE',
    [origemId]
  );

  return resultado.rows[0] || null;
}

async function criarContatoManual(cliente, dadosDoContato, origem) {
  const resultado = await cliente.query(
    `
      INSERT INTO contatos (
        nome, telefone, telefone_normalizado, bairro, problema,
        consentimento_armazenamento, consentimento_mensagens,
        consentimento_armazenamento_em, consentimento_mensagens_em,
        consentimento_tratamento_dados, consentimento_whatsapp,
        consentimento_ligacoes, origem_atual, status_contato,
        bloqueado_para_mensagens, excluido_logicamente, atualizado_em,
        origem_id, idade, descricao_problema, participou_eleicao_anterior
      )
      VALUES (
        $1, $2, $3, $4, $5,
        TRUE, FALSE, CURRENT_TIMESTAMP, NULL,
        NULL, NULL, NULL, $6, $7,
        FALSE, FALSE, CURRENT_TIMESTAMP,
        $8, $9, $10, $11
      )
      ON CONFLICT (telefone_normalizado) DO NOTHING
      RETURNING *
    `,
    [
      dadosDoContato.nome,
      dadosDoContato.telefone,
      dadosDoContato.telefoneNormalizado,
      dadosDoContato.bairro,
      dadosDoContato.problema,
      origem.nome,
      dadosDoContato.status,
      origem.id,
      dadosDoContato.idade,
      dadosDoContato.descricaoProblema,
      dadosDoContato.participouEleicaoAnterior
    ]
  );

  return resultado.rows[0] || null;
}

async function atualizarContatoManual(cliente, contato, dadosDoContato, origem, usuarioId) {
  const campos = [
    { coluna: 'nome', propriedade: 'nome' },
    { coluna: 'bairro', propriedade: 'bairro' },
    { coluna: 'problema', propriedade: 'problema' },
    { coluna: 'idade', propriedade: 'idade' },
    { coluna: 'descricao_problema', propriedade: 'descricaoProblema' },
    { coluna: 'participou_eleicao_anterior', propriedade: 'participouEleicaoAnterior' },
    { coluna: 'status_contato', propriedade: 'status' }
  ];
  const atribuicoes = [];
  const valores = [];
  const anteriores = {};
  const novos = {};

  campos.forEach(function (campo) {
    const atual = contato[campo.coluna];
    const recebido = dadosDoContato[campo.propriedade];

    if (!campoEstaVazio(recebido) && String(atual || '') !== String(recebido)) {
      valores.push(recebido);
      atribuicoes.push(campo.coluna + ' = $' + valores.length);
      anteriores[campo.propriedade] = atual;
      novos[campo.propriedade] = recebido;
    }
  });

  if (atribuicoes.length === 0) {
    return [];
  }

  valores.push(contato.id);
  atribuicoes.push('atualizado_em = CURRENT_TIMESTAMP');
  await cliente.query(
    'UPDATE contatos SET ' + atribuicoes.join(', ') +
      ' WHERE id = $' + valores.length,
    valores
  );
  await historicoContatoModel.registrar(cliente, contato.id, {
    tipoEvento: 'atualizacao_cadastro_manual',
    dadosAnteriores: anteriores,
    dadosNovos: novos,
    origemId: origem.id,
    registradoPorUsuarioId: usuarioId
  });

  return Object.keys(novos);
}

async function registrarRespostaManual(
  cliente,
  contatoId,
  tipo,
  estado,
  texto,
  origem,
  usuarioId
) {
  if (estado === 'nao_informado') {
    return null;
  }

  return consentimentoModel.registrarRespostaSeDiferente(cliente, contatoId, {
    tipo,
    resposta: estado === 'autorizado',
    estado,
    texto: texto.texto,
    versao: texto.versao,
    canal: 'cadastro_manual',
    origemRegistro: 'resposta_expressa',
    registradoPorUsuarioId: usuarioId,
    origemId: origem.id
  });
}

async function salvarCadastroManual(dadosDoContato, usuarioId) {
  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    const origem = await buscarOrigemAtivaPorId(cliente, dadosDoContato.origemId);
    const textos = await textoFormularioModel.buscarAtivos(cliente);

    if (!origem) {
      const erroOrigem = new Error('Origem não encontrada.');
      erroOrigem.codigoAplicacao = 'ORIGEM_NAO_ENCONTRADA';
      throw erroOrigem;
    }

    if (!textos.aviso_privacidade || !textos.mensagens || !textos.ligacoes) {
      throw new Error('Os textos ativos do formulário não estão completos.');
    }

    let contato = await criarContatoManual(cliente, dadosDoContato, origem);
    let contatoCriado = true;
    let camposAlterados = [];

    if (!contato) {
      contatoCriado = false;
      contato = await buscarContatoParaAtualizacao(
        cliente,
        dadosDoContato.telefoneNormalizado
      );
      camposAlterados = await atualizarContatoManual(
        cliente,
        contato,
        dadosDoContato,
        origem,
        usuarioId
      );
    }

    if (dadosDoContato.aceitePrivacidade === true) {
      await aceitePrivacidadeModel.registrarSeDiferente(cliente, contato.id, {
        texto: textos.aviso_privacidade.texto,
        versao: textos.aviso_privacidade.versao,
        origemId: origem.id,
        canal: 'cadastro_manual',
        registradoPorUsuarioId: usuarioId
      });
    }

    await registrarRespostaManual(
      cliente,
      contato.id,
      'mensagens',
      dadosDoContato.autorizacaoMensagens,
      textos.mensagens,
      origem,
      usuarioId
    );
    await registrarRespostaManual(
      cliente,
      contato.id,
      'ligacoes',
      dadosDoContato.autorizacaoLigacoes,
      textos.ligacoes,
      origem,
      usuarioId
    );

    await cliente.query('COMMIT');

    return {
      id: contato.id,
      contatoCriado,
      camposAlterados
    };
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

function construirFiltros(filtros) {
  const condicoes = [];
  const valores = [];

  if (filtros.nome) {
    valores.push('%' + filtros.nome + '%');
    condicoes.push('contato.nome ILIKE $' + valores.length);
  }

  if (filtros.telefone) {
    valores.push('%' + filtros.telefone + '%');
    condicoes.push('contato.telefone_normalizado LIKE $' + valores.length);
  }

  if (filtros.bairro) {
    valores.push('%' + filtros.bairro + '%');
    condicoes.push('contato.bairro ILIKE $' + valores.length);
  }

  if (filtros.problema) {
    valores.push('%' + filtros.problema + '%');
    condicoes.push('contato.problema ILIKE $' + valores.length);
  }

  if (filtros.origem) {
    valores.push('%' + filtros.origem + '%');
    condicoes.push(
      "COALESCE(origem.nome, contato.origem_atual, '') ILIKE $" + valores.length
    );
  }

  if (filtros.status) {
    valores.push('%' + filtros.status + '%');
    condicoes.push("COALESCE(contato.status_contato, '') ILIKE $" + valores.length);
  }

  if (filtros.consentimentoWhatsapp !== undefined) {
    if (filtros.consentimentoWhatsapp === null) {
      condicoes.push('contato.consentimento_whatsapp IS NULL');
    } else {
      valores.push(filtros.consentimentoWhatsapp);
      condicoes.push('contato.consentimento_whatsapp = $' + valores.length);
    }
  }

  if (filtros.consentimentoLigacoes !== undefined) {
    if (filtros.consentimentoLigacoes === null) {
      condicoes.push('contato.consentimento_ligacoes IS NULL');
    } else {
      valores.push(filtros.consentimentoLigacoes);
      condicoes.push('contato.consentimento_ligacoes = $' + valores.length);
    }
  }

  if (filtros.idadeMinima !== null) {
    valores.push(filtros.idadeMinima);
    condicoes.push('contato.idade >= $' + valores.length);
  }

  if (filtros.idadeMaxima !== null) {
    valores.push(filtros.idadeMaxima);
    condicoes.push('contato.idade <= $' + valores.length);
  }

  if (filtros.participouEleicaoAnterior) {
    valores.push(filtros.participouEleicaoAnterior);
    condicoes.push('contato.participou_eleicao_anterior = $' + valores.length);
  }

  if (filtros.autorizacaoMensagens) {
    valores.push(filtros.autorizacaoMensagens);
    condicoes.push(`
      COALESCE((
        SELECT consentimento.estado
        FROM consentimentos AS consentimento
        WHERE consentimento.contato_id = contato.id
          AND consentimento.tipo = 'mensagens'
        ORDER BY consentimento.criado_em DESC, consentimento.id DESC
        LIMIT 1
      ), 'nao_informado') = $${valores.length}
    `);
  }

  if (filtros.autorizacaoLigacoes) {
    valores.push(filtros.autorizacaoLigacoes);
    condicoes.push(`
      COALESCE((
        SELECT consentimento.estado
        FROM consentimentos AS consentimento
        WHERE consentimento.contato_id = contato.id
          AND consentimento.tipo = 'ligacoes'
        ORDER BY consentimento.criado_em DESC, consentimento.id DESC
        LIMIT 1
      ), 'nao_informado') = $${valores.length}
    `);
  }

  if (filtros.dataInicial) {
    valores.push(filtros.dataInicial);
    condicoes.push('contato.criado_em >= $' + valores.length + '::date');
  }

  if (filtros.dataFinal) {
    valores.push(filtros.dataFinal);
    condicoes.push(
      'contato.criado_em < ($' + valores.length + '::date + INTERVAL \'1 day\')'
    );
  }

  const clausulaWhere = condicoes.length > 0
    ? 'WHERE ' + condicoes.join(' AND ')
    : '';

  return {
    clausulaWhere,
    valores
  };
}

async function listar(filtros, pagina, limite) {
  const filtrosSql = construirFiltros(filtros);
  const valores = filtrosSql.valores.slice();
  const deslocamento = (pagina - 1) * limite;
  const posicaoLimite = valores.length + 1;
  const posicaoDeslocamento = valores.length + 2;

  valores.push(limite);
  valores.push(deslocamento);

  const ordenacoes = {
    mais_recentes: 'contato.criado_em DESC, contato.id DESC',
    mais_antigos: 'contato.criado_em ASC, contato.id ASC',
    nome_asc: 'contato.nome ASC, contato.id ASC',
    nome_desc: 'contato.nome DESC, contato.id DESC'
  };
  const ordem = ordenacoes[filtros.ordenacao] || ordenacoes.mais_recentes;
  const consulta = `
    SELECT
      contato.id,
      contato.nome,
      contato.telefone,
      contato.bairro,
      contato.problema,
      contato.idade,
      contato.descricao_problema,
      contato.participou_eleicao_anterior,
      contato.consentimento_tratamento_dados,
      contato.consentimento_whatsapp,
      contato.consentimento_ligacoes,
      contato.origem_atual,
      contato.status_contato,
      contato.bloqueado_para_mensagens,
      contato.criado_em,
      COALESCE(origem.nome, contato.origem_atual) AS origem_nome,
      COALESCE((
        SELECT consentimento.estado
        FROM consentimentos AS consentimento
        WHERE consentimento.contato_id = contato.id
          AND consentimento.tipo = 'mensagens'
        ORDER BY consentimento.criado_em DESC, consentimento.id DESC
        LIMIT 1
      ), 'nao_informado') AS autorizacao_mensagens,
      COALESCE((
        SELECT consentimento.estado
        FROM consentimentos AS consentimento
        WHERE consentimento.contato_id = contato.id
          AND consentimento.tipo = 'ligacoes'
        ORDER BY consentimento.criado_em DESC, consentimento.id DESC
        LIMIT 1
      ), 'nao_informado') AS autorizacao_ligacoes,
      EXISTS (
        SELECT 1
        FROM aceites_privacidade AS aceite
        WHERE aceite.contato_id = contato.id
          AND aceite.aceito = TRUE
      ) AS aceite_privacidade
    FROM contatos AS contato
    LEFT JOIN origens AS origem ON origem.id = contato.origem_id
    ${filtrosSql.clausulaWhere}
    ORDER BY ${ordem}
    LIMIT $${posicaoLimite}
    OFFSET $${posicaoDeslocamento}
  `;

  const resultado = await banco.query(consulta, valores);

  return resultado.rows;
}

async function contar(filtros) {
  const filtrosSql = construirFiltros(filtros);
  const consulta = `
    SELECT COUNT(*)::integer AS total
    FROM contatos AS contato
    LEFT JOIN origens AS origem ON origem.id = contato.origem_id
    ${filtrosSql.clausulaWhere}
  `;

  const resultado = await banco.query(consulta, filtrosSql.valores);

  return resultado.rows[0].total;
}

async function buscarDetalhes(id) {
  const resultados = await Promise.all([
    banco.query(
      `
        SELECT
          contato.*,
          COALESCE(origem.nome, contato.origem_atual) AS origem_nome,
          origem.slug AS origem_slug,
          origem.tipo AS origem_tipo
        FROM contatos AS contato
        LEFT JOIN origens AS origem ON origem.id = contato.origem_id
        WHERE contato.id = $1
      `,
      [id]
    ),
    banco.query(
      `
        SELECT
          consentimento.id,
          consentimento.tipo,
          consentimento.resposta,
          consentimento.estado,
          consentimento.texto_apresentado,
          consentimento.versao_texto,
          consentimento.canal,
          consentimento.origem_registro,
          consentimento.ativo,
          consentimento.criado_em,
          consentimento.revogado_em,
          origem.nome AS origem_nome
        FROM consentimentos AS consentimento
        LEFT JOIN origens AS origem ON origem.id = consentimento.origem_id
        WHERE consentimento.contato_id = $1
        ORDER BY consentimento.criado_em DESC, consentimento.id DESC
      `,
      [id]
    ),
    banco.query(
      `
        SELECT
          aceite.id,
          aceite.aceito,
          aceite.texto_apresentado,
          aceite.versao_texto,
          aceite.canal,
          aceite.criado_em,
          origem.nome AS origem_nome
        FROM aceites_privacidade AS aceite
        LEFT JOIN origens AS origem ON origem.id = aceite.origem_id
        WHERE aceite.contato_id = $1
        ORDER BY aceite.criado_em DESC, aceite.id DESC
      `,
      [id]
    ),
    banco.query(
      `
        SELECT
          historico.id,
          historico.tipo_evento,
          historico.dados_anteriores,
          historico.dados_novos,
          historico.criado_em,
          origem.nome AS origem_nome,
          usuario.nome AS usuario_nome
        FROM historico_contatos AS historico
        LEFT JOIN origens AS origem ON origem.id = historico.origem_id
        LEFT JOIN usuarios AS usuario ON usuario.id = historico.registrado_por_usuario_id
        WHERE historico.contato_id = $1
        ORDER BY historico.criado_em DESC, historico.id DESC
      `,
      [id]
    )
  ]);

  if (!resultados[0].rows[0]) {
    return null;
  }

  return {
    contato: resultados[0].rows[0],
    consentimentos: resultados[1].rows,
    aceitesPrivacidade: resultados[2].rows,
    historico: resultados[3].rows
  };
}

module.exports = {
  salvarCadastroPublico,
  salvarCadastroManual,
  listar,
  contar,
  buscarDetalhes
};
