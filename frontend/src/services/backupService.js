import requisitar from './api';
import { obterToken } from '../utils/armazenamentoToken';

function obterNomeArquivo(resposta, nomePadrao) {
  const disposicao = resposta.headers.get('Content-Disposition') || '';
  const resultado = disposicao.match(/filename="?([^";]+)"?/i);
  return resultado ? resultado[1] : nomePadrao;
}

async function listarBackups(sinal) {
  return requisitar('/api/admin/backups', {
    method: 'GET',
    autenticado: true,
    signal: sinal
  });
}

async function gerarBackup() {
  const urlBase = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  const resposta = await fetch(urlBase + '/api/admin/backups/banco', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + obterToken() }
  });

  if (!resposta.ok) {
    let mensagem = 'Não foi possível gerar o backup.';
    try {
      const corpo = await resposta.json();
      mensagem = corpo.mensagem || mensagem;
    } catch (erro) {
      mensagem = 'Não foi possível gerar o backup.';
    }
    const erro = new Error(mensagem);
    erro.statusHttp = resposta.status;
    throw erro;
  }

  return {
    arquivo: await resposta.blob(),
    sha256: resposta.headers.get('X-Backup-SHA256') || '',
    nomeArquivo: obterNomeArquivo(
      resposta,
      'acorda-vk-backup-completo-postgresql.backup'
    )
  };
}

export { gerarBackup, listarBackups };
