const contatoModel = require('./contatoModel');
const criarAppError = require('../../utils/AppError');
const normalizarTelefone = require('../../utils/normalizarTelefone');
const categoriasProblema = require('../../config/categoriasProblema');
const bairroService = require('../bairros/bairroService');

function validarCampoTexto(valor, nomeCampo, tamanhoMinimo, tamanhoMaximo) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw criarAppError(nomeCampo + ' é obrigatório.', 400);
  }

  const textoTratado = valor.trim();

  if (textoTratado.length < tamanhoMinimo) {
    throw criarAppError(
      nomeCampo + ' deve ter pelo menos ' + tamanhoMinimo + ' caracteres.',
      400
    );
  }

  if (textoTratado.length > tamanhoMaximo) {
    throw criarAppError(
      nomeCampo + ' deve ter no máximo ' + tamanhoMaximo + ' caracteres.',
      400
    );
  }

  return textoTratado;
}

function obterPrimeiroCampoInformado(dadosRecebidos, nomesCampos) {
  let indice;

  for (indice = 0; indice < nomesCampos.length; indice += 1) {
    if (Object.prototype.hasOwnProperty.call(dadosRecebidos, nomesCampos[indice])) {
      return dadosRecebidos[nomesCampos[indice]];
    }
  }

  return undefined;
}

function validarBooleano(valor, nomeCampo, obrigatorio) {
  if (valor === undefined) {
    if (obrigatorio) {
      throw criarAppError(nomeCampo + ' é obrigatório.', 400);
    }

    return false;
  }

  if (typeof valor !== 'boolean') {
    throw criarAppError(nomeCampo + ' deve ser verdadeiro ou falso.', 400);
  }

  return valor;
}

function validarIdade(valor) {
  if (!Number.isInteger(valor) || valor < 16 || valor > 120) {
    throw criarAppError('Idade deve ser um número inteiro entre 16 e 120.', 400);
  }

  return valor;
}

function validarCampoOpcional(valor, nomeCampo, tamanhoMaximo) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  if (typeof valor !== 'string') {
    throw criarAppError(nomeCampo + ' é inválido.', 400);
  }

  const textoTratado = valor.trim();

  if (!textoTratado) {
    return null;
  }

  if (textoTratado.length > tamanhoMaximo) {
    throw criarAppError(
      nomeCampo + ' deve ter no máximo ' + tamanhoMaximo + ' caracteres.',
      400
    );
  }

  return textoTratado;
}

function validarParticipacaoEleitoral(valor) {
  const valoresValidos = ['sim', 'nao', 'prefiro_nao_informar'];

  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  if (typeof valor !== 'string' || !valoresValidos.includes(valor)) {
    throw criarAppError('Participação na última eleição é inválida.', 400);
  }

  return valor;
}

async function validarDadosDoContato(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('Os dados do contato são obrigatórios.', 400);
  }

  const nome = validarCampoTexto(dadosRecebidos.nome, 'Nome', 2, 150);
  const telefone = validarCampoTexto(dadosRecebidos.telefone, 'Telefone', 1, 30);
  const bairroInformado = validarCampoTexto(dadosRecebidos.bairro, 'Bairro', 2, 150);
  const problema = validarCampoTexto(
    dadosRecebidos.problema,
    'Categoria do problema',
    3,
    500
  );
  const aceitePrivacidade = validarBooleano(
    obterPrimeiroCampoInformado(
      dadosRecebidos,
      ['aceitePrivacidade', 'consentimentoTratamentoDados', 'consentimentoArmazenamento']
    ),
    'O aceite do Aviso de Privacidade',
    true
  );
  const autorizacaoMensagens = validarBooleano(
    obterPrimeiroCampoInformado(
      dadosRecebidos,
      ['autorizacaoMensagens', 'consentimentoWhatsapp', 'consentimentoMensagens']
    ),
    'Autorização de mensagens',
    false
  );
  const autorizacaoLigacoes = validarBooleano(
    obterPrimeiroCampoInformado(
      dadosRecebidos,
      ['autorizacaoLigacoes', 'consentimentoLigacoes']
    ),
    'Autorização de ligações',
    false
  );
  const telefoneNormalizado = normalizarTelefone(telefone);
  const bairro = await bairroService.validarBairroAtivo(bairroInformado);

  if (!categoriasProblema.includes(problema)) {
    throw criarAppError('Selecione uma categoria de problema válida.', 400);
  }

  if (aceitePrivacidade !== true) {
    throw criarAppError('O aceite do Aviso de Privacidade é obrigatório.', 400);
  }

  if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 15) {
    throw criarAppError('O telefone informado é inválido.', 400);
  }

  return {
    nome,
    telefone,
    telefoneNormalizado,
    idade: validarIdade(dadosRecebidos.idade),
    bairro,
    problema,
    participouEleicaoAnterior: validarParticipacaoEleitoral(
      dadosRecebidos.participouEleicaoAnterior
    ),
    aceitePrivacidade,
    autorizacaoMensagens,
    autorizacaoLigacoes
  };
}

function transformarContatoParaResposta(contato) {
  return {
    id: contato.id,
    nome: contato.nome,
    telefone: contato.telefone,
    bairro: contato.bairro,
    problema: contato.problema,
    idade: contato.idade,
    descricaoProblema: contato.descricao_problema,
    participouEleicaoAnterior: contato.participou_eleicao_anterior,
    consentimentoArmazenamento: contato.consentimento_tratamento_dados,
    consentimentoMensagens: contato.consentimento_whatsapp,
    consentimentoTratamentoDados: contato.consentimento_tratamento_dados,
    consentimentoWhatsapp: contato.consentimento_whatsapp,
    consentimentoLigacoes: contato.consentimento_ligacoes,
    autorizacaoMensagens: contato.autorizacao_mensagens,
    autorizacaoLigacoes: contato.autorizacao_ligacoes,
    aceitePrivacidade: contato.aceite_privacidade,
    origemAtual: contato.origem_nome || contato.origem_atual,
    statusContato: contato.status_contato,
    bloqueadoParaMensagens: contato.bloqueado_para_mensagens,
    bloqueadoParaLigacoes: contato.bloqueado_para_ligacoes,
    bloqueadoParaCampanhas: contato.bloqueado_para_campanhas,
    exclusaoSolicitadaEm: contato.exclusao_solicitada_em,
    exclusaoSolicitadaPor: contato.exclusao_solicitada_por_usuario_id
      ? {
          id: contato.exclusao_solicitada_por_usuario_id,
          nome: contato.exclusao_solicitada_por_usuario_nome || null
        }
      : null,
    criadoEm: contato.criado_em
  };
}

async function cadastrarContato(dadosRecebidos) {
  const dadosDoContato = await validarDadosDoContato(dadosRecebidos);

  await contatoModel.salvarCadastroPublico(dadosDoContato);
}

async function listarOpcoesFormulario() {
  return {
    bairros: await bairroService.listarNomesAtivos(),
    categoriasProblema: categoriasProblema.slice()
  };
}

function validarEstadoAutorizacao(valor, nomeCampo) {
  const estados = ['nao_informado', 'autorizado', 'recusado'];

  if (valor === undefined || valor === null || valor === '') {
    return 'nao_informado';
  }

  if (typeof valor !== 'string' || !estados.includes(valor)) {
    throw criarAppError(nomeCampo + ' é inválida.', 400);
  }

  return valor;
}

async function validarDadosCadastroManual(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('Os dados do contato são obrigatórios.', 400);
  }

  const telefone = validarCampoTexto(dadosRecebidos.telefone, 'Telefone', 1, 30);
  const telefoneNormalizado = normalizarTelefone(telefone);
  const problema = validarCampoTexto(
    dadosRecebidos.problema,
    'Categoria do problema',
    3,
    500
  );
  const origemId = Number(dadosRecebidos.origemId);
  const bairroInformado = validarCampoTexto(dadosRecebidos.bairro, 'Bairro', 2, 150);
  const bairro = await bairroService.validarBairroAtivo(bairroInformado);

  if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 15) {
    throw criarAppError('O telefone informado é inválido.', 400);
  }

  if (!categoriasProblema.includes(problema)) {
    throw criarAppError('Selecione uma categoria de problema válida.', 400);
  }

  if (!Number.isInteger(origemId) || origemId < 1) {
    throw criarAppError('Origem é obrigatória.', 400);
  }

  return {
    nome: validarCampoTexto(dadosRecebidos.nome, 'Nome', 2, 150),
    telefone,
    telefoneNormalizado,
    bairro,
    idade: validarIdade(dadosRecebidos.idade),
    problema,
    descricaoProblema: validarCampoOpcional(
      dadosRecebidos.descricaoProblema,
      'Descrição do problema',
      1000
    ),
    participouEleicaoAnterior: validarParticipacaoEleitoral(
      dadosRecebidos.participouEleicaoAnterior
    ),
    origemId,
    status: validarCampoTexto(dadosRecebidos.status, 'Status', 2, 50),
    aceitePrivacidade: validarBooleano(
      dadosRecebidos.aceitePrivacidade,
      'Aceite do Aviso de Privacidade',
      false
    ),
    autorizacaoMensagens: validarEstadoAutorizacao(
      dadosRecebidos.autorizacaoMensagens,
      'Autorização de mensagens'
    ),
    autorizacaoLigacoes: validarEstadoAutorizacao(
      dadosRecebidos.autorizacaoLigacoes,
      'Autorização de ligações'
    )
  };
}

async function cadastrarContatoManual(dadosRecebidos, usuario) {
  if (!usuario || !usuario.id) {
    throw criarAppError('Usuário autenticado não identificado.', 401);
  }

  const dados = await validarDadosCadastroManual(dadosRecebidos);

  try {
    return await contatoModel.salvarCadastroManual(dados, usuario.id);
  } catch (erro) {
    if (erro.codigoAplicacao === 'ORIGEM_NAO_ENCONTRADA') {
      throw criarAppError('A origem informada não existe ou está inativa.', 400);
    }

    throw erro;
  }
}

function tratarFiltroTexto(valor, nomeFiltro) {
  if (valor === undefined || valor === null || valor === '') {
    return '';
  }

  if (typeof valor !== 'string') {
    throw criarAppError('O filtro ' + nomeFiltro + ' é inválido.', 400);
  }

  return valor.trim();
}

function tratarFiltroConsentimento(valor, nomeFiltro) {
  if (valor === undefined || valor === '') {
    return undefined;
  }

  if (valor === 'true') {
    return true;
  }

  if (valor === 'false') {
    return false;
  }

  if (valor === 'null') {
    return null;
  }

  throw criarAppError('O filtro ' + nomeFiltro + ' é inválido.', 400);
}

function tratarNumeroPaginacao(valor, valorPadrao, nomeCampo) {
  if (valor === undefined || valor === null || valor === '') {
    return valorPadrao;
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero < 1) {
    throw criarAppError('O campo ' + nomeCampo + ' é inválido.', 400);
  }

  return numero;
}

function tratarIdadeFiltro(valor, nomeCampo) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  const idade = Number(valor);

  if (!Number.isInteger(idade) || idade < 16 || idade > 120) {
    throw criarAppError('O filtro ' + nomeCampo + ' é inválido.', 400);
  }

  return idade;
}

function tratarOpcaoFiltro(valor, nomeCampo, opcoes) {
  if (valor === undefined || valor === null || valor === '') {
    return '';
  }

  if (typeof valor !== 'string' || !opcoes.includes(valor)) {
    throw criarAppError('O filtro ' + nomeCampo + ' é inválido.', 400);
  }

  return valor;
}

function tratarDataFiltro(valor, nomeCampo) {
  if (valor === undefined || valor === null || valor === '') {
    return '';
  }

  const data = typeof valor === 'string'
    ? new Date(valor + 'T00:00:00Z')
    : new Date('invalida');

  if (
    typeof valor !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
    Number.isNaN(data.getTime()) ||
    data.toISOString().slice(0, 10) !== valor
  ) {
    throw criarAppError('O filtro ' + nomeCampo + ' é inválido.', 400);
  }

  return valor;
}

function prepararFiltros(parametrosRecebidos) {
  const nome = tratarFiltroTexto(parametrosRecebidos.nome, 'nome');
  const telefoneRecebido = tratarFiltroTexto(parametrosRecebidos.telefone, 'telefone');
  const bairro = tratarFiltroTexto(parametrosRecebidos.bairro, 'bairro');
  const problema = tratarFiltroTexto(parametrosRecebidos.problema, 'problema');
  const origem = tratarFiltroTexto(parametrosRecebidos.origem, 'origem');
  const status = tratarFiltroTexto(parametrosRecebidos.status, 'status');
  const consentimentoWhatsapp = tratarFiltroConsentimento(
    parametrosRecebidos.consentimentoWhatsapp,
    'consentimentoWhatsapp'
  );
  const consentimentoLigacoes = tratarFiltroConsentimento(
    parametrosRecebidos.consentimentoLigacoes,
    'consentimentoLigacoes'
  );
  const idadeMinima = tratarIdadeFiltro(parametrosRecebidos.idadeMinima, 'idadeMinima');
  const idadeMaxima = tratarIdadeFiltro(parametrosRecebidos.idadeMaxima, 'idadeMaxima');
  const participouEleicaoAnterior = tratarOpcaoFiltro(
    parametrosRecebidos.participouEleicaoAnterior,
    'participouEleicaoAnterior',
    ['sim', 'nao', 'prefiro_nao_informar']
  );
  const autorizacaoMensagens = tratarOpcaoFiltro(
    parametrosRecebidos.autorizacaoMensagens,
    'autorizacaoMensagens',
    ['nao_informado', 'autorizado', 'recusado', 'revogado']
  );
  const autorizacaoLigacoes = tratarOpcaoFiltro(
    parametrosRecebidos.autorizacaoLigacoes,
    'autorizacaoLigacoes',
    ['nao_informado', 'autorizado', 'recusado', 'revogado']
  );
  const dataInicial = tratarDataFiltro(parametrosRecebidos.dataInicial, 'dataInicial');
  const dataFinal = tratarDataFiltro(parametrosRecebidos.dataFinal, 'dataFinal');
  const ordenacao = tratarOpcaoFiltro(
    parametrosRecebidos.ordenacao || 'mais_recentes',
    'ordenacao',
    ['mais_recentes', 'mais_antigos', 'nome_asc', 'nome_desc']
  );
  let telefone = '';

  if (idadeMinima !== null && idadeMaxima !== null && idadeMinima > idadeMaxima) {
    throw criarAppError('A idade mínima não pode ser maior que a idade máxima.', 400);
  }

  if (dataInicial && dataFinal && dataInicial > dataFinal) {
    throw criarAppError('A data inicial não pode ser posterior à data final.', 400);
  }

  if (telefoneRecebido) {
    telefone = normalizarTelefone(telefoneRecebido);

    if (!telefone) {
      throw criarAppError('O filtro telefone é inválido.', 400);
    }
  }

  return {
    nome,
    telefone,
    bairro,
    problema,
    consentimentoWhatsapp,
    consentimentoLigacoes,
    origem,
    status,
    idadeMinima,
    idadeMaxima,
    participouEleicaoAnterior,
    autorizacaoMensagens,
    autorizacaoLigacoes,
    dataInicial,
    dataFinal,
    ordenacao
  };
}

function transformarConsentimento(consentimento) {
  return {
    id: consentimento.id,
    tipo: consentimento.tipo,
    resposta: consentimento.resposta,
    estado: consentimento.estado || (consentimento.resposta ? 'autorizado' : 'recusado'),
    textoApresentado: consentimento.texto_apresentado,
    versaoTexto: consentimento.versao_texto,
    canal: consentimento.canal,
    origemRegistro: consentimento.origem_registro,
    origem: consentimento.origem_nome,
    ativo: consentimento.ativo,
    criadoEm: consentimento.criado_em,
    revogadoEm: consentimento.revogado_em,
    registradoPor: consentimento.registrado_por_usuario_nome || null,
    motivoRevogacao: consentimento.motivo_revogacao || null
  };
}

function validarIdentificadorContato(idRecebido) {
  const id = Number(idRecebido);

  if (!Number.isInteger(id) || id < 1) {
    throw criarAppError('Identificador do contato inválido.', 400);
  }

  return id;
}

function validarUsuarioResponsavel(usuario) {
  if (!usuario || !usuario.id) {
    throw criarAppError('Usuário autenticado não identificado.', 401);
  }
}

async function revogarConsentimentos(idRecebido, dadosRecebidos, usuario) {
  validarUsuarioResponsavel(usuario);
  const id = validarIdentificadorContato(idRecebido);
  const tipoRecebido = dadosRecebidos && dadosRecebidos.tipo;
  const tiposPorOpcao = {
    mensagens: ['mensagens'],
    ligacoes: ['ligacoes'],
    ambos: ['mensagens', 'ligacoes']
  };
  const tipos = tiposPorOpcao[tipoRecebido];
  const motivo = validarCampoOpcional(
    dadosRecebidos && dadosRecebidos.motivo,
    'Motivo da revogação',
    500
  );

  if (!tipos) {
    throw criarAppError(
      'Tipo de revogação inválido. Use mensagens, ligacoes ou ambos.',
      400
    );
  }

  const resultado = await contatoModel.revogarConsentimentos(
    id,
    tipos,
    motivo,
    usuario.id
  );

  if (!resultado) {
    throw criarAppError('Contato não encontrado.', 404);
  }

  return resultado;
}

async function solicitarExclusao(idRecebido, usuario) {
  validarUsuarioResponsavel(usuario);
  const id = validarIdentificadorContato(idRecebido);
  const resultado = await contatoModel.solicitarExclusao(id, usuario.id);

  if (!resultado) {
    throw criarAppError('Contato não encontrado.', 404);
  }

  return resultado;
}

async function detalharContato(idRecebido) {
  const id = validarIdentificadorContato(idRecebido);

  const resultado = await contatoModel.buscarDetalhes(id);

  if (!resultado) {
    throw criarAppError('Contato não encontrado.', 404);
  }

  const contato = transformarContatoParaResposta(resultado.contato);

  contato.origem = {
    id: resultado.contato.origem_id,
    nome: resultado.contato.origem_nome,
    slug: resultado.contato.origem_slug,
    tipo: resultado.contato.origem_tipo
  };

  return {
    contato,
    consentimentos: resultado.consentimentos.map(transformarConsentimento),
    aceitesPrivacidade: resultado.aceitesPrivacidade.map(function (aceite) {
      return {
        id: aceite.id,
        aceito: aceite.aceito,
        textoApresentado: aceite.texto_apresentado,
        versaoTexto: aceite.versao_texto,
        canal: aceite.canal,
        origem: aceite.origem_nome,
        criadoEm: aceite.criado_em
      };
    }),
    historico: resultado.historico.map(function (historico) {
      return {
        id: historico.id,
        tipoEvento: historico.tipo_evento,
        dadosAnteriores: historico.dados_anteriores,
        dadosNovos: historico.dados_novos,
        origem: historico.origem_nome,
        usuario: historico.usuario_nome,
        criadoEm: historico.criado_em
      };
    })
  };
}

async function listarContatos(parametrosRecebidos) {
  const parametros = parametrosRecebidos || {};
  const pagina = tratarNumeroPaginacao(parametros.pagina, 1, 'pagina');
  const limiteRecebido = tratarNumeroPaginacao(parametros.limite, 20, 'limite');
  const limite = Math.min(limiteRecebido, 100);
  const filtros = prepararFiltros(parametros);
  const resultados = await Promise.all([
    contatoModel.listar(filtros, pagina, limite),
    contatoModel.contar(filtros)
  ]);
  const contatosEncontrados = resultados[0];
  const totalRegistros = resultados[1];
  const totalPaginas = Math.ceil(totalRegistros / limite);
  const contatos = contatosEncontrados.map(function (contato) {
    return transformarContatoParaResposta(contato);
  });

  return {
    contatos,
    paginacao: {
      paginaAtual: pagina,
      limite,
      totalRegistros,
      totalPaginas
    }
  };
}

async function listarContatosParaRelatorio(parametrosRecebidos) {
  const filtros = prepararFiltros(parametrosRecebidos || {});
  const contatosEncontrados = await contatoModel.listar(
    filtros,
    1,
    2147483647
  );

  return contatosEncontrados.map(function (contato) {
    return transformarContatoParaResposta(contato);
  });
}

module.exports = {
  cadastrarContato,
  listarContatos,
  listarOpcoesFormulario,
  detalharContato,
  revogarConsentimentos,
  solicitarExclusao,
  cadastrarContatoManual,
  listarContatosParaRelatorio
};
