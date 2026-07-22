import requisitar from './api';

async function listarUsuarios(sinal) {
  return requisitar('/api/admin/usuarios', {
    method: 'GET',
    autenticado: true,
    signal: sinal
  });
}

async function criarUsuario(dadosDoUsuario) {
  return requisitar('/api/admin/usuarios', {
    method: 'POST',
    autenticado: true,
    body: JSON.stringify(dadosDoUsuario)
  });
}

async function redefinirSenhaUsuario(usuarioId, novaSenha) {
  return requisitar('/api/admin/usuarios/' + usuarioId + '/senha', {
    method: 'PATCH',
    autenticado: true,
    body: JSON.stringify({ novaSenha })
  });
}

export {
  criarUsuario,
  listarUsuarios,
  redefinirSenhaUsuario
};
