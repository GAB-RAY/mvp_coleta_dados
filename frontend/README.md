# Frontend — A Voz do Bairro

Interface React/Vite do formulário público e da administração do projeto. Todas as telas usam a API real; não há dados simulados nem integração com ManyChat ou WhatsApp.

## Instalação

```bash
npm install
```

Crie `.env`:

```env
VITE_API_URL=http://localhost:3000
```

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
| `/admin/contatos` | JWT | Listagem, filtros, ordenação e paginação. |
| `/admin/contatos/novo` | JWT | Cadastro manual. |
| `/admin/contatos/:id` | JWT | Detalhes e históricos. |
| `/admin/importacoes` | JWT | Pré-visualização e confirmação CSV/XLSX. |
| `/admin/relatorios` | JWT | Agregações e exportação CSV. |
| `*` | Público | Página não encontrada. |

## Formulário público

O layout mantém a identidade **A VOZ DO BAIRRO**, Laranja Neon `#FF5C00`, apresenta Diogo Ventura como responsável e usa uma coluna para preenchimento rápido.

Campos:

- nome completo;
- telefone;
- idade obrigatória de 16 a 120;
- bairro pesquisável, com seleção do catálogo do Rio de Janeiro;
- categoria da principal necessidade;
- descrição complementar opcional;
- pergunta opcional “Você votou na última eleição?”;
- aceite obrigatório do Aviso de Privacidade;
- autorizações independentes e opcionais para mensagens e ligações.

Todos os checkboxes iniciam desmarcados. Autorizações desmarcadas não impedem o envio e não são presumidas como recusa.

As categorias são carregadas de `GET /api/publico/contatos/opcoes`; o catálogo local funciona somente como fallback visual. O backend é a validação definitiva.

O formulário mostra carregamento, sucesso e erro sem recarregar a página. A mensagem oficial de sucesso vem da API. Para telefone existente, a tela recebe a mesma resposta neutra e não expõe dados anteriores.

## Login e sessão

O login envia email e senha para `/api/autenticacao/login`. O JWT é guardado em `localStorage` pela chave `tokenAdministrativo` e anexado como Bearer nas chamadas protegidas.

Uma resposta `401` remove o token e redireciona para `/login`. O botão Sair remove a sessão local.

## Administração

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

### Cadastro manual

Usuários autenticados podem criar ou atualizar contato. A tela exige origem e status. As autorizações aceitam “Não informado”, “Autorizado” e “Recusado explicitamente”. O aceite de privacidade possui checkbox separado.

Ao salvar, a interface abre o detalhe do contato. O backend registra alterações de dados preenchidos no histórico.

### Importação

A tela aceita CSV/XLSX de até 5 MB e 5000 linhas, exige o nome da origem da lista e apresenta até 100 linhas da validação antes da confirmação.

Depois da confirmação, mostra totais recebidos, criados, complementados, ignorados, duplicados e inválidos. A importação não possui campos de consentimento.

### Relatórios

A página agrega os resultados filtrados por:

- bairro;
- categoria;
- faixa etária;
- participação eleitoral;
- origem;
- autorizações;
- dia de cadastro.

O botão Exportar CSV baixa os mesmos contatos filtrados usando a rota autenticada.

## Estrutura principal

```text
src/
  components/
  data/
  pages/
    CadastroManual.jsx
    ContatosAdministrativos.jsx
    DetalhesContato.jsx
    FormularioPublico.jsx
    ImportacaoContatos.jsx
    Login.jsx
    PaginaNaoEncontrada.jsx
    Relatorios.jsx
  services/
    api.js
    autenticacaoService.js
    contatoService.js
    relatorioService.js
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
- origens;
- cadastro manual;
- pré-visualização/confirmação de importação;
- resumo e exportação de relatórios.

O cliente compartilhado envia JSON ou `FormData`, injeta o Bearer token, trata respostas não JSON, falhas de conexão e `AbortController`.

## Validação executada

O build final foi aprovado com Vite 8.1.5 e 52 módulos transformados. A regressão do backend aprovou 94 verificações de fluxos, além dos checks estruturais da Fase 1. Não foram encontrados arquivos TypeScript nem arrow functions em `src`.

## Fora do escopo

Não existem ManyChat, WhatsApp/Meta, webhook, campanhas, disparos, SMS, email, chatbox, recuperação de senha ou gráficos complexos.
