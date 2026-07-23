# Frontend — Central de Comunicação

Interface React/Vite do projeto A Voz do Bairro. O frontend consome somente rotas reais do backend e não usa dados simulados.

## Instalação

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Variáveis:

```env
VITE_API_URL=http://localhost:3000
VITE_WHATSAPP_NUMERO=5521999999999
```

O WhatsApp deve conter país, DDD e número, somente com dígitos. Reinicie o Vite após mudar o `.env`. O botão abre `wa.me` em nova aba e não envia o formulário automaticamente.

## Páginas

| Rota | Acesso | Função |
|---|---|---|
| `/participar` | público | Formulário responsivo e contexto do evento ativo ou cadastro geral. |
| `/login` | público | Login administrativo. |
| `/admin` | JWT | Visão geral. |
| `/admin/contatos` | operador/admin | Busca, filtros, evento e paginação. |
| `/admin/contatos/:id` | operador/admin | Dados, eventos, histórico, revogações e pedido de exclusão. |
| `/admin/contatos/novo` | operador/admin | Cadastro e edição manual. |
| `/admin/importacoes` | operador/admin | Pré-visualização e confirmação CSV/XLSX. |
| `/admin/relatorios` | operador/admin | Indicadores e gráficos; CSV e Excel aparecem somente para admin. |
| `/admin/backups` | admin | Geração, download e histórico auditado de backups do PostgreSQL. |
| `/admin/eventos` | admin | Criar, editar rascunho, ativar e encerrar eventos. |
| `/admin/solicitacoes-exclusao` | admin | Aprovar com exclusão física ou rejeitar pedidos. |
| `/admin/usuarios` | admin | Criar usuários e redefinir senhas. |

## Formulário público

Campos atuais:

- nome;
- telefone;
- bairro selecionado no catálogo carregado do backend;
- idade entre 16 e 120;
- categoria do problema;
- autorização opcional para mensagens;
- autorização opcional para ligações;
- aceite obrigatório do Aviso de Privacidade.

O formulário não exibe descrição do problema nem pergunta eleitoral. O mesmo link é usado sempre. Quando existe evento ativo, a tela informa o vínculo; sem evento, informa que é um cadastro geral do projeto e continua aceitando o envio.

## Painel e permissões

Operadores e administradores podem cadastrar, editar, consultar, revogar consentimentos e solicitar exclusão. Somente administradores veem gestão de eventos, usuários, fila de exclusões e backups. Os botões de exportação CSV e Excel também aparecem somente para administrador.

Ao gerar um backup, o frontend baixa o arquivo retornado pelo backend e exibe o hash SHA-256. O histórico informa responsável, data, estado, tamanho e hash, sem expor credenciais do banco.

Os arquivos possuem nomes distintos: o backup restaurável usa `a-voz-do-bairro-backup-completo-postgresql-AAAA-MM-DD_HH-mm-ss.backup`; as planilhas usam `a-voz-do-bairro-contatos-AAAA-MM-DD_HH-mm-ss.xlsx` ou `.csv`.

Sessões expiradas removem o token local e redirecionam ao login. O frontend esconde ações sem permissão, mas a autorização definitiva é sempre conferida pelo backend.

## Build

```powershell
npm run build
```

Resultado de 23/07/2026: Vite 8.1.5, 61 módulos transformados e build concluído.

## Vercel

1. Publique a pasta `frontend`.
2. Configure `VITE_API_URL` com a URL HTTPS do backend.
3. Configure `VITE_WHATSAPP_NUMERO`.
4. Faça novo deploy após alterar variáveis.
5. Configure `FRONTEND_URL` no backend com o domínio final da Vercel.
