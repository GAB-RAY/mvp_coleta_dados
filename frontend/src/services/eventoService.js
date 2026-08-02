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

async function listarParticipantesEvento(id, filtros) {
  const parametros=new URLSearchParams(filtros||{});
  return requisitar('/api/admin/eventos/'+id+'/participantes?'+parametros.toString(),{method:'GET',autenticado:true});
}

async function atualizarStatusInscricao(eventoId,contatoId,status){
  return requisitar('/api/admin/eventos/'+eventoId+'/participantes/'+contatoId,{method:'PATCH',autenticado:true,body:JSON.stringify({status})});
}

export { alterarStatusEvento, atualizarStatusInscricao, criarEvento, editarEvento, listarEventos, listarParticipantesEvento };
