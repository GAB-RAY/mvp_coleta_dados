import requisitar from './api';

async function listarEventos(sinal) {
  return requisitar('/api/admin/eventos', {
    method: 'GET',
    autenticado: true,
    signal: sinal
  });
}

async function criarEvento(dados) {
  return requisitar('/api/admin/eventos', {
    method: 'POST',
    autenticado: true,
    body: JSON.stringify(dados)
  });
}

async function editarEvento(id, dados) {
  return requisitar('/api/admin/eventos/' + id, {
    method: 'PUT',
    autenticado: true,
    body: JSON.stringify(dados)
  });
}

async function alterarStatusEvento(id, acao) {
  return requisitar('/api/admin/eventos/' + id + '/' + acao, {
    method: 'POST',
    autenticado: true
  });
}

export { alterarStatusEvento, criarEvento, editarEvento, listarEventos };
