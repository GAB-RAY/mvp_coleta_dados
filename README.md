# Central de Comunicação — A Voz do Bairro

Sistema real de coleta e gestão de contatos comunitários. O projeto possui formulário público, painel administrativo, controle de usuários, eventos, consentimentos, pedidos de exclusão, importações e relatórios.

## Tecnologias

- Backend: Node.js, Express, CommonJS, PostgreSQL, `pg`, bcrypt e JWT.
- Frontend: React, Vite e JavaScript.
- Banco oficial local: `criar_banco`.

## Funcionalidades

- formulário público responsivo em `/participar`;
- catálogo de 166 bairros validado no PostgreSQL;
- categorias de problema centralizadas no backend;
- consentimentos separados para mensagens e ligações;
- botão público de WhatsApp configurado por variável de ambiente;
- login administrativo com JWT e proteção contra tentativas repetidas;
- perfis `administrador` e `operador`;
- cadastro, edição, busca, filtros e paginação de contatos;
- cadastro manual e importação CSV/XLSX;
- revogações imutáveis com responsável, data, hora e motivo opcional;
- pedidos de exclusão pendentes, aprovados ou rejeitados;
- exclusão física do contato somente após aprovação do administrador;
- eventos com vínculo automático pelo mesmo formulário público;
- relatórios e filtro de contatos por evento;
- exportação de contatos em CSV e Excel exclusiva para administradores;
- backup completo do PostgreSQL pelo painel, exclusivo para administradores e com auditoria SHA-256;
- estrutura reservada para futura integração com ManyChat.

## Permissões

| Ação | Operador | Administrador |
|---|---:|---:|
| Consultar, cadastrar e editar contatos | Sim | Sim |
| Revogar mensagens/ligações | Sim | Sim |
| Solicitar exclusão | Sim | Sim |
| Aprovar ou rejeitar exclusão | Não | Sim |
| Exportar CSV | Não | Sim |
| Exportar Excel | Não | Sim |
| Gerar e baixar backup do banco | Não | Sim |
| Gerenciar eventos | Não | Sim |
| Gerenciar usuários e senhas | Não | Sim |

Não existem rotas para apagar diretamente contatos, revogações ou históricos. Ao aprovar um pedido, o administrador confirma uma exclusão física. O registro do pedido e os registros de consentimento/revogação permanecem sem os dados pessoais do contato.

## Banco de dados

Banco novo e vazio:

```powershell
createdb criar_banco
psql --set ON_ERROR_STOP=1 --dbname criar_banco --file backend/database/criar_banco.sql
```

Para atualizar um banco existente, faça e teste um backup completo, crie um banco vazio com o schema atual e restaure somente os dados expressamente aprovados. O projeto não utiliza migrations.

> Nunca execute `backend/database/criar_banco.sql` sobre um banco que já possua estrutura ou dados. O próprio script recusa essa execução.

O schema atual possui 22 tabelas. As seis tabelas preparatórias do ManyChat foram mantidas: `campanhas`, `campanha_contatos`, `envios_campanha`, `respostas_campanha`, `eventos_manychat` e `sincronizacoes_manychat`. A tabela `backups_banco` registra cada tentativa de backup, seu responsável, estado, tamanho e hash SHA-256.

## Como iniciar

Backend:

```powershell
cd backend
npm install
npm start
```

Frontend, em outro terminal:

```powershell
cd frontend
npm install
npm run dev
```

Endereços padrão:

- formulário: `http://localhost:5173/participar`;
- login: `http://localhost:5173/login`;
- API: `http://localhost:3000/api/teste`.

## Configuração do WhatsApp

No arquivo `frontend/.env`, informe o número com código do país e DDD, somente com números:

```env
VITE_WHATSAPP_NUMERO=5521999999999
```

Reinicie o Vite depois de alterar a variável. O botão apenas abre uma conversa; ele não envia dados automaticamente.

## Publicação sugerida

- Frontend: Vercel Hobby.
- Backend: DigitalOcean App Platform 512 MiB.
- Banco: PostgreSQL gerenciado.

Configure `VITE_API_URL` no frontend e `DATABASE_URL`, `JWT_SECRET`, `JWT_TEMPO_EXPIRACAO`, `FRONTEND_URL` e as configurações de SSL no backend. Aplique `criar_banco.sql` somente no banco vazio antes de iniciar o backend.

## Documentação técnica

- [Backend](backend/README.md)
- [Frontend](frontend/README.md)

## Validação atual

Em 23/07/2026:

- schema criado em banco vazio de teste: 22 tabelas;
- banco principal recriado exclusivamente pelo schema completo, sem migrations;
- backup prévio restaurado e validado em banco separado;
- `npm test`: 252 verificações aprovadas;
- `npm run build`: 61 módulos transformados;
- banco principal recriado com 166 bairros, zero contatos e o administrador Gabriel preservado como ID 1;
- sequências das 22 tabelas sincronizadas.
