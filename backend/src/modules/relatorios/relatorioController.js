const relatorioService = require('./relatorioService');

function criarNomeArquivo(extensao) {
  const data = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  return 'a-voz-do-bairro-contatos-' + data + '.' + extensao;
}

async function resumir(requisicao, resposta, proximo) {
  try {
    const resumo = await relatorioService.gerarResumo(requisicao.query);

    return resposta.status(200).json({
      mensagem: 'Relatório gerado com sucesso.',
      resumo
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function exportarCsv(requisicao, resposta, proximo) {
  try {
    const csv = await relatorioService.gerarCsv(requisicao.query);

    resposta.setHeader('Content-Type', 'text/csv; charset=utf-8');
    resposta.setHeader(
      'Content-Disposition',
      'attachment; filename="' + criarNomeArquivo('csv') + '"'
    );

    return resposta.status(200).send(csv);
  } catch (erro) {
    return proximo(erro);
  }
}

async function exportarExcel(requisicao, resposta, proximo) {
  try {
    const arquivo = await relatorioService.gerarExcel(requisicao.query);

    resposta.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    resposta.setHeader(
      'Content-Disposition',
      'attachment; filename="' + criarNomeArquivo('xlsx') + '"'
    );

    return resposta.status(200).send(Buffer.from(arquivo));
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  resumir,
  exportarCsv,
  exportarExcel
};
