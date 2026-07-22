# Central de Comunicação — A Voz do Bairro

Sistema de participação cidadã com formulário público e área administrativa. O formulário usa a identidade **A Voz do Bairro**; a gestão interna usa **Central de Comunicação**.

- [backend/README.md](backend/README.md): banco, API, rotas, dependências, segurança e testes;
- [frontend/README.md](frontend/README.md): telas, responsividade, WhatsApp e integração.

## Funcionalidades

- formulário público em `/participar`;
- nome, telefone, bairro, idade e categoria da necessidade;
- catálogo único com os 166 bairros oficiais, armazenado no PostgreSQL e validado pela API;
- aceite obrigatório de privacidade;
- autorizações independentes para mensagens e ligações;
- botão público de WhatsApp configurado por ambiente;
- login JWT com bcrypt, auditoria e bloqueio de tentativas;
- perfis de operador e administrador;
- dashboard, contatos, filtros, detalhes, cadastro manual e edição;
- importação CSV/XLSX e relatórios com exportação CSV;
- criação de operadores e administradores;
- redefinição de senha de operadores e de outros administradores;
- revogação de mensagens, ligações ou ambas, com motivo opcional;
- registro de responsável, data e hora;
- pedido de exclusão com histórico e bloqueio de mensagens, ligações e campanhas.

O sistema ainda não dispara WhatsApp, SMS ou email. O botão público apenas abre uma conversa. O banco já possui a base estrutural para uma integração futura com o ManyChat, sem tokens ou segredos armazenados.

## Permissões

| Funcionalidade | Público | Operador | Administrador |
| --- | --- | --- | --- |
| Preencher formulário | Sim | Sim | Sim |
| Login e dashboard | Não | Sim | Sim |
| Listar e editar contatos | Não | Sim | Sim |
| Cadastro manual e importação | Não | Sim | Sim |
| Relatórios e exportação | Não | Sim | Sim |
| Revogar consentimentos | Não | Sim | Sim |
| Registrar pedido de exclusão | Não | Sim | Sim |
| Criar operadores ou administradores | Não | Não | Sim |
| Redefinir senha de outro usuário | Não | Não | Sim |

Telefone e origem ficam fixos na edição comum. Toda alteração efetiva registra valores anteriores, novos, usuário, data e hora.

## Fluxo

1. A pessoa acessa `/participar` e envia o formulário.
2. O backend valida o bairro pelo catálogo do PostgreSQL, normaliza o telefone e grava contato, privacidade e autorizações em transação.
3. Um telefone existente não revela dados anteriores e só recebe complementos permitidos.
4. Operadores e administradores entram por `/login`.
5. A equipe lista, filtra, abre e edita contatos.
6. Administradores gerenciam a equipe e podem redefinir a senha de outro operador ou administrador.
7. Revogações bloqueiam o canal correspondente e geram histórico.
8. Pedido de exclusão mantém o cadastro enquanto ele não é processado, mas bloqueia mensagens, ligações e campanhas.

## Executar localmente

### 1. Banco PostgreSQL novo

Na raiz do projeto:

```powershell
createdb criar_banco
psql --set ON_ERROR_STOP=1 --dbname criar_banco --file backend/database/criar_banco.sql
```

O arquivo final é destinado somente a banco vazio e recusa execução sobre tabelas do projeto.

> **Nunca execute `backend/database/criar_banco.sql` em um banco que já possui dados.** Para um banco existente ou publicado, use somente migrations incrementais novas.

### 2. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run criar-admin -- "Administrador" "admin@email.com" "SenhaCom12OuMais"
npm start
```

### 3. Frontend

Em outro terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev -- --host localhost --port 5173 --strictPort
```

Acessos:

- formulário: `http://localhost:5173/participar`;
- administrativo: `http://localhost:5173/login`;
- teste da API: `http://localhost:3000/api/teste`.

## WhatsApp no formulário

O número nunca fica fixo no código.

1. Abra `frontend/.env` ou as variáveis da Vercel.
2. Defina `VITE_WHATSAPP_NUMERO`.
3. Informe país, DDD e número usando somente dígitos.

```env
VITE_WHATSAPP_NUMERO=5521999999999
```

Sem `+`, espaços, parênteses ou hífen. Se estiver ausente ou inválido, o botão não aparece. Na Vercel, faça novo deploy após alterar uma variável `VITE_*`.

## Publicação planejada

| Serviço | Plano informado | Custo informado | Aproximado em reais |
| --- | --- | ---: | ---: |
| Frontend | Vercel Hobby | US$ 0 | R$ 0,00 |
| Backend | App Platform — 512 MiB | US$ 5 | R$ 27,50 |
| Banco | PostgreSQL gerenciado | US$ 15 | R$ 82,50 |
| **Total** |  | **US$ 20** | **R$ 110,00** |

Os valores são estimativas e podem mudar com câmbio, impostos, região, tráfego ou alterações dos provedores.

## Publicação passo a passo

### 1. Preparar o GitHub

1. Execute os testes descritos no final.
2. Confirme que `backend/.env` e `frontend/.env` não aparecem no Git.
3. Faça commit e push para a branch de produção.

### 2. Criar o PostgreSQL gerenciado

1. Crie o cluster PostgreSQL na DigitalOcean.
2. Use, de preferência, a mesma região da App Platform.
3. Crie um banco vazio chamado `criar_banco`.
4. Adicione temporariamente seu computador às fontes confiáveis.
5. Copie a connection string com TLS.
6. Da raiz do projeto, carregue o banco vazio uma única vez:

```powershell
psql --set ON_ERROR_STOP=1 --dbname "SUA_DATABASE_URL" --file backend/database/criar_banco.sql
```

Não restaure os antigos dados locais de teste. Depois que produção possuir dados reais, nunca use novamente o script final; faça backup e use migrations incrementais.

### 3. Publicar o backend na App Platform

1. Crie um **Web Service** conectado ao repositório.
2. Configure o diretório como `/backend`.
3. Use `npm start` e health check `/api/teste`.
4. Cadastre as variáveis:

```env
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:25060/criar_banco?sslmode=require
FRONTEND_URL=https://SEU-PROJETO.vercel.app
JWT_SECRET=SEGREDO_GRANDE_E_ALEATORIO
JWT_TEMPO_EXPIRACAO=8h
LOGIN_LIMITE_CONTA=5
LOGIN_LIMITE_IP=20
LOGIN_JANELA_MINUTOS=15
LOGIN_BLOQUEIO_MINUTOS=15
TRUST_PROXY_HOPS=0
DIGITALOCEAN_CONFIAR_IP=true
```

Marque `DATABASE_URL` e `JWT_SECRET` como criptografadas. A App Platform fornece `PORT` automaticamente.

5. No console do backend, crie o primeiro administrador:

```bash
npm run criar-admin -- "Administrador" "admin@seudominio.com" "SENHA_FORTE"
```

6. Teste `https://SEU-BACKEND.ondigitalocean.app/api/teste`.

### 4. Publicar o frontend na Vercel

1. Importe o repositório.
2. Use `frontend` como Root Directory.
3. Selecione Vite, `npm run build` e saída `dist`.
4. Configure:

```env
VITE_API_URL=https://SEU-BACKEND.ondigitalocean.app
VITE_WHATSAPP_NUMERO=5521999999999
```

O arquivo `frontend/vercel.json` mantém as rotas da SPA.

### 5. Fechar CORS e validar

1. Atualize `FRONTEND_URL` no backend com o domínio final da Vercel, sem barra no fim.
2. Faça redeploy do backend.
3. Teste formulário, login, edição, revogação, pedido de exclusão, logout e sessão expirada.

## ManyChat

O banco já está preparado para identificador do contato, campanhas, participação única, tentativas de envio, status, erros, entrega, leitura, respostas, webhooks idempotentes e sincronizações. A própria base recusa participação ou novo envio sem consentimento ativo, após revogação ou pedido de exclusão.

Ainda serão necessários a contratação do ManyChat, credenciais em variáveis de ambiente, API, webhook, processamento de eventos, telas e rotas. Nada disso foi implementado nesta etapa.

## Testes

```powershell
cd backend
npm test
npm audit

cd ..\frontend
npm run build
npm audit
```

Última validação:

- 233 verificações do backend aprovadas;
- catálogo com 166 bairros, relacionamento e rejeição de bairros inexistentes aprovados;
- redefinição administrativa de senha e novo login aprovados;
- criação e login do primeiro administrador aprovados;
- regras preparatórias do ManyChat aprovadas;
- build Vite aprovado;
- validação sintática do backend aprovada;
- zero vulnerabilidades encontradas nas dependências.
