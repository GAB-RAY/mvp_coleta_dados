import requisitar from './api';

async function cadastrarContato(dadosDoContato) {
  return requisitar('/api/publico/contatos', {
    method: 'POST',
    body: JSON.stringify(dadosDoContato)
  });
}

async function buscarOpcoesFormulario() {
  return requisitar('/api/publico/contatos/opcoes', {
    method: 'GET'
  });
}

async function listarContatos(filtros, pagina, limite, sinal) {
  const parametros = new URLSearchParams();

  if (filtros.nome) {
    parametros.set('nome', filtros.nome);
  }

  if (filtros.telefone) {
    parametros.set('telefone', filtros.telefone);
  }

  if (filtros.bairro) {
    parametros.set('bairro', filtros.bairro);
  }

  if (filtros.problema) {
    parametros.set('problema', filtros.problema);
  }

  if (filtros.consentimentoWhatsapp) {
    parametros.set('consentimentoWhatsapp', filtros.consentimentoWhatsapp);
  }

  if (filtros.consentimentoLigacoes) {
    parametros.set('consentimentoLigacoes', filtros.consentimentoLigacoes);
  }

  if (filtros.origem) {
    parametros.set('origem', filtros.origem);
  }

  if (filtros.status) {
    parametros.set('status', filtros.status);
  }

  if (filtros.idadeMinima) {
    parametros.set('idadeMinima', filtros.idadeMinima);
  }

  if (filtros.idadeMaxima) {
    parametros.set('idadeMaxima', filtros.idadeMaxima);
  }

  if (filtros.participouEleicaoAnterior) {
    parametros.set('participouEleicaoAnterior', filtros.participouEleicaoAnterior);
  }

  if (filtros.autorizacaoMensagens) {
    parametros.set('autorizacaoMensagens', filtros.autorizacaoMensagens);
  }

  if (filtros.autorizacaoLigacoes) {
    parametros.set('autorizacaoLigacoes', filtros.autorizacaoLigacoes);
  }

  if (filtros.dataInicial) {
    parametros.set('dataInicial', filtros.dataInicial);
  }

  if (filtros.dataFinal) {
    parametros.set('dataFinal', filtros.dataFinal);
  }

  if (filtros.ordenacao) {
    parametros.set('ordenacao', filtros.ordenacao);
  }

  parametros.set('pagina', String(pagina));
  parametros.set('limite', String(limite));

  return requisitar('/api/admin/contatos?' + parametros.toString(), {
    method: 'GET',
    autenticado: true,
    signal: sinal
  });
}

async function buscarDetalhesContato(id, sinal) {
  return requisitar('/api/admin/contatos/' + id, {
    method: 'GET',
    autenticado: true,
    signal: sinal
  });
}

async function listarOrigens(sinal) {
  return requisitar('/api/admin/origens', {
    method: 'GET',
    autenticado: true,
    signal: sinal
  });
}

async function cadastrarContatoManual(dadosDoContato) {
  return requisitar('/api/admin/contatos', {
    method: 'POST',
    autenticado: true,
    body: JSON.stringify(dadosDoContato)
  });
}

async function preVisualizarImportacao(arquivo, origem) {
  const formulario = new FormData();
  formulario.append('arquivo', arquivo);
  formulario.append('origem', origem);

  return requisitar('/api/admin/importacoes/pre-visualizar', {
    method: 'POST',
    autenticado: true,
    body: formulario
  });
}

async function confirmarImportacao(id) {
  return requisitar('/api/admin/importacoes/' + id + '/confirmar', {
    method: 'POST',
    autenticado: true
  });
}

export {
  buscarOpcoesFormulario,
  buscarDetalhesContato,
  cadastrarContatoManual,
  cadastrarContato,
  confirmarImportacao,
  listarContatos,
  listarOrigens,
  preVisualizarImportacao
};
