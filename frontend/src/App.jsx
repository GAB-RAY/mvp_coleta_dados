import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import RotaProtegida from './components/RotaProtegida';
import RotaAdministrador from './components/RotaAdministrador';
import FormularioPublico from './pages/FormularioPublico';
import Login from './pages/Login';
import ContatosAdministrativos from './pages/ContatosAdministrativos';
import DetalhesContato from './pages/DetalhesContato';
import CadastroManual from './pages/CadastroManual';
import CampanhasAdministrativas from './pages/CampanhasAdministrativas';
import ImportacaoContatos from './pages/ImportacaoContatos';
import Relatorios from './pages/Relatorios';
import DashboardAdministrativo from './pages/DashboardAdministrativo';
import UsuariosAdministrativos from './pages/UsuariosAdministrativos';
import PaginaNaoEncontrada from './pages/PaginaNaoEncontrada';
import EventosAdministrativos from './pages/EventosAdministrativos';
import SolicitacoesExclusao from './pages/SolicitacoesExclusao';
import BackupsAdministrativos from './pages/BackupsAdministrativos';
import Privacidade from './pages/Privacidade';
import Termos from './pages/Termos';
import ExcluirDados from './pages/ExcluirDados';
import AjudaAdministrativa from './pages/AjudaAdministrativa';

function TituloDaPagina() {
  const localizacao = useLocation();

  useEffect(function () {
    if (localizacao.pathname === '/participar' || localizacao.pathname === '/') {
      document.title = 'Acorda RJ';
      return;
    }

    if (localizacao.pathname === '/login') {
      document.title = 'Acesso administrativo | ACORDA RJ';
      return;
    }

    const titulosPublicos = {
      '/privacidade': 'Política de Privacidade | Acorda RJ',
      '/termos': 'Termos de Uso | Acorda RJ',
      '/excluir-dados': 'Excluir dados | Acorda RJ'
    };

    if (titulosPublicos[localizacao.pathname]) {
      document.title = titulosPublicos[localizacao.pathname];
      return;
    }

    document.title = 'ACORDA RJ';
  }, [localizacao.pathname]);

  useEffect(function () {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [localizacao.pathname, localizacao.search]);

  return null;
}

function App() {
  return (
    <>
      <TituloDaPagina />
      <Routes>
        <Route path="/" element={<Navigate to="/participar" replace />} />
        <Route path="/participar" element={<FormularioPublico />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/excluir-dados" element={<ExcluirDados />} />
        <Route path="/login" element={<Login />} />

        <Route element={<RotaProtegida />}>
          <Route path="/admin" element={<DashboardAdministrativo />} />
          <Route path="/admin/contatos" element={<ContatosAdministrativos />} />
          <Route path="/admin/contatos/:id" element={<DetalhesContato />} />
          <Route path="/admin/contatos/novo" element={<CadastroManual />} />
          <Route path="/admin/campanhas" element={<CampanhasAdministrativas />} />
          <Route path="/admin/importacoes" element={<ImportacaoContatos />} />
          <Route path="/admin/relatorios" element={<Relatorios />} />
          <Route path="/admin/eventos" element={<EventosAdministrativos />} />
          <Route path="/admin/ajuda" element={<AjudaAdministrativa />} />
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
