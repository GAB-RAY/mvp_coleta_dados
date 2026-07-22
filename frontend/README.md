# Frontend — A Voz do Bairro

Interface React/Vite do formulário público e da administração do projeto. Todas as telas usam a API real; não há dados simulados nem integração com ManyChat ou WhatsApp.

## Tecnologias e dependências

| Dependência | Função |
| --- | --- |
| React | Componentes e estado das telas. |
| React DOM | Renderização no navegador. |
| React Router DOM | Rotas públicas, protegidas e administrativas. |
| Vite | Desenvolvimento e build de produção. |

O frontend usa JavaScript, CSS responsivo e a API Fetch nativa. Não usa TypeScript nem dados simulados.

## Instalação

```bash
npm install
```

Crie `.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_WHATSAPP_NUMERO=5521999999999
```

`VITE_WHATSAPP_NUMERO` deve conter somente o número com código do país e DDD. Não use `+`, espaços, parênteses ou hífen. Quando estiver ausente ou inválido, o link não é exibido. Reinicie o Vite depois de alterar o `.env`.

No backend, mantenha `FRONTEND_URL=http://localhost:5173`. `localhost` e `127.0.0.1` são origens CORS diferentes.

## Executar

```bash
npm run dev -- --host localhost --port 5173 --strictPort
```

Acesse `http://localhost:5173/participar`.

Build:

```bash
npm run build
```

## Rotas

| Rota | Acesso | Função |
| --- | --- | --- |
| `/` | Público | Redireciona para `/participar`. |
| `/participar` | Público | Formulário A Voz do Bairro. |
| `/login` | Público | Login administrativo. |
| `/admin` | JWT | Visão geral da Central de Comunicação. |
| `/admin/contatos` | JWT | Listagem, filtros, ordenação e paginação. |
| `/admin/contatos/novo` | JWT | Cadastro manual ou edição preenchida por query string. |
| `/admin/contatos/:id` | JWT | Detalhes, históricos, revogações e pedido de exclusão. |
| `/admin/importacoes` | JWT | Pré-visualização e confirmação CSV/XLSX. |
| `/admin/relatorios` | JWT | Agregações e exportação CSV. |
| `/admin/usuarios` | Administrador | Cadastro, listagem e redefinição de senhas da equipe. |
| `*` | Público | Página não encontrada. |

## Formulário público

O layout mantém a identidade **A VOZ DO BAIRRO**, Laranja Neon `#FF5C00`, apresenta Diogo Ventura como responsável e usa uma coluna para preenchimento rápido.

Campos:

- nome completo;
- telefone;
- idade obrigatória de 16 a 120;
- bairro pesquisável, com seleção entre os 166 bairros retornados pelo backend;
- categoria da principal necessidade;
- aceite obrigatório do Aviso de Privacidade;
- autorizações independentes e opcionais para mensagens e ligações.

Todos os checkboxes iniciam desmarcados. Autorizações desmarcadas não impedem o envio e não são presumidas como recusa.

Os bairros e as categorias são carregados de `GET /api/publico/contatos/opcoes`. Não existe lista duplicada no frontend: se o catálogo da API estiver indisponível, o envio fica bloqueado e a tela informa o erro. O backend e o relacionamento no PostgreSQL são as validações definitivas.

O formulário mostra carregamento, sucesso e erro sem recarregar a página. A mensagem oficial de sucesso vem da API. Para telefone existente, a tela recebe a mesma resposta neutra e não expõe dados anteriores.

O botão pequeno “Falar pelo WhatsApp” abre uma conversa em nova aba usando exclusivamente o número configurado em `VITE_WHATSAPP_NUMERO`. Ele não envia dados do formulário nem mensagens automaticamente.

## Login e sessão

O login envia email e senha para `/api/autenticacao/login`. O JWT é guardado em `localStorage` pela chave `tokenAdministrativo` e anexado como Bearer nas chamadas protegidas.

Uma resposta `401` remove o token e redireciona para `/login`. O botão Sair remove a sessão local.

O formulário público não mostra link para o login. A equipe acessa `/login` diretamente. Respostas `429` informam bloqueio temporário por excesso de tentativas. O frontend guarda também os dados básicos do usuário para apresentar nome, perfil e opções permitidas; a autorização definitiva permanece no backend.

## Administração

A área administrativa usa a identidade **Central de Comunicação**: menu lateral laranja, fundo claro, cartões compactos e navegação responsiva. O menu também oferece acesso ao formulário público em uma nova aba. A visão geral consome exclusivamente as APIs reais e apresenta total de contatos, bairros alcançados, autorizações de mensagens, distribuições por bairro e necessidade, contatos recentes e atalhos operacionais.

Em notebooks, a navegação permanece na lateral. Em telas menores, o menu passa para o topo com rolagem horizontal e os indicadores, gráficos e painéis são reorganizados em uma coluna.

### Listagem

A listagem exibe telefone, idade, bairro, categoria, autorizações, origem, status e data. Cada linha possui acesso aos detalhes.

Filtros:

- nome e telefone;
- bairro e categoria;
- idade mínima e máxima;
- participação na última eleição;
- origem e status;
- autorização de mensagens e ligações;
- período de cadastro;
- ordenação por data ou nome.

A paginação usa 20 registros. Existem estados de carregamento, vazio, erro e nova tentativa.

### Detalhes

A página de detalhe mostra:

- dados cadastrais e origem;
- aceites de privacidade com texto e versão;
- consentimentos legados e autorizações novas;
- histórico com campos alterados, origem, usuário e data.

Na mesma tela, o usuário autenticado pode revogar mensagens, ligações ou ambas. Cada ação pede confirmação, registra responsável, data e hora e atualiza os bloqueios do contato. Também é possível registrar um pedido de exclusão; o contato não é apagado, mas fica bloqueado para mensagens, ligações e campanhas. Repetir uma ação já registrada não cria histórico duplicado.

O campo “Motivo da revogação” é opcional e aceita até 500 caracteres. Quando preenchido, aparece junto do evento no histórico de consentimentos.

O botão **Editar contato** abre o cadastro manual já preenchido. Operadores e administradores podem editar; telefone e origem ficam desabilitados para evitar duplicidade acidental.

### Cadastro manual

Operadores e administradores podem criar ou atualizar contato. A tela exige origem e status e não solicita descrição complementar do problema. As autorizações aceitam “Não informado”, “Autorizado” e “Recusado explicitamente”. O aceite de privacidade possui checkbox separado.

Ao salvar, a interface abre o detalhe do contato. O backend registra alterações de dados preenchidos no histórico.

### Importação

A tela aceita CSV/XLSX de até 5 MB e 5000 linhas, exige o nome da origem da lista e apresenta até 100 linhas da validação antes da confirmação.

Depois da confirmação, mostra totais recebidos, criados, complementados, ignorados, duplicados e inválidos. Bairro preenchido fora do catálogo oficial torna a linha inválida; bairro vazio continua permitido na importação. A importação não possui campos de consentimento.

### Relatórios

A página agrega os resultados filtrados por:

- bairro;
- categoria;
- faixa etária;
- participação eleitoral;
- origem;
- autorizações;
- dia de cadastro.

Os resultados são apresentados em indicadores e gráficos de barras responsivos, com quantidade e percentual. Bairros e categorias exibem os dez maiores resultados; os cartões menores mostram os principais segmentos e a evolução recente. Todos os gráficos usam a resposta real do resumo administrativo e são atualizados pelos mesmos filtros da exportação.

O botão Exportar CSV baixa os mesmos contatos filtrados usando a rota autenticada.

### Usuários

Somente administradores visualizam **Usuários** no menu. A tela permite:

- consultar nome, email, perfil, status e data de criação;
- criar um operador;
- criar outro administrador;
- validar email duplicado;
- exigir senha inicial com pelo menos 12 caracteres;
- redefinir a senha de operadores e de outros administradores.

Cada usuário diferente da conta atual possui a ação **Redefinir senha**, com nova senha e confirmação. A conta administrativa atual aparece identificada e não pode redefinir a própria senha por essa tela. Operadores que tentem acessar a rota diretamente são redirecionados no frontend e recebem `403` na API. O frontend nunca recebe nem exibe hashes de senha.

## Estrutura principal

```text
src/
  components/
  data/
  pages/
    CadastroManual.jsx
    ContatosAdministrativos.jsx
    DashboardAdministrativo.jsx
    DetalhesContato.jsx
    FormularioPublico.jsx
    ImportacaoContatos.jsx
    Login.jsx
    PaginaNaoEncontrada.jsx
    Relatorios.jsx
    UsuariosAdministrativos.jsx
  services/
    api.js
    autenticacaoService.js
    contatoService.js
    relatorioService.js
    usuarioService.js
  styles/
  utils/
  App.jsx
  main.jsx
```

## Responsividade e acessibilidade

- formulário público em uma coluna;
- filtros em 4, 2 ou 1 coluna conforme a largura;
- detalhes e relatórios em 2 colunas no notebook e 1 no celular;
- tabelas com rolagem horizontal;
- labels associados, foco visível, `aria-live` e navegação por teclado no bairro;
- respeito a `prefers-reduced-motion`;
- textos longos com quebra segura.

## APIs consumidas

- cadastro/opções públicas;
- login;
- listagem e detalhe de contatos;
- revogação de consentimentos e solicitação de exclusão;
- origens;
- cadastro manual;
- pré-visualização/confirmação de importação;
- resumo e exportação de relatórios.
- listagem, criação e redefinição de senha de usuários por administradores.

O cliente compartilhado envia JSON ou `FormData`, injeta o Bearer token, trata respostas não JSON, falhas de conexão e `AbortController`.

## Publicação na Vercel

Use:

- Root Directory: `frontend`;
- Framework: Vite;
- Build Command: `npm run build`;
- Output Directory: `dist`;
- `VITE_API_URL`: URL HTTPS do backend;
- `VITE_WHATSAPP_NUMERO`: país, DDD e número somente com dígitos.

O arquivo `vercel.json` contém o rewrite de SPA necessário para abrir rotas como `/participar`, `/login` e `/admin/contatos/1` diretamente. Variáveis `VITE_*` são aplicadas durante o build; depois de alterá-las na Vercel, faça um novo deploy.

O procedimento completo, incluindo PostgreSQL e App Platform, está no [README principal](../README.md#publicação-passo-a-passo).

## Validação executada

O build final foi aprovado com Vite 8.1.5 e 55 módulos transformados. A regressão do backend no banco consolidado aprovou 233 verificações, incluindo catálogo de bairros, redefinição administrativa de senha e as proteções estruturais preparadas para campanhas futuras. Não foram encontrados arquivos TypeScript.

## Fora do escopo

O frontend ainda não possui ManyChat, API do WhatsApp/Meta, webhook, telas de campanhas, disparos, SMS, email, chatbox ou recuperação de senha. O banco possui apenas a preparação estrutural para integração futura. O WhatsApp disponível é somente um link público configurável.
