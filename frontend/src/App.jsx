import { Navigate, Route, Routes } from 'react-router-dom';
import RotaProtegida from './components/RotaProtegida';
import FormularioPublico from './pages/FormularioPublico';
import Login from './pages/Login';
import ContatosAdministrativos from './pages/ContatosAdministrativos';
import DetalhesContato from './pages/DetalhesContato';
import CadastroManual from './pages/CadastroManual';
import ImportacaoContatos from './pages/ImportacaoContatos';
import Relatorios from './pages/Relatorios';
import PaginaNaoEncontrada from './pages/PaginaNaoEncontrada';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/participar" replace />} />
      <Route path="/participar" element={<FormularioPublico />} />
      <Route path="/login" element={<Login />} />

      <Route element={<RotaProtegida />}>
        <Route path="/admin/contatos" element={<ContatosAdministrativos />} />
        <Route path="/admin/contatos/:id" element={<DetalhesContato />} />
        <Route path="/admin/contatos/novo" element={<CadastroManual />} />
        <Route path="/admin/importacoes" element={<ImportacaoContatos />} />
        <Route path="/admin/relatorios" element={<Relatorios />} />
      </Route>

      <Route path="/admin" element={<Navigate to="/admin/contatos" replace />} />
      <Route path="*" element={<PaginaNaoEncontrada />} />
    </Routes>
  );
}

export default App;
