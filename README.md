# Central de Comunicação — Acorda VK

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
- opt-ins de WhatsApp e ligações desmarcados por padrão e registrados com texto, versão, origem e data;
- páginas públicas de privacidade, termos e solicitação de exclusão;
- botão público de WhatsApp configurado por variável de ambiente;
- login administrativo com JWT e proteção contra tentativas repetidas;
- perfis `administrador` e `operador`;
- cadastro, edição, busca, filtros e paginação de contatos;
- cadastro manual e importação CSV/XLSX;
- revogações imutáveis com responsável, data, hora e motivo opcional;
- pedidos de exclusão pendentes, aprovados ou rejeitados;
- exclusão física do contato somente após aprovação do administrador;
- formulário geral permanente e formulários exclusivos por evento, todos reutilizando o mesmo componente público;
- vários eventos podem permanecer ativos simultaneamente, cada um com descrição, data, horário, local/link e período de inscrições;
- QR Code exclusivo por evento, válido somente enquanto o evento estiver ativo e dentro do período;
- contato novo segue para o formulário completo; contato existente confirma a inscrição sem preencher tudo novamente;
- inscrição idempotente: o mesmo contato não é vinculado duas vezes ao mesmo evento;
- nenhuma informação pessoal do cadastro é devolvida durante a identificação pública;
- preservação da origem e auditoria das atualizações escolhidas em `Meus dados mudaram`;
- acesso direto aos participantes e busca por nome ou telefone;
- eventos em modo somente leitura para operadores; criação e alterações continuam exclusivas do administrador;
- validação do evento exibido antes de concluir o envio público;
- lista própria de participantes por evento, com busca, status de inscrição e andamento da comunicação;
- relatórios clicáveis por bairro, categoria e evento, incluindo necessidades por bairro;
- exportação de contatos em CSV e Excel exclusiva para administradores;
- backup de todos os dados em SQL legível, sem estrutura, exclusivo para administradores e com auditoria SHA-256;
- proteção do formulário público com limite por IP/telefone, cache e controle de concorrência;
- pool PostgreSQL limitado, tempos máximos, recuperação de conexões e desligamento gracioso;
- endpoints separados de vida e prontidão para monitoramento em produção;
- comunicações manuais com WhatsApps da equipe, textos prontos obrigatórios, campanhas, segmentação, campos substituíveis e histórico;
- abrir ou copiar uma mensagem nunca marca envio; existe uma confirmação humana separada após o envio real;
- a mesma campanha não pode ser confirmada novamente para o mesmo contato sem aviso, confirmação e motivo registrado;
- status de atendimento, resposta, recusa, telefone inválido e conclusão são atualizados manualmente;
- toda comunicação é preparada, aberta e confirmada manualmente pela equipe.

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
| Consultar participantes e atualizar inscrição | Sim | Sim |
| Preparar e registrar comunicação manual | Sim | Sim |
| Gerenciar números, textos prontos e campanhas | Não | Sim |
| Gerenciar usuários e senhas | Não | Sim |

Não existem rotas para apagar diretamente contatos, revogações ou históricos. Ao aprovar um pedido, o administrador confirma uma exclusão física. O registro do pedido e os registros de consentimento/revogação permanecem sem os dados pessoais do contato.

Administradores podem definir o próprio nome, criar operadores e outros administradores e redefinir senhas de operadores. Contas de outros administradores são protegidas contra alterações.

## Banco de dados

Banco novo e vazio:

```powershell
createdb criar_banco
psql --set ON_ERROR_STOP=1 --dbname criar_banco --file backend/database/criar_banco.sql
```

O schema final já inclui o ledger `schema_migrations` e registra as migrations incorporadas. Ele deve ser usado somente na criação de um banco novo.

> Nunca execute `backend/database/criar_banco.sql` sobre um banco que já possua estrutura ou dados. O próprio script recusa essa execução.

Para atualizar um banco existente, faça e valide o backup e execute:

```powershell
cd backend
npm run banco:migrar
```

O runner usa `schema_migrations`, checksum SHA-256, transação e advisory lock. Uma migration aplicada nunca é repetida; alterar um arquivo já executado interrompe a operação. O `prestart` executa somente esse runner e não reaplica DDL em toda inicialização.

O schema atual possui 22 tabelas. `schema_migrations` controla a evolução do banco. `numeros_whatsapp`, `modelos_mensagem`, `campanhas`, `comunicacoes` e `historico_comunicacoes` organizam somente o trabalho manual. A tabela `backups_banco` registra cada tentativa de backup, seu responsável, estado, tamanho e hash SHA-256.

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

## Configuração pública

No arquivo `frontend/.env`, informe o número com código do país e DDD, somente com números:

```env
VITE_WHATSAPP_NUMERO=5521999999999
VITE_PRIVACIDADE_EMAIL=seu-email-de-privacidade@example.com
```

Reinicie o Vite depois de alterar as variáveis. O botão apenas abre uma conversa;
ele não envia dados automaticamente. O e-mail é mostrado em `/privacidade`,
`/termos` e `/excluir-dados` como canal dos titulares. Substitua o endereço de
exemplo pelo e-mail oficial do projeto antes de iniciar a coleta oficial. O
formulário aceita somente pessoas com idade inteira entre 16 e 120 anos; as
autorizações de WhatsApp e ligações permanecem opcionais e desmarcadas.

## Publicação sugerida

- Frontend: Vercel Hobby.
- Backend: DigitalOcean App Platform 512 MiB.
- Banco: PostgreSQL gerenciado.

Configure `VITE_API_URL` no frontend e `DATABASE_URL`, `JWT_SECRET`, `JWT_TEMPO_EXPIRACAO`, `FRONTEND_URL` e as configurações de SSL no backend. Aplique `criar_banco.sql` somente no banco vazio antes de iniciar o backend.

Depois do deploy, a Vercel mostra o domínio público na página do projeto e em `Deployments`, normalmente no formato `https://nome-do-projeto.vercel.app`. A partir desse domínio:

- formulário: `https://nome-do-projeto.vercel.app/participar`;
- login administrativo: `https://nome-do-projeto.vercel.app/login`;
- painel após autenticação: `https://nome-do-projeto.vercel.app/admin`.
- privacidade: `https://nome-do-projeto.vercel.app/privacidade`;
- termos: `https://nome-do-projeto.vercel.app/termos`;
- exclusão de dados: `https://nome-do-projeto.vercel.app/excluir-dados`.

A URL da DigitalOcean é da API e deve ser configurada em `VITE_API_URL`; ela não é o endereço que a equipe usa para abrir o painel.

O plano de 512 MiB e o PostgreSQL de nó único são adequados para a publicação inicial controlada, mas não oferecem alta disponibilidade completa. Antes de um evento de grande alcance, faça teste de carga no ambiente de homologação. Para eliminar pontos únicos de falha, use pelo menos duas instâncias do backend e PostgreSQL com nó standby.

No App Platform, configure:

- readiness: `/api/saude/pronto`, que valida conexão e tabelas/colunas críticas;
- liveness: `/api/saude/vivo`;
- alertas de falha de deploy, reinício, CPU, memória e latência;
- `NODE_ENV=production` e `DIGITALOCEAN_CONFIAR_IP=true`;
- conexão PostgreSQL privada/VPC, TLS e trusted sources.

## Documentação técnica

- [Backend](backend/README.md)
- [Frontend](frontend/README.md)

## Validação atual

Em 02/08/2026:

- schema criado em banco vazio de teste: 22 tabelas e ledger versionado;
- banco existente atualizado por migrations incrementais com checksum e advisory lock;
- backup prévio restaurado e validado em banco separado;
- `npm run testar:importacao-carga`: 15.000 contatos importados e validados, com limpeza automática;
- limite máximo validado: arquivo único com 20.000 contatos;
- `npm test`: 392 verificações aprovadas;
- `npm run build`: 69 módulos transformados;
- banco principal validado com 166 bairros e integridade estrutural preservada;
- runner executado novamente sem reaplicar migrations.
