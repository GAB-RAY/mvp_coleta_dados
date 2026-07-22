const CHAVE_TOKEN = 'tokenAdministrativo';
const CHAVE_USUARIO = 'usuarioAdministrativo';

function salvarToken(token) {
  localStorage.setItem(CHAVE_TOKEN, token);
}

function salvarUsuario(usuario) {
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

function obterUsuario() {
  const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO);

  if (!usuarioSalvo) {
    return null;
  }

  try {
    return JSON.parse(usuarioSalvo);
  } catch (erro) {
    localStorage.removeItem(CHAVE_USUARIO);
    return null;
  }
}

function removerToken() {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_USUARIO);
}

export {
  salvarToken,
  salvarUsuario,
  obterToken,
  obterUsuario,
  removerToken
};
