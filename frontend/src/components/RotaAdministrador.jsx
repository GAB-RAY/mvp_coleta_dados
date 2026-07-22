import { Navigate, Outlet } from 'react-router-dom';
import { obterUsuario } from '../utils/armazenamentoToken';

function RotaAdministrador() {
  const usuario = obterUsuario();

  if (!usuario || usuario.perfil !== 'administrador') {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}

export default RotaAdministrador;
