import requisitar, { obterUrlBase } from './api';
import { obterToken } from '../utils/armazenamentoToken';

function obterNomeArquivo(resposta, nomePadrao) {
  const disposicao = resposta.headers.get('Content-Disposition') || '';
  const resultado = disposicao.match(/filename="?([^";]+)"?/i);
  return resultado ? resultado[1] : nomePadrao;
}

function criarParametros(filtros) {
  const parametros = new URLSearchParams();

  Object.keys(filtros || {}).forEach(function (chave) {
    const valor = filtros[chave];
    if (valor !== undefined && valor !== null && valor !== '') {
      parametros.set(chave, valor);
    }
  });

  return parametros.toString();
}

async function buscarResumo(filtros, sinal) {
  return requisitar('/api/admin/relatorios/resumo?' + criarParametros(filtros), {
    method: 'GET',
    autenticado: true,
    signal: sinal
  });
}

async function baixarArquivo(filtros, formato) {
  const urlBase = obterUrlBase();
  const resposta = await fetch(
    urlBase + '/api/admin/relatorios/exportar.' + formato + '?' + criarParametros(filtros),
    {
      headers: { Authorization: 'Bearer ' + obterToken() }
    }
  );

  if (!resposta.ok) {
    const erro = new Error('Não foi possível exportar o relatório em ' + formato.toUpperCase() + '.');
    erro.statusHttp = resposta.status;
    throw erro;
  }

  return {
    arquivo: await resposta.blob(),
    nomeArquivo: obterNomeArquivo(
      resposta,
      'acorda-rj-contatos.' + formato
    )
  };
}

async function baixarCsv(filtros) {
  return baixarArquivo(filtros, 'csv');
}

async function baixarExcel(filtros) {
  return baixarArquivo(filtros, 'xlsx');
}

export {
  baixarCsv,
  baixarExcel,
  buscarResumo
};
