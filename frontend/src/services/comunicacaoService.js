import requisitar from './api';

function chamar(caminho, metodo, body) {
  return requisitar('/api/admin/comunicacoes' + caminho, {
    method: metodo,
    autenticado: true,
    body: body ? JSON.stringify(body) : undefined
  });
}
function criarBusca(parametros) {
  const busca = new URLSearchParams();
  Object.entries(parametros || {}).forEach(function adicionar(entrada) {
    if (entrada[1] !== '' && entrada[1] !== null && entrada[1] !== undefined) {
      busca.set(entrada[0], entrada[1]);
    }
  });
  return busca.toString();
}
function listarNumeros() { return chamar('/numeros', 'GET'); }
function salvarNumero(id, dados) {
  return chamar('/numeros' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', dados);
}
function excluirNumero(id) { return chamar('/numeros/' + id, 'DELETE'); }
function listarModelos() { return chamar('/modelos', 'GET'); }
function salvarModelo(id, dados) {
  return chamar('/modelos' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', dados);
}
function listarCampanhas() { return chamar('/campanhas', 'GET'); }
function salvarCampanha(id, dados) {
  return chamar('/campanhas' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', dados);
}
function listarOperadores() { return chamar('/operadores', 'GET'); }
function listarContatosComunicacao(parametros) {
  return chamar('/contatos?' + criarBusca(parametros), 'GET');
}
function prepararComunicacoes(dados) { return chamar('/preparar', 'POST', dados); }
function confirmarEnvio(id, dados) {
  return chamar('/' + id + '/confirmar-envio', 'POST', dados || {});
}
function cancelarComunicacao(id) { return chamar('/' + id, 'DELETE'); }
function listarComunicacoes(parametros) {
  return chamar('/?' + criarBusca(parametros), 'GET');
}
function listarHistoricoComunicacao(id) {
  return chamar('/' + id + '/historico', 'GET');
}
function atualizarComunicacao(id, dados) { return chamar('/' + id, 'PATCH', dados); }

export {
  atualizarComunicacao,
  cancelarComunicacao,
  confirmarEnvio,
  excluirNumero,
  listarCampanhas,
  listarComunicacoes,
  listarContatosComunicacao,
  listarHistoricoComunicacao,
  listarModelos,
  listarNumeros,
  listarOperadores,
  prepararComunicacoes,
  salvarCampanha,
  salvarModelo,
  salvarNumero
};
