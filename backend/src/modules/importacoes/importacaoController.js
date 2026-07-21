const importacaoService = require('./importacaoService');

async function preVisualizar(requisicao, resposta, proximo) {
  try {
    const resultado = await importacaoService.preVisualizar(
      requisicao.file,
      requisicao.body.origem,
      requisicao.usuario
    );

    return resposta.status(201).json({
      mensagem: 'Arquivo validado. Revise a pré-visualização antes de confirmar.',
      importacao: resultado
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function confirmar(requisicao, resposta, proximo) {
  try {
    const relatorio = await importacaoService.confirmar(
      requisicao.params.id,
      requisicao.usuario
    );

    return resposta.status(200).json({
      mensagem: 'Importação concluída com sucesso.',
      relatorio
    });
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = {
  preVisualizar,
  confirmar
};
