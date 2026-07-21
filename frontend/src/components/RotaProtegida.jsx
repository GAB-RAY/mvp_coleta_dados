import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { obterToken } from '../utils/armazenamentoToken';

function RotaProtegida() {
  const localizacao = useLocation();
  const token = obterToken();

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          origem: localizacao.pathname,
          mensagem: 'Faça login para acessar a área administrativa.'
        }}
      />
    );
  }

  return <Outlet />;
}

export default RotaProtegida;
