require('dotenv').config({ quiet: true });

const jwt = require('jsonwebtoken');
const aplicacao = require('../src/app');
const banco = require('../src/config/banco');
const contatoModel = require('../src/modules/contatos/contatoModel');
const textosConsentimento = require('../src/config/textosConsentimento');

let servidor;
const contatosCriados = [];

function afirmar(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

function registrarContatoParaLimpeza(id) {
  if (id !== undefined && id !== null) {
    contatosCriados.push(String(id));
  }
}

async function requisitar(caminho, opcoesRecebidas) {
  const opcoes = opcoesRecebidas || {};
  const endereco = 'http://127.0.0.1:' + servidor.address().port + caminho;
  const resposta = await fetch(endereco, opcoes);
  const corpo = await resposta.json();

  return {
    status: resposta.status,
    corpo
  };
}

async function cadastrar(dados) {
  return requisitar('/api/publico/contatos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dados)
  });
}

function criarDadosBase(telefone) {
  return {
    nome: 'Teste automatizado de consentimentos',
    telefone,
    bairro: 'Vila Kennedy',
    problema: 'Saúde'
  };
}

async function verificarHistorico(contatoId, respostasEsperadas) {
  const resultado = await banco.query(
    `
      SELECT tipo, resposta, texto_apresentado, versao_texto, canal,
             origem_registro, ativo
      FROM consentimentos
      WHERE contato_id = $1
      ORDER BY tipo
    `,
    [contatoId]
  );

  afirmar(resultado.rows.length === respostasEsperadas.length, 'Quantidade de históricos incorreta.');

  respostasEsperadas.forEach(function (esperado) {
    const encontrado = resultado.rows.find(function (historico) {
      return historico.tipo === esperado.tipo;
    });

    afirmar(encontrado, 'Histórico ausente para ' + esperado.tipo + '.');
    afirmar(encontrado.resposta === esperado.resposta, 'Resposta histórica incorreta.');
    afirmar(encontrado.versao_texto === esperado.versao, 'Versão histórica incorreta.');
    afirmar(encontrado.texto_apresentado === esperado.texto, 'Texto histórico incorreto.');
    afirmar(encontrado.canal === 'formulario_publico', 'Canal histórico incorreto.');
    afirmar(encontrado.origem_registro === 'resposta_expressa', 'Origem histórica incorreta.');
    afirmar(encontrado.ativo === true, 'Histórico deveria estar ativo.');
  });
}

async function criarContatoImportado(telefoneNormalizado) {
  const resultado = await banco.query(
    `
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
        excluido_logicamente
      )
      VALUES (
        'Teste importado sem consentimento',
        $1,
        $1,
        'Vila Kennedy',
        'Saúde',
        TRUE,
        FALSE,
        CURRENT_TIMESTAMP,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        'Importação teste automatizado',
        'pendente',
        TRUE,
        FALSE
      )
      RETURNING id
    `,
    [telefoneNormalizado]
  );

  registrarContatoParaLimpeza(resultado.rows[0].id);

  return resultado.rows[0].id;
}

async function testarRollback(telefoneNormalizado) {
  let erroEncontrado = false;

  try {
    await contatoModel.criar({
      nome: 'Teste de rollback de consentimento',
      telefone: telefoneNormalizado,
      telefoneNormalizado,
      bairro: 'Vila Kennedy',
      problema: 'Saúde',
      consentimentoTratamentoDados: true,
      consentimentoWhatsapp: true,
      consentimentoLigacoes: false,
      bloqueadoParaMensagens: false,
      origemAtual: 'Teste automatizado',
      statusContato: 'ativo',
      historicosConsentimento: [
        {
          tipo: 'tipo_invalido',
          resposta: true,
          textoApresentado: 'Teste inválido',
          versaoTexto: 'teste_invalido',
          canal: 'formulario_publico',
          origemRegistro: 'resposta_expressa',
          registradoPorUsuarioId: null
        }
      ]
    });
  } catch (erro) {
    erroEncontrado = true;
  }

  afirmar(erroEncontrado, 'A falha de histórico deveria interromper a transação.');

  const resultado = await banco.query(
    'SELECT COUNT(*)::integer AS total FROM contatos WHERE telefone_normalizado = $1',
    [telefoneNormalizado]
  );

  afirmar(resultado.rows[0].total === 0, 'O contato da transação com falha não foi revertido.');
}

async function esperarFalhaDeConstraint(consulta, valores, codigoEsperado) {
  const cliente = await banco.connect();
  let codigoRecebido = '';

  try {
    await cliente.query('BEGIN');
    await cliente.query(consulta, valores);
  } catch (erro) {
    codigoRecebido = erro.code;
  } finally {
    await cliente.query('ROLLBACK');
    cliente.release();
  }

  afirmar(codigoRecebido === codigoEsperado, 'Constraint não retornou o código esperado.');
}

async function limparDadosDeTeste() {
  if (contatosCriados.length === 0) {
    return;
  }

  const cliente = await banco.connect();

  try {
    await cliente.query('BEGIN');
    await cliente.query(
      'DELETE FROM consentimentos WHERE contato_id = ANY($1::bigint[])',
      [contatosCriados]
    );
    await cliente.query(
      'DELETE FROM contatos WHERE id = ANY($1::bigint[])',
      [contatosCriados]
    );
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

async function executar() {
  const segredoJwt = process.env.JWT_SECRET || process.env.JWT_SEGREDO;
  const sufixo = String(Date.now()).slice(-7);
  const telefoneSim = '2191' + sufixo;
  const telefoneNao = '2192' + sufixo;
  const telefoneLegado = '2193' + sufixo;
  const telefoneImportado = '2194' + sufixo;
  const telefoneRollback = '2195' + sufixo;
  let resposta;
  let contatoSim;
  let contatoNao;
  let contatoLegado;
  let contatoImportado;
  let token;

  afirmar(segredoJwt, 'JWT_SECRET ou JWT_SEGREDO não configurado.');

  await new Promise(function (resolver, rejeitar) {
    servidor = aplicacao.listen(0, '127.0.0.1', resolver);
    servidor.on('error', rejeitar);
  });

  resposta = await requisitar('/api/teste');
  afirmar(resposta.status === 200, 'Rota de teste ou conexão PostgreSQL falhou.');

  resposta = await requisitar('/api/admin/contatos');
  afirmar(resposta.status === 401, 'Listagem sem token deveria retornar 401.');

  resposta = await requisitar('/api/rota-inexistente');
  afirmar(resposta.status === 404, 'Rota inexistente deveria retornar 404.');
  console.log('PASS inicialização, PostgreSQL, autenticação obrigatória e rota inexistente');

  resposta = await cadastrar(Object.assign(criarDadosBase(telefoneSim), {
    consentimentoTratamentoDados: true,
    consentimentoWhatsapp: true,
    consentimentoLigacoes: true
  }));
  afirmar(resposta.status === 201, 'Cadastro com todos os consentimentos true falhou.');
  contatoSim = resposta.corpo.contato;
  registrarContatoParaLimpeza(contatoSim.id);
  afirmar(contatoSim.consentimentoTratamentoDados === true, 'Tratamento true não retornado.');
  afirmar(contatoSim.consentimentoWhatsapp === true, 'WhatsApp true não retornado.');
  afirmar(contatoSim.consentimentoLigacoes === true, 'Ligações true não retornado.');
  afirmar(contatoSim.bloqueadoParaMensagens === false, 'Contato autorizado não deveria estar bloqueado.');
  await verificarHistorico(contatoSim.id, [
    {
      tipo: 'tratamento_dados',
      resposta: true,
      texto: textosConsentimento.textoTratamentoDados,
      versao: textosConsentimento.versaoTratamentoDados
    },
    {
      tipo: 'mensagens_whatsapp',
      resposta: true,
      texto: textosConsentimento.textoWhatsapp,
      versao: textosConsentimento.versaoWhatsapp
    },
    {
      tipo: 'ligacoes',
      resposta: true,
      texto: textosConsentimento.textoLigacoes,
      versao: textosConsentimento.versaoLigacoes
    }
  ]);
  console.log('PASS cadastro true/true/true e histórico versionado');

  resposta = await cadastrar(Object.assign(criarDadosBase(telefoneNao), {
    consentimentoTratamentoDados: true,
    consentimentoWhatsapp: false,
    consentimentoLigacoes: false
  }));
  afirmar(resposta.status === 201, 'Cadastro com consentimentos opcionais false falhou.');
  contatoNao = resposta.corpo.contato;
  registrarContatoParaLimpeza(contatoNao.id);
  afirmar(contatoNao.consentimentoWhatsapp === false, 'WhatsApp false não retornado.');
  afirmar(contatoNao.consentimentoLigacoes === false, 'Ligações false não retornado.');
  afirmar(contatoNao.bloqueadoParaMensagens === true, 'Contato sem WhatsApp deveria estar bloqueado.');
  await verificarHistorico(contatoNao.id, [
    {
      tipo: 'tratamento_dados',
      resposta: true,
      texto: textosConsentimento.textoTratamentoDados,
      versao: textosConsentimento.versaoTratamentoDados
    },
    {
      tipo: 'mensagens_whatsapp',
      resposta: false,
      texto: textosConsentimento.textoWhatsapp,
      versao: textosConsentimento.versaoWhatsapp
    },
    {
      tipo: 'ligacoes',
      resposta: false,
      texto: textosConsentimento.textoLigacoes,
      versao: textosConsentimento.versaoLigacoes
    }
  ]);
  console.log('PASS cadastro true/false/false e bloqueio');

  resposta = await cadastrar(Object.assign(criarDadosBase(telefoneLegado), {
    consentimentoArmazenamento: true,
    consentimentoMensagens: false
  }));
  afirmar(resposta.status === 201, 'Contrato legado deveria continuar aceito.');
  contatoLegado = resposta.corpo.contato;
  registrarContatoParaLimpeza(contatoLegado.id);
  afirmar(contatoLegado.consentimentoLigacoes === null, 'Ligações omitidas deveriam ser não informadas.');
  const historicosLegados = await banco.query(
    'SELECT COUNT(*)::integer AS total FROM consentimentos WHERE contato_id = $1',
    [contatoLegado.id]
  );
  afirmar(historicosLegados.rows[0].total === 2, 'Cliente legado deveria gerar dois históricos.');
  console.log('PASS aliases antigos e ligações não informadas');

  resposta = await cadastrar(Object.assign(criarDadosBase('2196' + sufixo), {
    consentimentoTratamentoDados: false,
    consentimentoWhatsapp: false,
    consentimentoLigacoes: false
  }));
  afirmar(resposta.status === 400, 'Tratamento false deveria retornar 400.');

  resposta = await cadastrar(Object.assign(criarDadosBase('2197' + sufixo), {
    consentimentoWhatsapp: false,
    consentimentoLigacoes: false
  }));
  afirmar(resposta.status === 400, 'Tratamento ausente deveria retornar 400.');

  resposta = await cadastrar(Object.assign(criarDadosBase('2198' + sufixo), {
    consentimentoTratamentoDados: true,
    consentimentoWhatsapp: 'false',
    consentimentoLigacoes: false
  }));
  afirmar(resposta.status === 400, 'String em WhatsApp deveria retornar 400.');

  resposta = await cadastrar(Object.assign(criarDadosBase('2199' + sufixo), {
    consentimentoTratamentoDados: true,
    consentimentoWhatsapp: false,
    consentimentoLigacoes: 'true'
  }));
  afirmar(resposta.status === 400, 'String em ligações deveria retornar 400.');
  console.log('PASS obrigatoriedade e tipos inválidos');

  resposta = await cadastrar(Object.assign(criarDadosBase(telefoneSim), {
    consentimentoTratamentoDados: true,
    consentimentoWhatsapp: false,
    consentimentoLigacoes: false
  }));
  afirmar(resposta.status === 409, 'Telefone duplicado deveria retornar 409.');
  afirmar(
    resposta.corpo.mensagem === 'Este WhatsApp já está cadastrado em nossa ação.',
    'Mensagem de duplicidade incorreta.'
  );
  console.log('PASS duplicidade sem sobrescrever consentimentos');

  await testarRollback(telefoneRollback);
  console.log('PASS rollback quando o histórico falha');

  contatoImportado = await criarContatoImportado(telefoneImportado);
  console.log('PASS contato importado com consentimentos não informados');

  await esperarFalhaDeConstraint(
    `
      INSERT INTO consentimentos (
        contato_id, tipo, resposta, texto_apresentado, versao_texto,
        canal, origem_registro, ativo
      )
      VALUES ($1, 'tratamento_dados', NULL, 'Teste', 'teste',
              'outro', 'atualizacao', TRUE)
    `,
    [contatoImportado],
    '23502'
  );

  await esperarFalhaDeConstraint(
    `
      INSERT INTO consentimentos (
        contato_id, tipo, resposta, texto_apresentado, versao_texto,
        canal, origem_registro, ativo
      )
      VALUES ($1, 'tratamento_dados', TRUE, 'Teste', 'teste',
              'canal_invalido', 'atualizacao', TRUE)
    `,
    [contatoImportado],
    '23514'
  );

  await esperarFalhaDeConstraint(
    `
      INSERT INTO consentimentos (
        contato_id, tipo, resposta, texto_apresentado, versao_texto,
        canal, origem_registro, ativo
      )
      VALUES ($1, 'tratamento_dados', TRUE, 'Teste', 'teste',
              'outro', 'atualizacao', TRUE),
             ($1, 'tratamento_dados', FALSE, 'Teste 2', 'teste_2',
              'outro', 'atualizacao', TRUE)
    `,
    [contatoImportado],
    '23505'
  );
  console.log('PASS constraints de resposta, canal e registro ativo único');

  token = jwt.sign(
    { id: 'teste-consentimentos', email: 'teste@invalid.local' },
    segredoJwt,
    { expiresIn: '10m' }
  );

  resposta = await requisitar('/api/admin/contatos?limite=100', {
    headers: { Authorization: 'Bearer ' + token }
  });
  afirmar(resposta.status === 200, 'Listagem administrativa falhou.');
  const itemSim = resposta.corpo.contatos.find(function (contato) {
    return String(contato.id) === String(contatoSim.id);
  });
  const chavesInternas = JSON.stringify(itemSim);
  afirmar(itemSim, 'Contato de teste não apareceu na listagem.');
  afirmar(itemSim.consentimentoTratamentoDados === true, 'CamelCase de tratamento ausente.');
  afirmar(!chavesInternas.includes('telefone_normalizado'), 'Telefone normalizado foi exposto.');
  afirmar(!chavesInternas.includes('consentimento_whatsapp'), 'Snake case foi exposto.');
  console.log('PASS listagem camelCase sem campos internos');

  const filtros = [
    { caminho: '?consentimentoWhatsapp=true&limite=100', campo: 'consentimentoWhatsapp', valor: true },
    { caminho: '?consentimentoWhatsapp=false&limite=100', campo: 'consentimentoWhatsapp', valor: false },
    { caminho: '?consentimentoWhatsapp=null&limite=100', campo: 'consentimentoWhatsapp', valor: null },
    { caminho: '?consentimentoLigacoes=true&limite=100', campo: 'consentimentoLigacoes', valor: true },
    { caminho: '?consentimentoLigacoes=false&limite=100', campo: 'consentimentoLigacoes', valor: false },
    { caminho: '?consentimentoLigacoes=null&limite=100', campo: 'consentimentoLigacoes', valor: null }
  ];
  let indice;

  for (indice = 0; indice < filtros.length; indice += 1) {
    resposta = await requisitar('/api/admin/contatos' + filtros[indice].caminho, {
      headers: { Authorization: 'Bearer ' + token }
    });
    afirmar(resposta.status === 200, 'Filtro de consentimento falhou.');
    afirmar(resposta.corpo.contatos.length > 0, 'Filtro deveria encontrar ao menos um registro.');
    afirmar(
      resposta.corpo.contatos.every(function (contato) {
        return contato[filtros[indice].campo] === filtros[indice].valor;
      }),
      'Filtro misturou estados de consentimento.'
    );
  }
  console.log('PASS filtros true, false e null separados');

  resposta = await requisitar(
    '/api/admin/contatos?nome=Teste&telefone=' + telefoneSim +
      '&bairro=Vila&problema=Saúde&origem=Formulário&status=ativo&pagina=1&limite=5',
    { headers: { Authorization: 'Bearer ' + token } }
  );
  afirmar(resposta.status === 200, 'Filtros combinados falharam.');
  afirmar(resposta.corpo.paginacao.paginaAtual === 1, 'Página incorreta.');
  afirmar(resposta.corpo.paginacao.limite === 5, 'Limite incorreto.');
  afirmar(resposta.corpo.paginacao.totalRegistros >= 1, 'COUNT com filtros incorreto.');
  console.log('PASS filtros existentes, novos filtros e paginação');
}

async function finalizar() {
  let erroLimpeza;
  let estadoFinal;

  try {
    await limparDadosDeTeste();

    const resultados = await Promise.all([
      banco.query('SELECT COUNT(*)::integer AS total FROM contatos'),
      banco.query('SELECT COUNT(*)::integer AS total FROM usuarios'),
      banco.query('SELECT COUNT(*)::integer AS total FROM consentimentos'),
      banco.query(
        `
          SELECT COUNT(*)::integer AS total
          FROM consentimentos
          WHERE origem_registro = 'migracao_legado'
        `
      ),
      banco.query(
        `
          SELECT COUNT(*)::integer AS total
          FROM consentimentos
          WHERE origem_registro = 'migracao_legado'
            AND versao_texto = 'legado_v1'
        `
      )
    ]);

    estadoFinal = {
      contatos: resultados[0].rows[0].total,
      usuarios: resultados[1].rows[0].total,
      consentimentos: resultados[2].rows[0].total,
      historicosLegados: resultados[3].rows[0].total,
      historicosLegadoV1: resultados[4].rows[0].total
    };
  } catch (erro) {
    erroLimpeza = erro;
  }

  if (servidor) {
    await new Promise(function (resolver) {
      servidor.close(resolver);
    });
  }

  await banco.end();

  if (erroLimpeza) {
    throw erroLimpeza;
  }

  console.log('Estado do banco após a limpeza: ' + JSON.stringify(estadoFinal));
}

executar()
  .then(function () {
    console.log('Todos os testes de consentimentos passaram.');
  })
  .catch(function (erro) {
    console.error(erro.stack || erro.message);
    process.exitCode = 1;
  })
  .finally(function () {
    return finalizar().catch(function (erro) {
      console.error('Falha ao limpar dados de teste: ' + erro.message);
      process.exitCode = 1;
    });
  });
