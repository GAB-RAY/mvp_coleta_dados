# ACORDA RJ

Sistema de coleta e gestão de contatos comunitários, com formulário público,
painel administrativo, eventos, importações, privacidade, campanhas em lotes e
integração oficial com a WhatsApp Cloud API.

## Estado atual

- Backend: Node.js 24, Express 5, CommonJS, PostgreSQL e SQL parametrizado.
- Frontend: React 19, React Router 7 e Vite 8.
- Banco: schema final com 31 tabelas, 166 bairros e 13 migrations registradas.
- Produção planejada: frontend na Vercel, API e PostgreSQL gerenciado na
  DigitalOcean.

## Funcionalidades

- formulário responsivo em `/participar`, com idade mínima de 16 anos;
- bairros vindos do PostgreSQL e categorias vindas do backend;
- aceite de privacidade obrigatório e autorizações opcionais, versionadas e
  desmarcadas por padrão;
- cadastro único por telefone normalizado, sem duplicar números formatados de
  maneiras diferentes;
- links exclusivos de eventos em `/participar?evento=<id>`, com QR Code;
- vários eventos ativos simultaneamente e vínculo único contato/evento;
- painel com contatos, filtros, paginação, histórico e cadastro interno;
- importação de VCF, CSV e XLSX, com até 20.000 registros por arquivo;
- relatórios e exportações CSV/XLSX para administradores;
- pedidos de exclusão, revogações e trilha de auditoria;
- backup de dados em SQL, sem estrutura, exclusivo para administradores;
- usuários com perfis `administrador` e `operador`;
- campanhas com templates oficiais sincronizados com a Meta, rascunhos, submissão para análise, filtros, prévia, lotes idempotentes, tentativas e
  histórico técnico;
- envio por template aprovado através da WhatsApp Cloud API oficial;
- webhook autenticado por HMAC, idempotente e sem armazenamento do payload
  bruto;
- capacidade móvel de 24 horas calculada pelo menor valor entre a proteção
  interna e o limite oficial finito informado pela Meta;
- sincronização automática do limite oficial pelo webhook
  `business_capability_update` e sincronização manual de contingência.

## Permissões principais

| Ação | Operador | Administrador |
|---|---:|---:|
| Consultar e cadastrar contatos | Sim | Sim |
| Revogar consentimentos e solicitar exclusão | Sim | Sim |
| Consultar eventos e participantes | Sim | Sim |
| Gerenciar eventos | Não | Sim |
| Importar contatos | Sim | Sim |
| Excluir uma importação e seus contatos próprios | Não | Sim |
| Exportar CSV/XLSX | Não | Sim |
| Gerar backup | Não | Sim |
| Gerenciar usuários | Não | Sim |
| Criar/editar campanha e template | Não | Sim |
| Consultar campanhas e criar lotes | Sim | Sim |
| Alterar proteção interna ou sincronizar a Meta | Não | Sim |

O backend é a autoridade das permissões. Ocultar controles no frontend é apenas
uma proteção visual complementar.

## Instalação local

Backend:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm start
```

Frontend, em outro terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Endereços locais:

- formulário: `http://localhost:5173/participar`;
- login: `http://localhost:5173/login`;
- API: `http://localhost:3000/api/teste`.

## Banco de dados

Banco novo e vazio:

```powershell
createdb criar_banco
psql --set ON_ERROR_STOP=1 --dbname criar_banco --file backend/database/criar_banco.sql
```

> Nunca execute `criar_banco.sql` sobre um banco que já tenha estrutura ou
> dados.

Banco existente:

```powershell
cd backend
npm run banco:migrar
```

O runner usa `schema_migrations`, checksum SHA-256, transações e advisory lock.
Migrations aplicadas não devem ser editadas nem apagadas.

## Variáveis públicas

O frontend usa somente valores públicos:

```env
VITE_API_URL=http://localhost:3000
VITE_WHATSAPP_NUMERO=5521999999999
VITE_PRIVACIDADE_EMAIL=privacidade@exemplo.com
```

Tokens, segredos, banco e credenciais da Meta pertencem exclusivamente ao
ambiente do backend. Arquivos `.env` reais não são versionados.

## Validação

```powershell
cd backend
npm test
npm run testar:schema-vazio

cd ..\frontend
npm run build
```

Os resultados datados das implementações de campanha e Meta ficam nos arquivos
`RELATORIO_*.md`. Eles são evidências históricas e não substituem uma nova
execução antes de publicar alterações.

## Documentação

- [Documentação técnica consolidada](README_TECNICO.md)
- [Backend](backend/README.md)
- [Frontend](frontend/README.md)
- [Prompt mestre para continuidade ou reconstrução](PROMPT_MESTRE.md)
- relatórios datados: `RELATORIO_*.md`.

## Produção

- configure o frontend com a URL HTTPS da API;
- configure `FRONTEND_URL` no backend com o domínio final do frontend;
- mantenha segredos somente nos painéis da hospedagem;
- aplique somente migrations pendentes em bancos existentes;
- use `/api/saude/vivo` para liveness e `/api/saude/pronto` para readiness;
- não faça mudanças estruturais sem backup e teste de restauração.
