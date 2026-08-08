import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CabecalhoAdministrativo from '../components/CabecalhoAdministrativo';
import Carregando from '../components/Carregando';
import MensagemRetorno from '../components/MensagemRetorno';
import { gerarBackup, listarBackups } from '../services/backupService';
import { removerToken } from '../utils/armazenamentoToken';

function formatarData(valor) {
  if (!valor) {
    return '—';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(valor));
}

function formatarTamanho(valor) {
  const bytes = Number(valor || 0);
  if (!bytes) {
    return '—';
  }
  return (bytes / 1024 / 1024).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' MB';
}

function BackupsAdministrativos() {
  const navegacao = useNavigate();
  const [backups, setBackups] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState('informacao');

  async function carregar() {
    setCarregando(true);
    try {
      const resposta = await listarBackups();
      setBackups(resposta.backups || []);
    } catch (erro) {
      if (erro.statusHttp === 401) {
        removerToken();
        navegacao('/login', { replace: true });
      } else {
        setTipoMensagem('erro');
        setMensagem(erro.message);
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(function () {
    carregar();
  }, []);

  async function baixarBackup() {
    if (!window.confirm('Gerar e baixar agora um backup dos dados do sistema?')) {
      return;
    }

    setGerando(true);
    setMensagem('');
    try {
      const resultado = await gerarBackup();
      const url = URL.createObjectURL(resultado.arquivo);
      const link = document.createElement('a');
      link.href = url;
      link.download = resultado.nomeArquivo;
      link.click();
      URL.revokeObjectURL(url);
      setTipoMensagem('sucesso');
      setMensagem(
        'Backup baixado com sucesso.' +
        (resultado.sha256 ? ' SHA-256: ' + resultado.sha256 : '')
      );
      await carregar();
    } catch (erro) {
      if (erro.statusHttp === 401) {
        removerToken();
        navegacao('/login', { replace: true });
      } else {
        setTipoMensagem('erro');
        setMensagem(erro.message);
      }
    } finally {
      setGerando(false);
    }
  }

  function sair() {
    removerToken();
    navegacao('/login', { replace: true });
  }

  return (
    <main className="pagina-administrativa">
      <div className="conteudo-administrativo">
        <CabecalhoAdministrativo
          aoSair={sair}
          titulo="Backups"
          subtitulo="Baixe uma cópia de todos os registros armazenados no sistema."
        />

        <section className="cartao painel-filtros">
          <div className="cabecalho-secao">
            <div>
              <span className="etiqueta-pagina">Proteção dos dados</span>
              <h2>Backup dos dados</h2>
            </div>
            <p>Baixa um arquivo SQL legível com contatos, usuários, eventos, campanhas, importações e históricos, sem criar banco ou tabelas.</p>
          </div>
          <button className="botao botao-primario" type="button" disabled={gerando} onClick={baixarBackup}>
            {gerando ? 'Gerando backup dos dados...' : 'Gerar e baixar dados'}
          </button>
        </section>

        <MensagemRetorno mensagem={mensagem} tipo={tipoMensagem} />

        <section className="cartao painel-resultados">
          <div className="cabecalho-resultados"><div><h2>Histórico</h2><p>Últimas 50 operações.</p></div></div>
          {carregando && <Carregando mensagem="Carregando histórico..." />}
          {!carregando && backups.length === 0 && <p className="estado-vazio">Nenhum backup gerado.</p>}
          {!carregando && backups.length > 0 && (
            <div className="tabela-responsiva">
              <table className="tabela-contatos">
                <thead><tr><th>Arquivo</th><th>Status</th><th>Tamanho</th><th>Administrador</th><th>Data</th><th>SHA-256</th></tr></thead>
                <tbody>
                  {backups.map(function (backup) {
                    return (
                      <tr key={backup.id}>
                        <td>{backup.nomeArquivo || 'Não gerado'}</td>
                        <td>{backup.status}</td>
                        <td>{formatarTamanho(backup.tamanhoBytes)}</td>
                        <td>{backup.usuario || 'Usuário removido'}</td>
                        <td>{formatarData(backup.concluidoEm || backup.criadoEm)}</td>
                        <td className="texto-hash-backup" title={backup.sha256 || backup.mensagemErro || ''}>{backup.sha256 || backup.mensagemErro || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default BackupsAdministrativos;
