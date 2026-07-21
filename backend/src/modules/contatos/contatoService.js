const contatoModel = require('./contatoModel');
const criarAppError = require('../../utils/AppError');
const normalizarTelefone = require('../../utils/normalizarTelefone');
const textosConsentimento = require('../../config/textosConsentimento');

const TEXTO_LEGADO_NAO_REGISTRADO =
  'Texto apresentado não registrado pelo cliente legado.';

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

function campoFoiInformado(dadosRecebidos, nomeCampo) {
  return Object.prototype.hasOwnProperty.call(dadosRecebidos, nomeCampo);
}

function obterConsentimentoComAlias(
  dadosRecebidos,
  nomeAtual,
  nomeAntigo,
  nomeExibicao,
  obrigatorioNoContrato
) {
  const informouAtual = campoFoiInformado(dadosRecebidos, nomeAtual);
  const informouAntigo = nomeAntigo && campoFoiInformado(dadosRecebidos, nomeAntigo);

  if (
    informouAtual &&
    informouAntigo &&
    dadosRecebidos[nomeAtual] !== dadosRecebidos[nomeAntigo]
  ) {
    throw criarAppError('Os campos de ' + nomeExibicao + ' são incompatíveis.', 400);
  }

  if (!informouAtual && !informouAntigo) {
    if (obrigatorioNoContrato) {
      throw criarAppError('O consentimento para ' + nomeExibicao + ' é obrigatório.', 400);
    }

    return {
      valor: null,
      clienteLegado: false,
      apresentado: false
    };
  }

  const valor = informouAtual
    ? dadosRecebidos[nomeAtual]
    : dadosRecebidos[nomeAntigo];

  if (typeof valor !== 'boolean') {
    throw criarAppError(
      'O consentimento para ' + nomeExibicao + ' deve ser verdadeiro ou falso.',
      400
    );
  }

  return {
    valor,
    clienteLegado: !informouAtual && informouAntigo,
    apresentado: true
  };
}

function criarHistorico(tipo, consentimento, textoApresentado, versaoTexto) {
  if (!consentimento.apresentado) {
    return null;
  }

  return {
    tipo,
    resposta: consentimento.valor,
    textoApresentado: consentimento.clienteLegado
      ? TEXTO_LEGADO_NAO_REGISTRADO
      : textoApresentado,
    versaoTexto: consentimento.clienteLegado
      ? 'legado_sem_versao'
      : versaoTexto,
    canal: 'formulario_publico',
    origemRegistro: 'resposta_expressa',
    registradoPorUsuarioId: null
  };
}

function validarDadosDoContato(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== 'object' || Array.isArray(dadosRecebidos)) {
    throw criarAppError('Os dados do contato são obrigatórios.', 400);
  }

  const nome = validarCampoTexto(dadosRecebidos.nome, 'Nome', 2, 150);
  const telefone = validarCampoTexto(dadosRecebidos.telefone, 'Telefone', 1, 30);
  const bairro = validarCampoTexto(dadosRecebidos.bairro, 'Bairro', 2, 150);
  const problema = validarCampoTexto(dadosRecebidos.problema, 'Problema', 3, 500);
  const tratamentoDados = obterConsentimentoComAlias(
    dadosRecebidos,
    'consentimentoTratamentoDados',
    'consentimentoArmazenamento',
    'tratamento dos dados',
    true
  );
  const whatsapp = obterConsentimentoComAlias(
    dadosRecebidos,
    'consentimentoWhatsapp',
    'consentimentoMensagens',
    'mensagens pelo WhatsApp',
    true
  );
  const ligacoes = obterConsentimentoComAlias(
    dadosRecebidos,
    'consentimentoLigacoes',
    null,
    'ligações',
    false
  );

  if (tratamentoDados.valor !== true) {
    throw criarAppError('O consentimento para tratamento dos dados é obrigatório.', 400);
  }

  const telefoneNormalizado = normalizarTelefone(telefone);

  if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 15) {
    throw criarAppError('O telefone informado é inválido.', 400);
  }

  const historicosConsentimento = [
    criarHistorico(
      'tratamento_dados',
      tratamentoDados,
      textosConsentimento.textoTratamentoDados,
      textosConsentimento.versaoTratamentoDados
    ),
    criarHistorico(
      'mensagens_whatsapp',
      whatsapp,
      textosConsentimento.textoWhatsapp,
      textosConsentimento.versaoWhatsapp
    ),
    criarHistorico(
      'ligacoes',
      ligacoes,
      textosConsentimento.textoLigacoes,
      textosConsentimento.versaoLigacoes
    )
  ].filter(function (historico) {
    return historico !== null;
  });

  return {
    nome,
    telefone,
    telefoneNormalizado,
    bairro,
    problema,
    consentimentoTratamentoDados: tratamentoDados.valor,
    consentimentoWhatsapp: whatsapp.valor,
    consentimentoLigacoes: ligacoes.valor,
    bloqueadoParaMensagens: whatsapp.valor !== true,
    origemAtual: 'Formulário A Voz do Bairro',
    statusContato: 'ativo',
    historicosConsentimento
  };
}

function transformarContatoParaResposta(contato) {
  return {
    id: contato.id,
    nome: contato.nome,
    telefone: contato.telefone,
    bairro: contato.bairro,
    problema: contato.problema,
    consentimentoArmazenamento: contato.consentimento_tratamento_dados,
    consentimentoMensagens: contato.consentimento_whatsapp,
    consentimentoTratamentoDados: contato.consentimento_tratamento_dados,
    consentimentoWhatsapp: contato.consentimento_whatsapp,
    consentimentoLigacoes: contato.consentimento_ligacoes,
    origemAtual: contato.origem_atual,
    statusContato: contato.status_contato,
    bloqueadoParaMensagens: contato.bloqueado_para_mensagens,
    criadoEm: contato.criado_em
  };
}

async function cadastrarContato(dadosRecebidos) {
  const dadosDoContato = validarDadosDoContato(dadosRecebidos);
  const contatoExistente = await contatoModel.buscarPorTelefoneNormalizado(
    dadosDoContato.telefoneNormalizado
  );

  if (contatoExistente) {
    throw criarAppError('Este WhatsApp já está cadastrado em nossa ação.', 409);
  }

  try {
    const contatoCriado = await contatoModel.criar(dadosDoContato);

    return transformarContatoParaResposta(contatoCriado);
  } catch (erro) {
    if (erro.code === '23505') {
      throw criarAppError('Este WhatsApp já está cadastrado em nossa ação.', 409);
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
  let telefone = '';

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
    status
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

module.exports = {
  cadastrarContato,
  listarContatos
};
