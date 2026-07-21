import requisitar from './api';
import { obterToken } from '../utils/armazenamentoToken';

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

async function baixarCsv(filtros) {
  const urlBase = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  const resposta = await fetch(
    urlBase + '/api/admin/relatorios/exportar.csv?' + criarParametros(filtros),
    {
      headers: { Authorization: 'Bearer ' + obterToken() }
    }
  );

  if (!resposta.ok) {
    const erro = new Error('Não foi possível exportar o relatório.');
    erro.statusHttp = resposta.status;
    throw erro;
  }

  return resposta.blob();
}

export {
  baixarCsv,
  buscarResumo
};
