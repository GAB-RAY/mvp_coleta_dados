const contatoService = require('../contatos/contatoService');

function adicionarContagem(mapa, chaveRecebida) {
  const chave = chaveRecebida || 'Não informado';
  mapa[chave] = (mapa[chave] || 0) + 1;
}

function transformarMapa(mapa) {
  return Object.keys(mapa).sort().map(function (nome) {
    return { nome, total: mapa[nome] };
  });
}

function obterFaixaEtaria(idade) {
  if (!idade) {
    return 'Não informado';
  }
  if (idade <= 24) {
    return '16 a 24';
  }
  if (idade <= 34) {
    return '25 a 34';
  }
  if (idade <= 44) {
    return '35 a 44';
  }
  if (idade <= 59) {
    return '45 a 59';
  }
  return '60 ou mais';
}

function obterDiaCadastro(valor) {
  if (!valor) {
    return null;
  }

  const data = valor instanceof Date ? valor : new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  return data.toISOString().slice(0, 10);
}

async function gerarResumo(parametros) {
  const contatos = await contatoService.listarContatosParaRelatorio(parametros);
  const bairro = {};
  const problema = {};
  const faixaEtaria = {};
  const eleicao = {};
  const origem = {};
  const mensagens = {};
  const ligacoes = {};
  const periodo = {};

  contatos.forEach(function (contato) {
    adicionarContagem(bairro, contato.bairro);
    adicionarContagem(problema, contato.problema);
    adicionarContagem(faixaEtaria, obterFaixaEtaria(contato.idade));
    adicionarContagem(eleicao, contato.participouEleicaoAnterior);
    adicionarContagem(origem, contato.origemAtual);
    adicionarContagem(mensagens, contato.autorizacaoMensagens);
    adicionarContagem(ligacoes, contato.autorizacaoLigacoes);
    adicionarContagem(periodo, obterDiaCadastro(contato.criadoEm));
  });

  return {
    totalContatos: contatos.length,
    porBairro: transformarMapa(bairro),
    porProblema: transformarMapa(problema),
    porFaixaEtaria: transformarMapa(faixaEtaria),
    porParticipacaoEleitoral: transformarMapa(eleicao),
    porOrigem: transformarMapa(origem),
    porAutorizacaoMensagens: transformarMapa(mensagens),
    porAutorizacaoLigacoes: transformarMapa(ligacoes),
    porPeriodo: transformarMapa(periodo)
  };
}

function escaparCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);

  return '"' + texto.replace(/"/g, '""') + '"';
}

async function gerarCsv(parametros) {
  const contatos = await contatoService.listarContatosParaRelatorio(parametros);
  const cabecalho = [
    'id', 'nome', 'telefone', 'idade', 'bairro', 'categoria_problema',
    'descricao_problema', 'participou_eleicao_anterior', 'origem', 'status',
    'autorizacao_mensagens', 'autorizacao_ligacoes', 'aceite_privacidade',
    'criado_em'
  ];
  const linhas = [cabecalho.map(escaparCsv).join(';')];

  contatos.forEach(function (contato) {
    linhas.push([
      contato.id,
      contato.nome,
      contato.telefone,
      contato.idade,
      contato.bairro,
      contato.problema,
      contato.descricaoProblema,
      contato.participouEleicaoAnterior,
      contato.origemAtual,
      contato.statusContato,
      contato.autorizacaoMensagens,
      contato.autorizacaoLigacoes,
      contato.aceitePrivacidade,
      contato.criadoEm
    ].map(escaparCsv).join(';'));
  });

  return '\uFEFF' + linhas.join('\r\n');
}

module.exports = {
  gerarResumo,
  gerarCsv
};
