function textoPreenchido(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function obterPosicoesVariaveis(conteudo) {
  const posicoes = Array.from(String(conteudo || '').matchAll(/\{\{(\d+)\}\}/g), function (item) {
    return Number(item[1]);
  });
  return Array.from(new Set(posicoes)).sort(function (a, b) { return a - b; });
}

function parametroConfigurado(parametro) {
  if (!parametro || !['nome_contato', 'bairro', 'problema', 'fixo'].includes(parametro.origem)) return false;
  return parametro.origem !== 'fixo' || textoPreenchido(parametro.valor);
}

function adicionarPendencia(pendencias, tipo, mensagem, detalhes) {
  pendencias.push(Object.assign({ tipo, mensagem }, detalhes || {}));
}

function analisarVariaveis(pendencias, componente, configuracoes, local) {
  const posicoes = obterPosicoesVariaveis(componente && componente.text);
  posicoes.forEach(function (posicao) {
    if (!parametroConfigurado(configuracoes[posicao - 1])) {
      adicionarPendencia(pendencias, 'valor_personalizado',
        'Configure o valor {{' + posicao + '}}.', { componente: local, posicao });
    }
  });
}

function analisarImagemCabecalho(pendencias, cabecalho, configuracaoCabecalho) {
  if (!cabecalho || String(cabecalho.format || '').toUpperCase() !== 'IMAGE') return;
  const configurada = configuracaoCabecalho && configuracaoCabecalho.tipo === 'imagem' &&
    ['id', 'link'].includes(configuracaoCabecalho.origem) && textoPreenchido(configuracaoCabecalho.valor);
  const linkValido = !configurada || configuracaoCabecalho.origem !== 'link' ||
    /^https:\/\//i.test(configuracaoCabecalho.valor.trim());
  if (!configurada || !linkValido) {
    adicionarPendencia(pendencias, 'imagem_cabecalho',
      'Configure a imagem do cabeçalho.', { componente: 'header' });
  }
}

function buscarConfiguracaoBotao(configuracoes, indice) {
  return configuracoes.find(function (item) { return item && item.indice === indice; });
}

function analisarBotoes(pendencias, grupoBotoes, configuracoes, templateExternoAprovado, identificadorOptOut) {
  const botoesOficiais = grupoBotoes && Array.isArray(grupoBotoes.buttons) ? grupoBotoes.buttons : [];
  botoesOficiais.forEach(function (botao, indice) {
    const tipo = String(botao && botao.type || '').toUpperCase();
    const configuracao = buscarConfiguracaoBotao(configuracoes, indice);
    const urlDinamica = tipo === 'URL' && obterPosicoesVariaveis(botao.url).length > 0;

    if (urlDinamica && (!configuracao || configuracao.subtipo !== 'url' ||
      !['nome_contato', 'fixo'].includes(configuracao.origem) ||
      (configuracao.origem === 'fixo' && !textoPreenchido(configuracao.valor)))) {
      adicionarPendencia(pendencias, 'parametro_botao',
        'Configure o valor dinâmico do botão ' + (indice + 1) + '.',
        { componente: 'button', indice });
      return;
    }

    if (tipo !== 'QUICK_REPLY') return;
    if (!configuracao) {
      if (!templateExternoAprovado) {
        adicionarPendencia(pendencias, 'botao_opt_out',
          'Configure o botão SAIR usado para descadastro.',
          { componente: 'button', indice });
      }
      return;
    }

    const optOutValido = configuracao.subtipo === 'quick_reply' &&
      configuracao.origem === 'opt_out' && textoPreenchido(identificadorOptOut);
    if (!optOutValido) {
      adicionarPendencia(pendencias, 'botao_opt_out',
        'Configure corretamente o botão SAIR usado para descadastro.',
        { componente: 'button', indice });
    }
  });
}

function analisarRequisitosDeEnvio(template, configuracaoRecebida, opcoesRecebidas) {
  const dados = template || {};
  const configuracao = configuracaoRecebida && typeof configuracaoRecebida === 'object'
    ? configuracaoRecebida : {};
  const opcoes = opcoesRecebidas || {};
  const componentes = Array.isArray(dados.componentes) ? dados.componentes : [];
  const pendencias = [];
  const origem = String(dados.origem || '').toLowerCase();
  const statusOficial = String(dados.statusOficial || '').toUpperCase();
  const templateExternoAprovado = origem === 'meta' && statusOficial === 'APPROVED';

  if (statusOficial !== 'APPROVED') {
    adicionarPendencia(pendencias, 'status_oficial',
      'O modelo precisa estar aprovado pela Meta antes do envio.');
  }
  if (!textoPreenchido(dados.nome)) {
    adicionarPendencia(pendencias, 'nome_oficial',
      'O nome oficial do modelo não está configurado.');
  }
  if (!textoPreenchido(dados.idioma)) {
    adicionarPendencia(pendencias, 'idioma_oficial',
      'O idioma oficial do modelo não está configurado.');
  }

  const corpo = componentes.find(function (item) {
    return String(item.type || '').toUpperCase() === 'BODY';
  });
  analisarVariaveis(pendencias, corpo,
    Array.isArray(configuracao.corpo) ? configuracao.corpo : [], 'body');

  const cabecalho = componentes.find(function (item) {
    return String(item.type || '').toUpperCase() === 'HEADER';
  });
  analisarImagemCabecalho(pendencias, cabecalho, configuracao.cabecalho);
  if (cabecalho && String(cabecalho.format || '').toUpperCase() === 'TEXT') {
    const parametrosCabecalho = configuracao.cabecalho && Array.isArray(configuracao.cabecalho.parametros)
      ? configuracao.cabecalho.parametros : [];
    analisarVariaveis(pendencias, cabecalho, parametrosCabecalho, 'header');
  }

  const grupoBotoes = componentes.find(function (item) {
    return String(item.type || '').toUpperCase() === 'BUTTONS';
  });
  analisarBotoes(pendencias, grupoBotoes,
    Array.isArray(configuracao.botoes) ? configuracao.botoes : [],
    templateExternoAprovado, opcoes.identificadorOptOut);

  return { validoParaEnvio: pendencias.length === 0, pendencias, templateExternoAprovado };
}

module.exports = { analisarRequisitosDeEnvio, obterPosicoesVariaveis };
