import { NavLink } from 'react-router-dom';
import { obterUsuario } from '../utils/armazenamentoToken';

const ITENS_NAVEGACAO = [
  { caminho: '/admin', rotulo: 'Visão geral', icone: 'visao-geral', exato: true },
  { caminho: '/admin/contatos', rotulo: 'Contatos', icone: 'contatos', exato: true },
  { caminho: '/admin/contatos/novo', rotulo: 'Novo cadastro', icone: 'novo' },
  { caminho: '/admin/comunicacoes', rotulo: 'Mensagens', icone: 'comunicacoes' },
  { caminho: '/admin/importacoes', rotulo: 'Importações', icone: 'importacoes' },
  { caminho: '/admin/relatorios', rotulo: 'Relatórios', icone: 'relatorios' },
  { caminho: '/admin/eventos', rotulo: 'Eventos', icone: 'eventos' },
  { caminho: '/admin/solicitacoes-exclusao', rotulo: 'Exclusões', icone: 'exclusoes', somenteAdmin: true },
  { caminho: '/admin/backups', rotulo: 'Backups', icone: 'backups', somenteAdmin: true },
  { caminho: '/admin/usuarios', rotulo: 'Usuários', icone: 'usuarios', somenteAdmin: true },
  { caminho: '/participar', rotulo: 'Formulário público', icone: 'formulario', novaAba: true }
];

function IconeNavegacao(propriedades) {
  if (propriedades.nome === 'visao-geral') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }

  if (propriedades.nome === 'contatos') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.4-3.2 2.2-5 5.5-5s5.1 1.8 5.5 5" />
        <path d="M16 5.5h5M17 10h4M17 14.5h4" />
      </svg>
    );
  }

  if (propriedades.nome === 'novo') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10" cy="8" r="3" />
        <path d="M4 19c.4-3.2 2.3-5 6-5 1.2 0 2.3.2 3.1.6" />
        <path d="M18 13v8M14 17h8" />
      </svg>
    );
  }

  if (propriedades.nome === 'comunicacoes') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
        <path d="M4 15v5h16v-5" />
      </svg>
    );
  }

  if (propriedades.nome === 'importacoes') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
        <path d="M4 15v5h16v-5" />
      </svg>
    );
  }

  if (propriedades.nome === 'formulario') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h9l4 4v14H6V3Z" />
        <path d="M14 3v5h5M9 12h7M9 16h7" />
      </svg>
    );
  }

  if (propriedades.nome === 'usuarios') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.4-3.2 2.2-5 5.5-5s5.1 1.8 5.5 5" />
        <circle cx="17.5" cy="9" r="2.3" />
        <path d="M16 14c2.9 0 4.5 1.6 4.8 4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20V7" />
      <path d="M2 20h22" />
    </svg>
  );
}

function obterClasseLink(dados) {
  return dados.isActive
    ? 'link-navegacao-admin link-navegacao-admin-ativo'
    : 'link-navegacao-admin';
}

function CabecalhoAdministrativo(propriedades) {
  const titulo = propriedades.titulo || 'Visão geral';
  const subtitulo = propriedades.subtitulo || 'Acompanhe os dados da Central de Comunicação.';
  const usuario = obterUsuario();
  const usuarioAdministrador = usuario && usuario.perfil === 'administrador';
  const itensPermitidos = ITENS_NAVEGACAO.filter(function (item) {
    return !item.somenteAdmin || usuarioAdministrador;
  });
  const nomeUsuario = usuario && usuario.nome ? usuario.nome : 'Usuário';
  const perfilUsuario = usuario && usuario.perfil === 'administrador'
    ? 'Administrador'
    : 'Operador';
  const inicialUsuario = nomeUsuario.charAt(0).toUpperCase();

  return (
    <>
      <aside className="barra-lateral-admin">
        <div className="marca-admin">
          <span className="simbolo-marca-admin" aria-hidden="true">CC</span>
          <div>
            <strong>Central de</strong>
            <span>Comunicação</span>
          </div>
        </div>

        <nav className="navegacao-admin" aria-label="Navegação administrativa">
          <span className="rotulo-navegacao-admin">Gestão</span>
          {itensPermitidos.map(function (item) {
            return (
              <NavLink
                className={obterClasseLink}
                end={item.exato}
                key={item.caminho}
                rel={item.novaAba ? 'noopener noreferrer' : undefined}
                target={item.novaAba ? '_blank' : undefined}
                to={item.caminho}
              >
                <IconeNavegacao nome={item.icone} />
                <span>{item.rotulo}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="rodape-barra-admin">
          <span className="rotulo-navegacao-admin">Projeto</span>
          <p>Acorda VK</p>
          <button type="button" className="botao-sair-admin" onClick={propriedades.aoSair}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 4H4v16h6M15 8l4 4-4 4M8 12h11" />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      <header className="cabecalho-administrativo">
        <div>
          <span className="etiqueta-cabecalho-admin">Central de Comunicação</span>
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
        </div>

        <div className="usuario-cabecalho-admin" aria-label="Usuário conectado">
          <span className="icone-notificacao-admin" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
            </svg>
          </span>
          <span className="avatar-admin" aria-hidden="true">{inicialUsuario}</span>
          <span>
            <strong>{nomeUsuario}</strong>
            <small>{perfilUsuario}</small>
          </span>
        </div>
      </header>
    </>
  );
}

export default CabecalhoAdministrativo;
