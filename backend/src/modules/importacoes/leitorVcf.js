const criarAppError = require('../../utils/AppError');

function juntarLinhasDobradas(texto) {
  const linhasFisicas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const linhas = [];

  linhasFisicas.forEach(function (linha) {
    if (linhas.length > 0 && (/^[ \t]/.test(linha) || linhas[linhas.length - 1].endsWith('='))) {
      const continuacao = /^[ \t]/.test(linha) ? linha.slice(1) : linha;
      const anterior = linhas[linhas.length - 1];

      linhas[linhas.length - 1] = anterior.endsWith('=')
        ? anterior.slice(0, -1) + continuacao
        : anterior + continuacao;
      return;
    }

    linhas.push(linha);
  });

  return linhas;
}

function decodificarQuotedPrintable(valor) {
  const partes = [];
  let textoLiteral = '';
  let indice = 0;

  function adicionarTextoLiteral() {
    if (textoLiteral) {
      partes.push(Buffer.from(textoLiteral, 'utf8'));
      textoLiteral = '';
    }
  }

  while (indice < valor.length) {
    const hexadecimal = valor.slice(indice + 1, indice + 3);

    if (valor[indice] === '=' && /^[0-9A-Fa-f]{2}$/.test(hexadecimal)) {
      adicionarTextoLiteral();
      partes.push(Buffer.from([parseInt(hexadecimal, 16)]));
      indice += 3;
    } else {
      textoLiteral += valor[indice];
      indice += 1;
    }
  }

  adicionarTextoLiteral();
  return Buffer.concat(partes).toString('utf8');
}

function decodificarValor(valor, parametros) {
  let resultado = valor;

  if (/ENCODING=QUOTED-PRINTABLE/i.test(parametros)) {
    resultado = decodificarQuotedPrintable(resultado);
  }

  return resultado
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\:/g, ':')
    .replace(/\\\\/g, '\\')
    .trim();
}

function montarNomeEstruturado(valor) {
  const partes = valor.split(';').map(function (parte) {
    return parte.trim();
  });
  const familia = partes[0] || '';
  const nome = partes[1] || '';
  const adicionais = partes[2] || '';
  const prefixo = partes[3] || '';
  const sufixo = partes[4] || '';

  return [prefixo, nome, adicionais, familia, sufixo].filter(Boolean).join(' ').trim();
}

function analisarVcf(buffer) {
  const texto = buffer.toString('utf8').replace(/^\uFEFF/, '');

  if (!/BEGIN:VCARD/i.test(texto) || !/END:VCARD/i.test(texto)) {
    throw criarAppError(
      'Não foi possível ler o arquivo de contatos. Selecione novamente o arquivo exportado pelo celular.',
      400
    );
  }

  const linhas = juntarLinhasDobradas(texto);
  const contatos = [];
  let contatoAtual = null;

  linhas.forEach(function (linha) {
    if (/^BEGIN:VCARD\s*$/i.test(linha)) {
      contatoAtual = { nomeCompleto: '', nomeEstruturado: '', telefones: [] };
      return;
    }

    if (/^END:VCARD\s*$/i.test(linha)) {
      if (contatoAtual) {
        contatos.push(contatoAtual);
      }
      contatoAtual = null;
      return;
    }

    if (!contatoAtual) {
      return;
    }

    const separador = linha.indexOf(':');

    if (separador < 0) {
      return;
    }

    const identificacao = linha.slice(0, separador);
    const valorOriginal = linha.slice(separador + 1);
    const partesIdentificacao = identificacao.split(';');
    const propriedadeComGrupo = partesIdentificacao[0].toUpperCase();
    const propriedade = propriedadeComGrupo.split('.').pop();
    const parametros = partesIdentificacao.slice(1).join(';');
    let valor = decodificarValor(valorOriginal, parametros);

    if (propriedade === 'FN' && !contatoAtual.nomeCompleto) {
      contatoAtual.nomeCompleto = valor;
    } else if (propriedade === 'N' && !contatoAtual.nomeEstruturado) {
      contatoAtual.nomeEstruturado = montarNomeEstruturado(valor);
    } else if (propriedade === 'TEL') {
      valor = valor.replace(/^tel:/i, '').trim();

      if (valor) {
        contatoAtual.telefones.push(valor);
      }
    }
  });

  if (contatos.length === 0) {
    throw criarAppError(
      'O arquivo de contatos não possui registros reconhecíveis.',
      400
    );
  }

  const registros = [];

  contatos.forEach(function (contato) {
    const nome = contato.nomeCompleto || contato.nomeEstruturado;

    if (contato.telefones.length === 0) {
      registros.push({
        numeroLinha: registros.length + 1,
        valores: { nome: nome, telefone: '' }
      });
      return;
    }

    contato.telefones.forEach(function (telefone) {
      registros.push({
        numeroLinha: registros.length + 1,
        valores: { nome: nome, telefone: telefone }
      });
    });
  });

  return registros;
}

module.exports = {
  analisarVcf
};
