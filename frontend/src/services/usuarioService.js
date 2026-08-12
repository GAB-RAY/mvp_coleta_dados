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

async function atualizarProprioNome(nome) {
  return requisitar('/api/admin/usuarios/meu-perfil', {
    method: 'PATCH',
    autenticado: true,
    body: JSON.stringify({ nome })
  });
}

async function redefinirSenhaUsuario(usuarioId, novaSenha) {
  return requisitar('/api/admin/usuarios/' + usuarioId + '/senha', {
    method: 'PATCH',
    autenticado: true,
    body: JSON.stringify({ novaSenha })
  });
}

async function alterarPropriaSenha(senhaAtual, novaSenha) {
  return requisitar('/api/admin/usuarios/meu-perfil/senha', {
    method: 'PATCH',
    autenticado: true,
    body: JSON.stringify({ senhaAtual, novaSenha })
  });
}

export {
  alterarPropriaSenha,
  atualizarProprioNome,
  criarUsuario,
  listarUsuarios,
  redefinirSenhaUsuario
};
