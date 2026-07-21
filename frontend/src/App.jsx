import { Navigate, Route, Routes } from 'react-router-dom';
import RotaProtegida from './components/RotaProtegida';
import FormularioPublico from './pages/FormularioPublico';
import Login from './pages/Login';
import ContatosAdministrativos from './pages/ContatosAdministrativos';
import PaginaNaoEncontrada from './pages/PaginaNaoEncontrada';

function App() {
  return (
    <Routes>
      <Route path="/" element={<FormularioPublico />} />
      <Route path="/login" element={<Login />} />

      <Route element={<RotaProtegida />}>
        <Route path="/admin/contatos" element={<ContatosAdministrativos />} />
      </Route>

      <Route path="/admin" element={<Navigate to="/admin/contatos" replace />} />
      <Route path="*" element={<PaginaNaoEncontrada />} />
    </Routes>
  );
}

export default App;
