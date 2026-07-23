import requisitar from './api';

async function listarSolicitacoes(status, sinal) {
  const parametro = status ? '?status=' + encodeURIComponent(status) : '';
  return requisitar('/api/admin/solicitacoes-exclusao' + parametro, {
    method: 'GET',
    autenticado: true,
    signal: sinal
  });
}

async function analisarSolicitacao(id, decisao, observacoes) {
  return requisitar('/api/admin/solicitacoes-exclusao/' + id + '/' + decisao, {
    method: 'POST',
    autenticado: true,
    body: JSON.stringify({ observacoes: observacoes || null })
  });
}

export { analisarSolicitacao, listarSolicitacoes };
