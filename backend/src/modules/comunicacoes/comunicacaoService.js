const comunicacaoModel = require('./comunicacaoModel');
const criarAppError = require('../../utils/AppError');
const normalizarTelefone = require('../../utils/normalizarTelefone');

const STATUS_ATENDIMENTO = [
  'aguardando_resposta',
  'respondido',
  'sem_resposta',
  'recusou_atendimento',
  'numero_invalido',
  'concluido'
];
const STATUS_FILTRO = ['enviada'].concat(STATUS_ATENDIMENTO);
const CAMPOS_TEMPLATE = ['nome', 'evento', 'data', 'horario', 'local', 'link'];

function validarTexto(valor, nome, maximo, opcional) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (opcional) {
      return null;
    }
    throw criarAppError(nome + ' é obrigatório.', 400);
  }

  const texto = String(valor).trim();
  if (texto.length > maximo) {
    throw criarAppError(nome + ' excede o limite permitido.', 400);
  }
  return texto;
}

function tratarFiltroPossivelmenteNaoInformado(valor, nome) {
  const texto = validarTexto(valor, nome, 150, true);

  if (!texto) {
    return null;
  }

  const textoComparacao = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_');

  return textoComparacao === 'nao_informado' ? 'nao_informado' : texto;
}

function validarId(valor, nome, opcional) {
  if ((valor === undefined || valor === null || valor === '') && opcional) {
    return null;
  }

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw criarAppError(nome + ' é inválido.', 400);
  }
  return numero;
}

function validarBooleano(valor) {
  return valor !== false;
}

function transformarNumero(item) {
  return {
    id: item.id,
    nome: item.nome,
    numero: item.numero,
    responsavel: item.responsavel,
    observacao: item.observacao,
    ativo: item.ativo
  };
}

function validarNumero(dados) {
  const numero = validarTexto(dados.numero, 'Número', 30, false);
  const numeroNormalizado = normalizarTelefone(numero);

  if (numeroNormalizado.length < 10 || numeroNormalizado.length > 15) {
    throw criarAppError('Número de WhatsApp inválido.', 400);
  }

  return {
    nome: validarTexto(dados.nome, 'Nome do canal', 100, false),
    numero,
    numeroNormalizado,
    responsavel: validarTexto(dados.responsavel, 'Responsável', 150, false),
    observacao: validarTexto(dados.observacao, 'Observação', 2000, true),
    ativo: validarBooleano(dados.ativo)
  };
}

async function listarNumeros() {
  return (await comunicacaoModel.listarNumeros()).map(transformarNumero);
}

async function salvarNumero(idRecebido, dadosRecebidos, usuario) {
  let item;

  try {
    item = await comunicacaoModel.salvarNumero(
      idRecebido ? validarId(idRecebido, 'Identificador', false) : null,
      validarNumero(dadosRecebidos || {}),
      usuario.id
    );
  } catch (erro) {
    if (erro.code === '23505') {
      throw criarAppError(
        'Este número de WhatsApp já está cadastrado. Selecione o canal existente para editá-lo.',
        409
      );
    }

    throw erro;
  }

  if (!item) {
    throw criarAppError('Número não encontrado.', 404);
  }
  return transformarNumero(item);
}

async function excluirNumero(idRecebido) {
  const id = validarId(idRecebido, 'Número de WhatsApp', false);
  const totalComunicacoes = await comunicacaoModel.contarComunicacoesDoNumero(id);

  if (totalComunicacoes > 0) {
    throw criarAppError(
      'Este número possui histórico de atendimento e não pode ser excluído. Desative-o para preservar a auditoria.',
      409
    );
  }

  const numeroExcluido = await comunicacaoModel.excluirNumero(id);

  if (!numeroExcluido) {
    throw criarAppError('Número não encontrado.', 404);
  }
}

function validarModelo(dados) {
  const corpo = validarTexto(dados.texto, 'Conteúdo', 5000, false);
  const expressao = /{{\s*([^}]+)\s*}}/g;
  let encontrado = expressao.exec(corpo);

  while (encontrado !== null) {
    if (!CAMPOS_TEMPLATE.includes(encontrado[1].trim())) {
      throw criarAppError('Campo substituível não permitido: ' + encontrado[1].trim() + '.', 400);
    }
    encontrado = expressao.exec(corpo);
  }

  return {
    nome: validarTexto(dados.nome, 'Nome', 150, false),
    categoria: validarTexto(dados.categoria, 'Categoria', 100, false),
    texto: corpo,
    eventoId: validarId(dados.eventoId, 'Evento', true),
    ativo: validarBooleano(dados.ativo)
  };
}

async function listarModelos() {
  return comunicacaoModel.listarModelos();
}

async function salvarModelo(idRecebido, dadosRecebidos, usuario) {
  const item = await comunicacaoModel.salvarModelo(
    idRecebido ? validarId(idRecebido, 'Identificador', false) : null,
    validarModelo(dadosRecebidos || {}),
    usuario.id
  );

  if (!item) {
    throw criarAppError('Template não encontrado.', 404);
  }
  return item;
}

function validarCampanha(dados) {
  return {
    nome: validarTexto(dados.nome, 'Nome', 150, false),
    descricao: validarTexto(dados.descricao, 'Descrição', 3000, true),
    ativo: validarBooleano(dados.ativo)
  };
}

async function listarCampanhas() {
  return comunicacaoModel.listarCampanhas();
}

async function salvarCampanha(idRecebido, dadosRecebidos, usuario) {
  const item = await comunicacaoModel.salvarCampanha(
    idRecebido ? validarId(idRecebido, 'Identificador', false) : null,
    validarCampanha(dadosRecebidos || {}),
    usuario.id
  );

  if (!item) {
    throw criarAppError('Campanha não encontrada.', 404);
  }
  return item;
}

async function listarOperadores() {
  return comunicacaoModel.listarOperadores();
}

function formatarData(valor, apenasHorario) {
  if (!valor) {
    return '';
  }

  const opcoes = apenasHorario
    ? { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }
    : { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' };

  return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(valor));
}

function preencherTemplate(textoBase, contato, evento) {
  const valores = {
    nome: contato.nome || '',
    evento: evento ? evento.nome : '',
    data: evento ? formatarData(evento.data_inicial, false) : '',
    horario: evento ? formatarData(evento.data_inicial, true) : '',
    local: evento ? evento.local_evento || '' : '',
    link: evento ? evento.link_evento || '' : ''
  };

  return textoBase.replace(
    /{{\s*(nome|evento|data|horario|local|link)\s*}}/g,
    function substituir(correspondencia, campo) {
      return valores[campo];
    }
  );
}

async function preparar(dadosRecebidos, usuario) {
  const dados = dadosRecebidos || {};

  if (!Array.isArray(dados.contatoIds) || dados.contatoIds.length < 1 ||
      dados.contatoIds.length > 500) {
    throw criarAppError('Selecione entre 1 e 500 contatos.', 400);
  }

  const contatoIds = Array.from(new Set(dados.contatoIds.map(function transformar(valor) {
    return validarId(valor, 'Contato', false);
  })));
  const eventoId = validarId(dados.eventoId, 'Evento', true);
  const modeloId = validarId(dados.modeloId, 'Texto pronto', false);
  const campanhaId = validarId(dados.campanhaId, 'Campanha', true);
  const numeroId = validarId(dados.numeroId, 'WhatsApp da equipe', false);
  const contexto = await comunicacaoModel.buscarContexto(
    contatoIds, eventoId, modeloId, numeroId, campanhaId
  );

  if (contexto.contatos.length !== contatoIds.length) {
    throw criarAppError('Um ou mais contatos não foram encontrados.', 404);
  }
  if (eventoId && !contexto.evento) {
    throw criarAppError('Evento não encontrado.', 404);
  }
  if (!contexto.modelo) {
    throw criarAppError('Texto pronto ativo não encontrado.', 404);
  }
  if (campanhaId && !contexto.campanha) {
    throw criarAppError('Campanha ativa não encontrada.', 404);
  }
  if (!contexto.numero) {
    throw criarAppError('WhatsApp da equipe ativo não encontrado.', 404);
  }

  const recebimentos = await comunicacaoModel.buscarRecebimentosDaCampanha(
    contatoIds, campanhaId
  );
  if (recebimentos.length > 0 && dados.confirmarReenvio !== true) {
    return {
      requerConfirmacao: true,
      contatosJaReceberam: recebimentos
    };
  }

  const motivoReenvio = recebimentos.length > 0
    ? validarTexto(dados.motivoReenvio, 'Motivo do reenvio', 1000, false)
    : null;
  const textoBase = contexto.modelo.texto;
  const contatosComReenvio = new Set(recebimentos.map(function obterId(item) {
    return Number(item.contato_id);
  }));

  const contatos = contexto.contatos.map(function transformar(contato) {
    if (contato.bloqueado_para_mensagens) {
      throw criarAppError('O contato ' + contato.id + ' está bloqueado para mensagens.', 409);
    }

    return {
      contatoId: contato.id,
      texto: preencherTemplate(textoBase, contato, contexto.evento),
      telefoneNormalizado: contato.telefone_normalizado,
      motivoReenvio: contatosComReenvio.has(Number(contato.id))
        ? motivoReenvio
        : null
    };
  });

  const registros = await comunicacaoModel.preparar({
    contatos,
    eventoId,
    modeloId,
    campanhaId,
    numeroId,
    observacoes: validarTexto(dados.observacoes, 'Observações', 3000, true),
    motivoReenvio
  }, usuario.id);

  return {
    requerConfirmacao: false,
    comunicacoes: registros.map(function adicionarLink(item, indice) {
      return Object.assign({}, item, {
        linkWhatsapp: 'https://wa.me/' + contatos[indice].telefoneNormalizado +
          '?text=' + encodeURIComponent(contatos[indice].texto)
      });
    })
  };
}

async function confirmarEnvio(idRecebido, dadosRecebidos, usuario) {
  const observacoes = validarTexto(
    (dadosRecebidos || {}).observacoes,
    'Observações',
    3000,
    true
  );
  const item = await comunicacaoModel.confirmarEnvio(
    validarId(idRecebido, 'Comunicação', false),
    observacoes,
    usuario.id
  );

  if (!item) {
    throw criarAppError('Comunicação não encontrada.', 404);
  }
  if (item.jaConfirmada) {
    throw criarAppError('Este envio já foi confirmado anteriormente.', 409);
  }
  return item;
}

function validarFiltros(filtros) {
  const dados = filtros || {};
  return {
    eventoId: validarId(dados.eventoId, 'Evento', true),
    contatoId: validarId(dados.contatoId, 'Contato', true),
    status: dados.status || null,
    numeroId: validarId(dados.numeroId, 'WhatsApp', true),
    operadorId: validarId(dados.operadorId, 'Operador', true),
    modeloId: validarId(dados.modeloId, 'Template', true),
    campanhaId: validarId(dados.campanhaId, 'Campanha', true),
    bairro: tratarFiltroPossivelmenteNaoInformado(dados.bairro, 'Bairro'),
    problema: tratarFiltroPossivelmenteNaoInformado(dados.problema, 'Problema'),
    ultimoContatoInicio: validarTexto(dados.ultimoContatoInicio, 'Data inicial', 10, true),
    ultimoContatoFim: validarTexto(dados.ultimoContatoFim, 'Data final', 10, true)
  };
}

async function listar(filtros) {
  return comunicacaoModel.listar(validarFiltros(filtros));
}

async function listarContatos(filtrosRecebidos) {
  const filtros = filtrosRecebidos || {};
  const situacoes = ['nunca_enviado'].concat(STATUS_FILTRO);

  if (filtros.situacao && !situacoes.includes(filtros.situacao)) {
    throw criarAppError('Situação de atendimento inválida.', 400);
  }

  return comunicacaoModel.listarContatos({
    busca: validarTexto(filtros.busca, 'Busca', 150, true),
    bairro: tratarFiltroPossivelmenteNaoInformado(filtros.bairro, 'Bairro'),
    problema: tratarFiltroPossivelmenteNaoInformado(filtros.problema, 'Problema'),
    eventoId: validarId(filtros.eventoId, 'Evento', true),
    consentimento: filtros.consentimento || null,
    situacao: filtros.situacao || null,
    cadastroIncompleto: filtros.cadastroIncompleto === 'true' ||
      filtros.cadastroIncompleto === true,
    campanhaNaoRecebidaId: validarId(
      filtros.campanhaNaoRecebidaId,
      'Campanha',
      true
    )
  });
}

async function atualizar(idRecebido, dadosRecebidos, usuario) {
  const dados = dadosRecebidos || {};
  if (!STATUS_ATENDIMENTO.includes(dados.status)) {
    throw criarAppError('Status de atendimento inválido.', 400);
  }

  const item = await comunicacaoModel.atualizar(
    validarId(idRecebido, 'Comunicação', false),
    {
      status: dados.status,
      observacoes: validarTexto(dados.observacoes, 'Observações', 3000, true),
      proximaAcao: validarTexto(dados.proximaAcao, 'Próxima ação', 1000, true)
    },
    usuario.id
  );

  if (!item) {
    throw criarAppError('Comunicação não encontrada.', 404);
  }
  return item;
}

async function listarHistorico(idRecebido) {
  return comunicacaoModel.listarHistorico(
    validarId(idRecebido, 'Comunicação', false)
  );
}

module.exports = {
  atualizar,
  confirmarEnvio,
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
