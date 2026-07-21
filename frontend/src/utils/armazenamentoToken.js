const CHAVE_TOKEN = 'tokenAdministrativo';

function salvarToken(token) {
  localStorage.setItem(CHAVE_TOKEN, token);
}

function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

function removerToken() {
  localStorage.removeItem(CHAVE_TOKEN);
}

export {
  salvarToken,
  obterToken,
  removerToken
};
