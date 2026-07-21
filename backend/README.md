# Backend do MVP de coleta de dados

API em Node.js, Express e PostgreSQL, escrita em CommonJS e sem ORM.

## Instalação

Na pasta `backend`, execute:

```bash
npm install
```

Copie `.env.example` para `.env` e preencha as configurações do seu ambiente:

```env
PORTA=3000
BANCO_HOST=localhost
BANCO_PORTA=5432
BANCO_USUARIO=postgres
BANCO_SENHA=sua_senha
BANCO_NOME=criar_banco
JWT_SEGREDO=troque_por_um_segredo_longo_e_aleatorio
JWT_EXPIRACAO=8h
BCRYPT_RODADAS=12
```

O banco e as tabelas devem existir antes da inicialização. A aplicação não cria nem altera o schema.

Para iniciar:

```bash
npm start
```

## Criar o administrador

O administrador é criado pelo terminal para que a senha seja armazenada com hash bcrypt:

```bash
npm run criar-admin -- "Administrador" "admin@exemplo.com" "senha-segura"
```

O nome deve ter entre 2 e 150 caracteres, o email deve ser válido e a senha deve ter pelo menos 8 caracteres.

## Login administrativo

`POST /api/autenticacao/login`

```json
{
  "email": "admin@exemplo.com",
  "senha": "senha-segura"
}
```

Resposta de sucesso (`200`):

```json
{
  "token": "jwt-gerado",
  "usuario": {
    "id": "1",
    "nome": "Administrador",
    "email": "admin@exemplo.com"
  }
}
```

Nas rotas administrativas protegidas, envie o token no cabeçalho:

```text
Authorization: Bearer jwt-gerado
```

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

A API remove os caracteres não numéricos do telefone antes de verificar duplicidade. Um cadastro válido retorna `201`.

## Teste de conexão

`GET /api/teste` executa `SELECT 1` e confirma a comunicação com o PostgreSQL sem modificar dados.
