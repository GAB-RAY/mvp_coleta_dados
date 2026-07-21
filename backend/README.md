# Backend — A Voz do Bairro

API do MVP de participação cidadã. Recebe o formulário público, registra consentimentos auditáveis, autentica administradores e oferece uma listagem protegida com filtros e paginação.

## Tecnologias e regras

- Node.js e Express 5;
- PostgreSQL com o pacote `pg`;
- CommonJS com `require` e `module.exports`;
- SQL parametrizado, sem ORM;
- `bcrypt` para senhas;
- `jsonwebtoken` para JWT;
- `helmet`, `cors` e `dotenv`;
- funções tradicionais e nomes explícitos em português.

Não são usados TypeScript, Prisma ou Sequelize.

## Funcionalidades atuais

- `GET /api/teste` para testar API e PostgreSQL;
- cadastro público de contatos;
- telefone normalizado e protegido contra duplicidade;
- três consentimentos independentes no formulário público;
- estados de consentimento `true`, `false` e `null` nos contatos;
- histórico auditável com resposta, texto, versão, canal e data/hora;
- transação única para contato e históricos;
- bloqueio de mensagens calculado a partir do consentimento de WhatsApp;
- criação de administrador por script;
- login com senha bcrypt e geração de JWT;
- autenticação Bearer nas rotas administrativas;
- listagem administrativa com filtros e paginação;
- tratamento padronizado de erros e rotas inexistentes.

O sistema não envia mensagens nem realiza campanhas.

## Arquitetura

O backend é modular por funcionalidade. O fluxo de negócio é:

```text
Route -> Controller -> Service -> Model -> PostgreSQL
```

- Route: declara endpoint, middleware e controller;
- Controller: recebe `req`, `res` e `next` e retorna HTTP;
- Service: valida e aplica regras de negócio;
- Model: executa SQL parametrizado;
- Middleware: autenticação e tratamento compartilhado;
- Utils: utilitários pequenos e reutilizáveis.

```text
backend/
  database/
    migrations/
      003_consentimentos_publicos_e_listagem.sql
  scripts/
    criarAdministrador.js
    executarMigracoes.js
    testarConsentimentos.js
  src/
    config/
      banco.js
      textosConsentimento.js
    middlewares/
      autenticarUsuario.js
      rotaNaoEncontrada.js
      tratarErro.js
    modules/
      autenticacao/
        autenticacaoController.js
        autenticacaoRoutes.js
        autenticacaoService.js
      contatos/
        consentimentoModel.js
        contatoAdminRoutes.js
        contatoController.js
        contatoModel.js
        contatoPublicoRoutes.js
        contatoService.js
      teste/
        testeRoutes.js
      usuarios/
        usuarioModel.js
    utils/
      AppError.js
      normalizarTelefone.js
    app.js
    server.js
  .env.example
  package.json
  README.md
```

## Banco de dados

O banco PostgreSQL já deve existir. O nome usado neste projeto é `criar_banco`.

Antes desta etapa existiam somente `contatos` e `usuarios`. A migração incremental preserva essas tabelas e cria `consentimentos`.

### Campos de consentimento em `contatos`

Os campos atuais de leitura rápida são:

- `consentimento_tratamento_dados`;
- `consentimento_whatsapp`;
- `consentimento_ligacoes`;
- `consentimentos_atualizados_em`;
- `origem_atual`;
- `status_contato`;
- `bloqueado_para_mensagens`;
- `excluido_logicamente`;
- `atualizado_em`.

Os três consentimentos aceitam `NULL`:

- `true`: Sim;
- `false`: Não;
- `null`: Não informado.

Os campos antigos `consentimento_armazenamento` e `consentimento_mensagens` foram preservados para compatibilidade com o schema existente. Novos cadastros mantêm os campos antigos e atuais coerentes.

### Histórico `consentimentos`

Cada resposta apresentada pelo formulário gera um registro com:

- contato e tipo;
- resposta booleana;
- texto apresentado;
- versão do texto;
- canal e origem do registro;
- data/hora;
- indicador de registro ativo;
- usuário responsável, quando aplicável.

Uma constraint permite somente um histórico ativo por contato e tipo. A criação pública do contato e dos históricos ocorre na mesma transação; se um histórico falhar, o contato também é revertido.

Os quatro contatos anteriores à migração foram preservados. Seus históricos foram identificados como `migracao_legado`, canal `migracao`, versão `legado_v1` e texto antigo não registrado. O consentimento de ligações permaneceu `NULL`; nenhum aceite retroativo foi inventado.

### Executar a migração

```bash
npm run banco:migrar
```

A migração usa `BEGIN`, alterações condicionais e índices condicionais. Ela pode ser repetida sem duplicar históricos nem apagar dados. Não há `DROP TABLE`, `TRUNCATE` ou exclusão geral.

## Instalação

Na pasta `backend`:

```bash
npm install
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores locais:

```env
PORTA=3000
DATABASE_URL=postgresql://usuario:senha@localhost:5432/criar_banco
FRONTEND_URL=http://localhost:5173
JWT_SECRET=uma_chave_secreta_grande
JWT_TEMPO_EXPIRACAO=8h
```

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `PORTA` | Não | Porta HTTP; padrão `3000`. |
| `DATABASE_URL` | Recomendada | Conexão PostgreSQL. |
| `FRONTEND_URL` | Sim no navegador | Origem autorizada pelo CORS. |
| `JWT_SECRET` | Sim | Assinatura e validação do JWT. |
| `JWT_TEMPO_EXPIRACAO` | Sim | Validade do JWT, por exemplo `8h`. |

Sem `DATABASE_URL`, a conexão aceita `BANCO_HOST`, `BANCO_PORTA`, `BANCO_USUARIO`, `BANCO_SENHA` e `BANCO_NOME`. A autenticação também reconhece os nomes legados `JWT_SEGREDO` e `JWT_EXPIRACAO`.

Nunca envie `.env` ao repositório.

## Executar

```bash
npm start
```

API padrão: `http://localhost:3000`.

## Criar administrador

```bash
npm run criar-admin -- "Administrador" "admin@email.com" "MinhaSenhaSegura"
```

O script normaliza o email, impede duplicidade, exige senha de pelo menos 8 caracteres, gera hash bcrypt com custo 12 e não imprime senha ou hash.

## Contratos HTTP

### Teste da API

```http
GET /api/teste
```

Resposta `200`:

```json
{
  "sucesso": true,
  "mensagem": "API e banco de dados conectados."
}
```

### Cadastro público

```http
POST /api/publico/contatos
Content-Type: application/json
```

Contrato atual:

```json
{
  "nome": "Maria da Silva",
  "telefone": "(21) 99999-9999",
  "bairro": "Campo Grande",
  "problema": "Iluminação pública",
  "consentimentoTratamentoDados": true,
  "consentimentoWhatsapp": false,
  "consentimentoLigacoes": false
}
```

Validações:

| Campo | Regra |
| --- | --- |
| `nome` | Texto obrigatório de 2 a 150 caracteres. |
| `telefone` | Texto obrigatório, máximo 30 caracteres e 10 a 15 dígitos normalizados. |
| `bairro` | Texto obrigatório de 2 a 150 caracteres. |
| `problema` | Texto obrigatório de 3 a 500 caracteres. |
| `consentimentoTratamentoDados` | Booleano obrigatório e igual a `true`. |
| `consentimentoWhatsapp` | Booleano obrigatório; aceita `true` ou `false`. |
| `consentimentoLigacoes` | Booleano quando apresentado; o frontend atual sempre envia `true` ou `false`. |

Strings como `"true"`, `"false"`, `"sim"` e `"não"` são rejeitadas.

Compatibilidade temporária:

- `consentimentoArmazenamento` é alias de `consentimentoTratamentoDados`;
- `consentimentoMensagens` é alias de `consentimentoWhatsapp`;
- se os nomes novo e antigo forem enviados com valores diferentes, a API retorna `400`;
- clientes antigos sem o campo de ligações geram `consentimentoLigacoes: null` e não criam histórico desse tipo.

Resposta `201`:

```json
{
  "mensagem": "Cadastro realizado com sucesso.",
  "contato": {
    "id": "5",
    "nome": "Maria da Silva",
    "telefone": "(21) 99999-9999",
    "bairro": "Campo Grande",
    "problema": "Iluminação pública",
    "consentimentoArmazenamento": true,
    "consentimentoMensagens": false,
    "consentimentoTratamentoDados": true,
    "consentimentoWhatsapp": false,
    "consentimentoLigacoes": false,
    "origemAtual": "Formulário A Voz do Bairro",
    "statusContato": "ativo",
    "bloqueadoParaMensagens": true,
    "criadoEm": "2026-07-21T12:00:00.000Z"
  }
}
```

O telefone é normalizado somente para busca e duplicidade. Uma segunda tentativa não altera o contato nem seus consentimentos e retorna `409`:

```json
{
  "mensagem": "Este WhatsApp já está cadastrado em nossa ação."
}
```

### Login administrativo

```http
POST /api/autenticacao/login
Content-Type: application/json
```

```json
{
  "email": "admin@email.com",
  "senha": "MinhaSenhaSegura"
}
```

Resposta `200`:

```json
{
  "mensagem": "Login realizado com sucesso.",
  "token": "TOKEN_JWT_GERADO",
  "usuario": {
    "id": "1",
    "nome": "Administrador",
    "email": "admin@email.com"
  }
}
```

Email ou senha inválidos retornam `401`; usuário inativo retorna `403`.

### Listagem administrativa

```http
GET /api/admin/contatos
Authorization: Bearer TOKEN
```

Query params:

| Parâmetro | Regra |
| --- | --- |
| `nome` | Busca parcial com `ILIKE`. |
| `telefone` | Normaliza e busca parcialmente. |
| `bairro` | Busca parcial com `ILIKE`. |
| `problema` | Busca parcial com `ILIKE`. |
| `consentimentoWhatsapp` | `true`, `false` ou `null`. |
| `consentimentoLigacoes` | `true`, `false` ou `null`. |
| `origem` | Busca parcial com `ILIKE`. |
| `status` | Busca parcial com `ILIKE`. |
| `pagina` | Inteiro positivo; padrão `1`. |
| `limite` | Inteiro positivo; padrão `20`, máximo `100`. |

Os filtros de consentimento usam igualdade booleana ou `IS NULL`, sem misturar “Não” e “Não informado”. A listagem e o `COUNT` reutilizam os mesmos filtros. A consulta ordena por `criado_em DESC` e usa `LIMIT` e `OFFSET` parametrizados.

Resposta `200`:

```json
{
  "mensagem": "Contatos listados com sucesso.",
  "contatos": [
    {
      "id": "5",
      "nome": "Maria da Silva",
      "telefone": "(21) 99999-9999",
      "bairro": "Campo Grande",
      "problema": "Iluminação pública",
      "consentimentoArmazenamento": true,
      "consentimentoMensagens": false,
      "consentimentoTratamentoDados": true,
      "consentimentoWhatsapp": false,
      "consentimentoLigacoes": null,
      "origemAtual": "Formulário A Voz do Bairro",
      "statusContato": "ativo",
      "bloqueadoParaMensagens": true,
      "criadoEm": "2026-07-21T12:00:00.000Z"
    }
  ],
  "paginacao": {
    "paginaAtual": 1,
    "limite": 20,
    "totalRegistros": 1,
    "totalPaginas": 1
  }
}
```

Uma lista vazia retorna `200` e `contatos: []`. A API não retorna `telefone_normalizado`, senha, hash, segredo ou nomes em `snake_case`.

## Consentimentos oficiais

Os textos oficiais ficam centralizados em `src/config/textosConsentimento.js` e não são aceitos do navegador como fonte de auditoria.

| Tipo | Versão |
| --- | --- |
| Tratamento de dados | `tratamento_dados_v1` |
| Mensagens pelo WhatsApp | `mensagens_whatsapp_v1` |
| Ligações | `ligacoes_v1` |

No formulário público, os três campos são apresentados. O tratamento precisa ser `true`; WhatsApp e ligações registram `true` ou `false`. `NULL` fica reservado para uma resposta não apresentada ou não documentada, como dados legados sem o campo de ligações e futura importação.

## Autenticação e erros

O middleware exige `Authorization: Bearer TOKEN`, valida assinatura e expiração e adiciona `req.usuario`. Token ausente, inválido ou expirado retorna `401`.

Endpoint inexistente retorna `404`:

```json
{
  "mensagem": "Rota não encontrada."
}
```

Erro interno retorna `500` sem stack trace:

```json
{
  "mensagem": "Erro interno do servidor."
}
```

## Scripts

| Comando | Função |
| --- | --- |
| `npm start` | Inicia `src/server.js`. |
| `npm run criar-admin -- "Nome" "email" "senha"` | Cria administrador. |
| `npm run banco:migrar` | Executa as migrações SQL em ordem. |
| `npm run testar:consentimentos` | Executa regressão integrada e limpa os registros temporários. |

## Testes executados nesta etapa

O teste integrado usa a aplicação e o PostgreSQL reais. Os contatos temporários são registrados por ID e removidos em uma transação ao final.

| Verificação | Resultado observado |
| --- | --- |
| Inicialização da aplicação e `GET /api/teste` | `200`, PostgreSQL conectado. |
| Listagem sem token | `401`. |
| Rota inexistente | `404`. |
| Cadastro tratamento/WhatsApp/ligações `true` | `201`, três históricos oficiais. |
| Cadastro tratamento `true`, opcionais `false` | `201`, bloqueio de mensagens `true`. |
| Aliases antigos | Aceitos sem quebrar o contrato anterior. |
| Campo de ligações ausente em cliente antigo | `null`, sem histórico inventado. |
| Tratamento `false` ou ausente | `400`. |
| Tipos de consentimento inválidos | `400`. |
| Telefone duplicado | `409`, sem sobrescrever dados. |
| Falha ao criar histórico | Transação revertida; contato não persistido. |
| Contato sem resposta documentada | Três consentimentos `null` e bloqueio `true`. |
| Constraints | Códigos PostgreSQL `23502`, `23514` e `23505` validados. |
| Listagem | CamelCase e ausência de campos internos validados. |
| Filtros de consentimento | `true`, `false` e `null` isolados corretamente. |
| Filtros antigos, novos e paginação | Aprovados, inclusive `COUNT`. |
| Migração repetida | Executada duas vezes seguidas sem duplicação. |
| Estado após limpeza | 4 contatos, 1 usuário e 8 históricos legados. |

Também são executados `node --check` em todos os arquivos JavaScript e `git diff --check` antes da entrega.

## Limites atuais

Não estão implementados:

- envio por WhatsApp, ligações, campanhas, chat ou webhook;
- atualização ou revogação de consentimentos por endpoint;
- canal operacional para pedidos dos titulares;
- detalhe do contato e consulta do histórico pela interface;
- importação, exportação e cadastro manual;
- exclusão física automática;
- relatórios, gráficos, sorteios, brindes e redes sociais;
- recuperação de senha.

O banco já diferencia `true`, `false` e `null` e está preparado para os fluxos futuros, mas isso não significa que esses endpoints já existam.
