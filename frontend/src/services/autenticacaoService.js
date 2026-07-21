import requisitar from './api';

async function realizarLogin(email, senha) {
  return requisitar('/api/autenticacao/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha })
  });
}

export {
  realizarLogin
};
