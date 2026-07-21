# Backend do MVP de coleta de dados

API em Node.js, Express e PostgreSQL, usando CommonJS, SQL direto e consultas parametrizadas.

## Dependências

- Express, Helmet e CORS;
- PostgreSQL com `pg`;
- `bcrypt` para hashes de senha;
- `jsonwebtoken` para autenticação;
- `dotenv` para variáveis de ambiente.

## Configuração

Na pasta `backend`, instale as dependências:

```bash
npm install
```

Copie `.env.example` para `.env` e informe os dados locais:

```env
PORTA=3000
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/cirar_banco
FRONTEND_URL=http://localhost:5173
JWT_SECRET=coloque_uma_chave_secreta_grande
JWT_TEMPO_EXPIRACAO=8h
```

O banco e as tabelas `contatos` e `usuarios` devem existir. A aplicação não cria nem modifica o schema.

## Executar

```bash
npm start
```

Teste da conexão:

```text
GET /api/teste
```

## Criar o administrador

```bash
npm run criar-admin -- "Administrador" "admin@email.com" "MinhaSenhaSegura"
```

A senha deve possuir pelo menos 8 caracteres e será armazenada somente como hash bcrypt.

## Cadastro público

`POST /api/publico/contatos`

```json
{
  "nome": "Maria da Silva",
  "telefone": "(21) 99999-9999",
  "bairro": "Campo Grande",
  "problema": "Falta de iluminação",
  "consentimentoArmazenamento": true,
  "consentimentoMensagens": false
}
```

Um cadastro válido retorna `201`. O telefone é normalizado antes da verificação de duplicidade.

## Login administrativo

`POST /api/autenticacao/login`

```json
{
  "email": "admin@email.com",
  "senha": "MinhaSenhaSegura"
}
```

Um login válido retorna `200`, o token JWT e os dados básicos do usuário. Rotas administrativas protegidas devem receber:

```text
Authorization: Bearer TOKEN
```

## Rotas existentes

- `GET /api/teste`
- `POST /api/publico/contatos`
- `POST /api/autenticacao/login`

## Testes executados

Os testes abaixo foram executados após a organização da arquitetura em `src/modules`.

| Teste | Resultado observado |
| --- | --- |
| Inicialização do servidor | Servidor iniciado e respondendo normalmente |
| `GET /api/teste` | HTTP `200` e conexão real com PostgreSQL |
| Cadastro público válido | HTTP `201` |
| Cadastro sem consentimento para armazenamento | HTTP `400` |
| Telefone duplicado com formatações diferentes | HTTP `409` |
| Violação PostgreSQL `23505` | Convertida para HTTP `409` |
| Criação de administrador | Email normalizado e senha protegida com bcrypt, custo 12 |
| Login correto | HTTP `200` e token JWT válido |
| Login com senha incorreta | HTTP `401` |
| Login de usuário inativo | HTTP `403` |
| Rota protegida sem token | HTTP `401` |
| Rota protegida com token válido | HTTP `200` e dados em `req.usuario` |
| Rota inexistente | HTTP `404` |
| Verificação de sintaxe | 18 arquivos aprovados com `node --check` |
| Referências às pastas globais antigas | Nenhuma encontrada |

### Resposta do teste de conexão

```json
{
  "sucesso": true,
  "mensagem": "API e banco de dados conectados."
}
```

### Resposta do cadastro válido

```json
{
  "mensagem": "Cadastro realizado com sucesso.",
  "contato": {
    "id": "1",
    "nome": "Maria da Silva",
    "telefone": "(21) 99999-9999",
    "bairro": "Campo Grande",
    "problema": "Falta de iluminação",
    "consentimentoArmazenamento": true,
    "consentimentoMensagens": false,
    "criadoEm": "2026-07-21T12:00:00.000Z"
  }
}
```

O identificador e a data variam de acordo com o registro criado.

### Respostas de validação e duplicidade

Sem consentimento para armazenamento (`400`):

```json
{
  "mensagem": "O consentimento para armazenamento é obrigatório."
}
```

Telefone duplicado (`409`):

```json
{
  "mensagem": "Já existe um cadastro com este telefone."
}
```

### Respostas do login

Login correto (`200`):

```json
{
  "mensagem": "Login realizado com sucesso.",
  "token": "TOKEN_JWT_GERADO",
  "usuario": {
    "id": "10",
    "nome": "Administrador",
    "email": "admin@email.com"
  }
}
```

Credenciais incorretas (`401`):

```json
{
  "mensagem": "Email ou senha inválidos."
}
```

Usuário inativo (`403`):

```json
{
  "mensagem": "Usuário inativo."
}
```

### Respostas do middleware JWT

Sem token (`401`):

```json
{
  "mensagem": "Token não fornecido."
}
```

Com token válido, a rota temporária usada no teste respondeu (`200`):

```json
{
  "usuario": {
    "id": "10",
    "email": "admin@email.com"
  }
}
```

A rota protegida foi criada somente durante o teste e não faz parte das rotas permanentes da API.

### Resposta para rota inexistente

```json
{
  "mensagem": "Rota não encontrada."
}
```

Os testes de escrita utilizaram Models simulados para não inserir dados de teste no banco real. A conexão foi validada com `SELECT 1`, e os comandos parametrizados foram conferidos com `EXPLAIN`, sem persistência de dados.
