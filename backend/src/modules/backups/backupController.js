const backupService = require('./backupService');

async function listar(requisicao, resposta, proximo) {
  try {
    return resposta.status(200).json({
      mensagem: 'Histórico de backups listado com sucesso.',
      backups: await backupService.listar()
    });
  } catch (erro) {
    return proximo(erro);
  }
}

async function gerar(requisicao, resposta, proximo) {
  try {
    const backup = await backupService.gerar(requisicao.usuario);
    resposta.setHeader('X-Backup-SHA256', backup.sha256);
    resposta.setHeader('Content-Type', 'application/octet-stream');

    return resposta.download(
      backup.caminhoArquivo,
      backup.nomeArquivo,
      async function (erro) {
        try {
          await backupService.removerTemporario(backup.diretorio);
        } catch (erroLimpeza) {
          console.error('Não foi possível remover o backup temporário:', erroLimpeza.message);
        }
        if (erro && !resposta.headersSent) {
          return proximo(erro);
        }
        return undefined;
      }
    );
  } catch (erro) {
    return proximo(erro);
  }
}

module.exports = { gerar, listar };
