const path = require('path');
const ExcelJS = require('exceljs');
const importacaoModel = require('./importacaoModel');
const criarAppError = require('../../utils/AppError');
const normalizarTelefone = require('../../utils/normalizarTelefone');
const categoriasProblema = require('../../config/categoriasProblema');

function normalizarCabecalho(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function criarSlug(valor) {
  const slug = normalizarCabecalho(valor).replace(/_/g, '-');

  return slug || 'importacao';
}

function analisarCsv(texto) {
  const primeiraLinha = texto.split(/\r?\n/, 1)[0] || '';
  const delimitador = (primeiraLinha.match(/;/g) || []).length >
    (primeiraLinha.match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let linha = [];
  let campo = '';
  let entreAspas = false;
  let indice;

  for (indice = 0; indice < texto.length; indice += 1) {
    const caractere = texto[indice];
    const proximo = texto[indice + 1];

    if (caractere === '"' && entreAspas && proximo === '"') {
      campo += '"';
      indice += 1;
    } else if (caractere === '"') {
      entreAspas = !entreAspas;
    } else if (caractere === delimitador && !entreAspas) {
      linha.push(campo);
      campo = '';
    } else if ((caractere === '\n' || caractere === '\r') && !entreAspas) {
      if (caractere === '\r' && proximo === '\n') {
        indice += 1;
      }
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += caractere;
    }
  }

  if (campo || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }

  return linhas;
}

function textoCelula(celula) {
  if (!celula) {
    return '';
  }

  if (celula.text !== undefined) {
    return String(celula.text).trim();
  }

  return String(celula.value || '').trim();
}

async function analisarXlsx(buffer) {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(buffer);
  const planilha = pasta.worksheets[0];
  const linhas = [];

  if (!planilha) {
    return linhas;
  }

  planilha.eachRow({ includeEmpty: true }, function (linhaExcel) {
    const valores = [];
    let indice;

    for (indice = 1; indice <= linhaExcel.cellCount; indice += 1) {
      valores.push(textoCelula(linhaExcel.getCell(indice)));
    }

    linhas.push(valores);
  });

  return linhas;
}

function converterLinhasParaObjetos(linhas) {
  if (linhas.length < 2) {
    return [];
  }

  const cabecalhos = linhas[0].map(normalizarCabecalho);

  return linhas.slice(1).map(function (valores, indiceLinha) {
    const objeto = {};

    cabecalhos.forEach(function (cabecalho, indiceColuna) {
      if (cabecalho) {
        objeto[cabecalho] = String(valores[indiceColuna] || '').trim();
      }
    });

    return {
      numeroLinha: indiceLinha + 2,
      valores: objeto
    };
  }).filter(function (linha) {
    return Object.keys(linha.valores).some(function (chave) {
      return linha.valores[chave] !== '';
    });
  });
}

function buscarValor(objeto, aliases) {
  let indice;

  for (indice = 0; indice < aliases.length; indice += 1) {
    if (objeto[aliases[indice]] !== undefined) {
      return objeto[aliases[indice]];
    }
  }

  return '';
}

function normalizarParticipacao(valor) {
  const normalizado = normalizarCabecalho(valor);

  if (!normalizado) {
    return null;
  }

  if (normalizado === 'sim') {
    return 'sim';
  }

  if (normalizado === 'nao') {
    return 'nao';
  }

  if (normalizado === 'prefiro_nao_informar') {
    return 'prefiro_nao_informar';
  }

  return 'invalido';
}

function validarLinha(linha, telefonesDoArquivo) {
  const valores = linha.valores;
  const telefone = buscarValor(valores, ['telefone', 'celular', 'whatsapp']);
  const telefoneNormalizado = normalizarTelefone(telefone);
  const nome = buscarValor(valores, ['nome', 'nome_completo']) || null;
  const bairro = buscarValor(valores, ['bairro']) || null;
  const idadeTexto = buscarValor(valores, ['idade']);
  const problema = buscarValor(valores, ['categoria', 'categoria_problema', 'problema']) || null;
  const descricaoProblema = buscarValor(
    valores,
    ['descricao', 'descricao_problema', 'detalhes']
  ) || null;
  const eleicao = normalizarParticipacao(buscarValor(
    valores,
    ['participou_eleicao_anterior', 'eleicao', 'votou_ultima_eleicao']
  ));
  const idade = idadeTexto === '' ? null : Number(idadeTexto);
  const erros = [];

  if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 15) {
    erros.push('Telefone ausente ou inválido.');
  }

  if (telefoneNormalizado && telefonesDoArquivo.has(telefoneNormalizado)) {
    erros.push('Telefone duplicado no arquivo.');
  }

  if (nome && (nome.length < 2 || nome.length > 150)) {
    erros.push('Nome inválido.');
  }

  if (bairro && (bairro.length < 2 || bairro.length > 150)) {
    erros.push('Bairro inválido.');
  }

  if (idade !== null && (!Number.isInteger(idade) || idade < 16 || idade > 120)) {
    erros.push('Idade deve ser inteira entre 16 e 120.');
  }

  if (problema && !categoriasProblema.includes(problema)) {
    erros.push('Categoria de problema inválida.');
  }

  if (descricaoProblema && descricaoProblema.length > 1000) {
    erros.push('Descrição possui mais de 1000 caracteres.');
  }

  if (eleicao === 'invalido') {
    erros.push('Participação eleitoral inválida.');
  }

  if (telefoneNormalizado) {
    telefonesDoArquivo.add(telefoneNormalizado);
  }

  return {
    numeroLinha: linha.numeroLinha,
    dados: {
      telefone,
      telefoneNormalizado,
      nome,
      bairro,
      idade,
      problema,
      descricaoProblema,
      participouEleicaoAnterior: eleicao === 'invalido' ? null : eleicao
    },
    valida: erros.length === 0,
    erroValidacao: erros.length > 0 ? erros.join(' ') : null,
    resultado: erros.some(function (erro) {
      return erro === 'Telefone duplicado no arquivo.';
    }) ? 'duplicado' : (erros.length > 0 ? 'invalido' : 'pendente')
  };
}

async function preVisualizar(arquivo, nomeOrigem, usuario) {
  if (!arquivo) {
    throw criarAppError('Selecione um arquivo CSV ou XLSX.', 400);
  }

  if (typeof nomeOrigem !== 'string' || nomeOrigem.trim().length < 2) {
    throw criarAppError('Informe a origem da lista.', 400);
  }

  const formato = path.extname(arquivo.originalname).toLowerCase().replace('.', '');
  let matrizes;

  if (formato === 'csv') {
    matrizes = analisarCsv(arquivo.buffer.toString('utf8').replace(/^\uFEFF/, ''));
  } else if (formato === 'xlsx') {
    matrizes = await analisarXlsx(arquivo.buffer);
  } else {
    throw criarAppError('Formato não suportado. Use CSV ou XLSX.', 400);
  }

  const objetos = converterLinhasParaObjetos(matrizes);

  if (objetos.length === 0) {
    throw criarAppError('O arquivo não possui linhas de dados.', 400);
  }

  if (objetos.length > 5000) {
    throw criarAppError('O arquivo excede o limite de 5000 linhas.', 400);
  }

  const telefones = new Set();
  const linhas = objetos.map(function (linha) {
    return validarLinha(linha, telefones);
  });
  const origemTratada = nomeOrigem.trim();
  const importacao = await importacaoModel.criarPreVisualizacao({
    nomeArquivo: arquivo.originalname,
    formato,
    nomeOrigem: origemTratada,
    slugOrigem: criarSlug(origemTratada),
    usuarioId: usuario.id
  }, linhas);

  return {
    importacaoId: importacao.id,
    origem: importacao.origem,
    totalRecebido: linhas.length,
    validos: linhas.filter(function (linha) { return linha.valida; }).length,
    invalidos: linhas.filter(function (linha) { return !linha.valida; }).length,
    linhas: linhas.slice(0, 100).map(function (linha) {
      return {
        numeroLinha: linha.numeroLinha,
        dados: linha.dados,
        valida: linha.valida,
        erro: linha.erroValidacao
      };
    })
  };
}

async function confirmar(importacaoIdRecebido, usuario) {
  const importacaoId = Number(importacaoIdRecebido);

  if (!Number.isInteger(importacaoId) || importacaoId < 1) {
    throw criarAppError('Identificador da importação inválido.', 400);
  }

  try {
    return await importacaoModel.confirmar(importacaoId, usuario.id);
  } catch (erro) {
    if (erro.codigoAplicacao === 'IMPORTACAO_NAO_ENCONTRADA') {
      throw criarAppError('Importação não encontrada.', 404);
    }

    if (erro.codigoAplicacao === 'IMPORTACAO_PROCESSADA') {
      throw criarAppError('Esta importação já foi processada.', 409);
    }

    throw erro;
  }
}

module.exports = {
  preVisualizar,
  confirmar
};
