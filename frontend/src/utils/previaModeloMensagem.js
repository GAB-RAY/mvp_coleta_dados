const EXEMPLOS_PREVIA = {
  nome_contato: 'João',
  bairro: 'Copacabana',
  problema: 'Saneamento básico'
};

function valorExemploPrevia(configuracao) {
  if (!configuracao || !configuracao.origem) return null;
  if (configuracao.origem === 'fixo') {
    const valor = String(configuracao.valor || '').trim();
    return valor || null;
  }
  return EXEMPLOS_PREVIA[configuracao.origem] || null;
}

function substituirVariaveisPrevia(texto, configuracoes) {
  const lista = Array.isArray(configuracoes) ? configuracoes : [];
  const nomesEncontrados = [];
  return String(texto || '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, function (marcador, identificador) {
    let indice;
    if (/^\d+$/.test(identificador)) {
      indice = Number(identificador) - 1;
    } else {
      indice = nomesEncontrados.indexOf(identificador);
      if (indice === -1) {
        nomesEncontrados.push(identificador);
        indice = nomesEncontrados.length - 1;
      }
    }
    const exemplo = valorExemploPrevia(lista[indice]);
    return exemplo || marcador;
  });
}

function resolverImagemPrevia(template, enderecoLocal) {
  const configuracao = template || {};

  if (configuracao.cabecalhoTipo !== 'imagem') {
    return { estado: 'sem_cabecalho', endereco: '' };
  }

  if (configuracao.imagemModo === 'internet') {
    const endereco = String(configuracao.imagemEnvio || '').trim();

    if (!endereco) {
      return { estado: 'vazia', endereco: '' };
    }

    try {
      const url = new URL(endereco);
      if (url.protocol !== 'https:') {
        return { estado: 'invalida', endereco: '' };
      }
    } catch (erro) {
      return { estado: 'invalida', endereco: '' };
    }

    return { estado: 'carregar', endereco };
  }

  if (enderecoLocal) {
    return { estado: 'carregar', endereco: enderecoLocal };
  }

  if (String(configuracao.imagemEnvio || '').trim()) {
    return { estado: 'configurada', endereco: '' };
  }

  return { estado: 'vazia', endereco: '' };
}

export {
  EXEMPLOS_PREVIA,
  resolverImagemPrevia,
  substituirVariaveisPrevia,
  valorExemploPrevia
};
