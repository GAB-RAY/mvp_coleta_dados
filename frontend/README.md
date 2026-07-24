# Frontend — Central de Comunicação

Interface React/Vite do projeto Acorda VK. O frontend consome somente rotas reais do backend e não usa dados simulados.

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
| `/participar` | público | Formulário responsivo; o contexto adicional aparece somente com evento ativo. |
| `/login` | público | Login administrativo. |
| `/admin` | JWT | Visão geral. |
| `/admin/contatos` | operador/admin | Busca, filtros, evento e paginação. |
| `/admin/contatos/:id` | operador/admin | Dados, eventos, histórico, revogações e pedido de exclusão. |
| `/admin/contatos/novo` | operador/admin | Cadastro e edição manual. |
| `/admin/importacoes` | operador/admin | Pré-visualização e confirmação CSV/XLSX. |
| `/admin/relatorios` | operador/admin | Indicadores e gráficos; CSV e Excel aparecem somente para admin. |
| `/admin/backups` | admin | Geração, download e histórico auditado de backups do PostgreSQL. |
| `/admin/eventos` | operador/admin | Operador consulta eventos e participantes; administrador também cria, edita, ativa e encerra. |
| `/admin/solicitacoes-exclusao` | admin | Aprovar com exclusão física ou rejeitar pedidos. |
| `/admin/usuarios` | admin | Definir o próprio nome, criar operadores/administradores e redefinir senhas de operadores. |

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

O formulário não exibe descrição do problema. O mesmo link é usado sempre. Sem evento ativo, o cadastro completo continua funcionando normalmente e não mostra aviso adicional.

O visual público usa a identidade `Acorda VK`, cabeçalho laranja, apresentação destacada e laterais com elementos laranja discretos. Nome, bairro e categoria ocupam a largura total; telefone e idade ficam lado a lado quando houver espaço e são empilhados no celular. A aba do formulário mostra `Acorda VK`, enquanto login e painel usam `Central de Comunicação`.

Quando existe evento ativo, a primeira etapa solicita somente nome completo e telefone. Se o telefone não existir, o formulário completo é aberto com os dois campos preservados. Se ambos corresponderem a um contato existente, a tela permite confirmar a inscrição sem mostrar dados pessoais nem exigir novamente bairro, idade, categoria ou consentimentos. Nome divergente não cria contato nem vínculo. Se a inscrição já existir, a tela apenas informa o resultado sem duplicar o registro.

Depois da identificação, `Meus dados mudaram` abre o formulário completo. O telefone fica bloqueado, os dados declarados são enviados com o nome usado na confirmação e o backend registra as alterações no histórico antes de concluir o vínculo.

O identificador do evento exibido acompanha o envio. Se o administrador trocar ou encerrar o evento enquanto a pessoa preenche, o backend retorna `409`; o frontend atualiza o contexto, mantém os campos preenchidos e pede um novo envio consciente.

## Painel e permissões

Operadores e administradores podem cadastrar, editar, consultar, revogar consentimentos, solicitar exclusão e abrir a tela de eventos. Para operador, eventos são somente leitura e permitem acessar participantes. Somente administradores veem os controles de criação, edição, ativação e encerramento, além de usuários, fila de exclusões e backups. Os botões de exportação CSV e Excel também aparecem somente para administrador.

Na tela de eventos, o botão `Ver participantes` abre a listagem de contatos com o evento previamente selecionado. Os campos de nome e telefone continuam disponíveis para conferir rapidamente a inscrição.

Na gestão de usuários, o administrador pode atualizar o próprio nome e criar contas com perfil de operador ou administrador. Outros administradores aparecem protegidos e não podem ter seus dados ou senha alterados; a redefinição administrativa de senha fica disponível somente para operadores.

Contatos importados somente com telefone mantêm nome, bairro, idade e categoria como `NULL` no banco. Na listagem, nos detalhes e na pré-visualização da importação, esses valores ausentes aparecem visualmente como “Não informado”, permitindo complementação futura sem confundir o texto com um dado real.

A importação aceita um único arquivo CSV ou XLSX com até 5 MB e 20.000 linhas. Durante a confirmação, o botão permanece bloqueado e informa que a importação está em andamento.

Ao gerar um backup, o frontend baixa o arquivo retornado pelo backend e exibe o hash SHA-256. O histórico informa responsável, data, estado, tamanho e hash, sem expor credenciais do banco.

Os arquivos possuem nomes distintos: o backup restaurável usa `acorda-vk-backup-completo-postgresql-AAAA-MM-DD_HH-mm-ss.backup`; as planilhas usam `acorda-vk-contatos-AAAA-MM-DD_HH-mm-ss.xlsx` ou `.csv`.

Sessões expiradas removem o token local e redirecionam ao login. O frontend esconde ações sem permissão, mas a autorização definitiva é sempre conferida pelo backend.

Consultas `GET` repetem automaticamente falhas transitórias de conexão ou respostas 502/503/504, usando atrasos progressivos. Envios e alterações não são repetidos automaticamente, evitando duplicação acidental.

Na Vercel, `vercel.json` aplica CSP, bloqueio de iframe, `nosniff`, política de referência, política de permissões e HSTS. A CSP permite comunicação HTTPS com a API e bloqueia scripts, objetos e frames externos.

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
6. Confirme os cabeçalhos de segurança no domínio publicado.

A Vercel informa o domínio final na página do projeto. Use esse mesmo domínio com `/participar` para o formulário e `/login` para o acesso administrativo. O formulário não exibe link para o login.
