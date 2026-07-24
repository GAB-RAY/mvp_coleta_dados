import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import RotaProtegida from './components/RotaProtegida';
import RotaAdministrador from './components/RotaAdministrador';
import FormularioPublico from './pages/FormularioPublico';
import Login from './pages/Login';
import ContatosAdministrativos from './pages/ContatosAdministrativos';
import DetalhesContato from './pages/DetalhesContato';
import CadastroManual from './pages/CadastroManual';
import ImportacaoContatos from './pages/ImportacaoContatos';
import Relatorios from './pages/Relatorios';
import DashboardAdministrativo from './pages/DashboardAdministrativo';
import UsuariosAdministrativos from './pages/UsuariosAdministrativos';
import PaginaNaoEncontrada from './pages/PaginaNaoEncontrada';
import EventosAdministrativos from './pages/EventosAdministrativos';
import SolicitacoesExclusao from './pages/SolicitacoesExclusao';
import BackupsAdministrativos from './pages/BackupsAdministrativos';

function TituloDaPagina() {
  const localizacao = useLocation();

  useEffect(function () {
    if (localizacao.pathname === '/participar' || localizacao.pathname === '/') {
      document.title = 'Acorda VK';
      return;
    }

    if (localizacao.pathname === '/login') {
      document.title = 'Acesso administrativo | Central de Comunicação';
      return;
    }

    document.title = 'Central de Comunicação';
  }, [localizacao.pathname]);

  return null;
}

function App() {
  return (
    <>
      <TituloDaPagina />
      <Routes>
        <Route path="/" element={<Navigate to="/participar" replace />} />
        <Route path="/participar" element={<FormularioPublico />} />
        <Route path="/login" element={<Login />} />

        <Route element={<RotaProtegida />}>
          <Route path="/admin" element={<DashboardAdministrativo />} />
          <Route path="/admin/contatos" element={<ContatosAdministrativos />} />
          <Route path="/admin/contatos/:id" element={<DetalhesContato />} />
          <Route path="/admin/contatos/novo" element={<CadastroManual />} />
          <Route path="/admin/importacoes" element={<ImportacaoContatos />} />
          <Route path="/admin/relatorios" element={<Relatorios />} />
          <Route path="/admin/eventos" element={<EventosAdministrativos />} />
          <Route element={<RotaAdministrador />}>
            <Route path="/admin/usuarios" element={<UsuariosAdministrativos />} />
            <Route path="/admin/solicitacoes-exclusao" element={<SolicitacoesExclusao />} />
            <Route path="/admin/backups" element={<BackupsAdministrativos />} />
          </Route>
        </Route>

        <Route path="*" element={<PaginaNaoEncontrada />} />
      </Routes>
    </>
  );
}

export default App;
