const relatorioService = require('./relatorioService');

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
      'attachment; filename="contatos-a-voz-do-bairro.csv"'
    );

    return resposta.status(200).send(csv);
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  resumir,
  exportarCsv
};
