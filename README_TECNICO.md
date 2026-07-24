# README técnico — Central de Comunicação

Este documento descreve o estado atual do frontend e do backend do projeto **A Voz do Bairro**. Ele foi produzido a partir do código, do schema PostgreSQL e dos scripts existentes no repositório.

## 1. Visão geral

O sistema coleta dados comunitários por um formulário público e oferece um painel interno para gestão de contatos, eventos, consentimentos, importações, relatórios, exclusões e backups.

Componentes da solução:

- frontend React/Vite;
- API Node.js/Express;
- PostgreSQL acessado diretamente pelo pacote `pg`;
- autenticação por JWT;
- dois perfis internos: `operador` e `administrador`;
- schema completo para criação de banco vazio em `backend/database/criar_banco.sql`.

O formulário público usa o nome **A Voz do Bairro**. O painel interno usa a identidade **Central de Comunicação**.

## 2. Estrutura do repositório

```text
MVP_coletas_dados/
  backend/
    database/
      criar_banco.sql
    scripts/
    src/
      config/
      middlewares/
      modules/
      utils/
      app.js
      server.js
    .env.example
    package.json
  frontend/
    public/
    src/
      components/
      data/
      pages/
      services/
      styles/
      utils/
      App.jsx
      main.jsx
    .env.example
    package.json
    vercel.json
    vite.config.js
```

## 3. Backend

### 3.1 Tecnologias e dependências

- Node.js e CommonJS;
- Express 5;
- PostgreSQL e `pg`;
- `bcrypt` para hash e comparação de senhas;
- `jsonwebtoken` para JWT;
- `helmet` para cabeçalhos de segurança;
- `cors` com origem configurada;
- `multer` para receber arquivos em memória;
- `exceljs` para ler XLSX e gerar Excel;
- `dotenv` para configuração local;
- `compression` para reduzir respostas JSON;
- `express-rate-limit` para proteção contra abuso.

O backend não utiliza TypeScript, ORM, Prisma ou Sequelize. Todo acesso ao banco é feito com SQL parametrizado.

### 3.2 Arquitetura

A API é modular por funcionalidade. O fluxo predominante é:

```text
rota -> controller -> service -> model -> PostgreSQL
```

Responsabilidades:

- rota: endpoint e middlewares;
- controller: recebe requisição, chama o service e define a resposta HTTP;
- service: valida dados e aplica regras de negócio;
- model: executa SQL parametrizado e transações;
- middleware: autenticação, autorização e tratamento uniforme de erros;
- utilitário: funções compartilhadas, como normalização do telefone e criação de erros HTTP.

Módulos atuais:

| Módulo | Responsabilidade |
|---|---|
| `autenticacao` | Login, bloqueio por tentativas e emissão do JWT. |
| `usuarios` | Listagem e criação de usuários, nome próprio e senha de operador. |
| `contatos` | Cadastro público/manual, listagem, detalhes, consentimentos e histórico. |
| `bairros` | Catálogo dos 166 bairros ativos. |
| `origens` | Origens do cadastro manual e das importações. |
| `importacoes` | Pré-visualização e confirmação de CSV/XLSX. |
| `relatorios` | Resumo, gráficos e exportações CSV/Excel. |
| `eventos` | Criação, edição, ativação, encerramento e auditoria. |
| `exclusoes` | Solicitação, aprovação ou rejeição de exclusão. |
| `backups` | Geração e histórico de backups PostgreSQL. |
| `teste` | Verificação de disponibilidade da API e do banco. |

### 3.3 Inicialização e configuração

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm start
```

Variáveis suportadas:

```env
NODE_ENV=development
PORTA=3000
BANCO_NOME=criar_banco
BANCO_HOST=localhost
BANCO_PORTA=5432
BANCO_USUARIO=
BANCO_SENHA=
BANCO_SSL=false
BANCO_SSL_REJEITAR_NAO_AUTORIZADO=true
BANCO_POOL_MAX=5
BANCO_POOL_OCIOSO_MS=30000
BANCO_CONEXAO_TEMPO_LIMITE_MS=5000
BANCO_CONEXAO_TEMPO_MAXIMO_SEGUNDOS=300
BANCO_COMANDO_TEMPO_LIMITE_MS=15000
BANCO_CONSULTA_TEMPO_LIMITE_MS=20000
BANCO_BLOQUEIO_TEMPO_LIMITE_MS=5000
BANCO_TRANSACAO_OCIOSA_TEMPO_LIMITE_MS=15000
DATABASE_URL=
FRONTEND_URL=http://localhost:5173
JWT_SECRET=
JWT_TEMPO_EXPIRACAO=8h
LOGIN_LIMITE_CONTA=5
LOGIN_LIMITE_IP=20
LOGIN_JANELA_MINUTOS=15
LOGIN_BLOQUEIO_MINUTOS=15
TRUST_PROXY_HOPS=0
DIGITALOCEAN_CONFIAR_IP=false
API_REQUISICOES_CONCORRENTES=100
API_LIMITE_JANELA_MS=60000
API_LIMITE_MAXIMO=1200
PUBLICO_LIMITE_JANELA_MS=900000
PUBLICO_LIMITE_MAXIMO=5
BAIRROS_CACHE_MS=300000
PG_DUMP_CAMINHO=
BACKUP_TEMPO_LIMITE_MS=600000
BACKUP_CONEXAO_TEMPO_LIMITE_SEGUNDOS=10
BACKUP_MAX_FILA_BANCO=2
BACKUP_BANCO_TAMANHO_MAXIMO_BYTES=2147483648
RELATORIO_LIMITE_REGISTROS=50000
```

`DATABASE_URL` substitui as variáveis `BANCO_*` em ambientes gerenciados. Credenciais e segredos devem existir somente no `.env` local ou no painel seguro da hospedagem.

### 3.4 Segurança

- senhas armazenadas somente como hash bcrypt;
- JWT enviado no cabeçalho `Authorization: Bearer <token>`;
- todas as rotas `/api/admin/*` passam pelo middleware JWT;
- autorização de administrador também é validada no backend;
- CORS limitado por `FRONTEND_URL`;
- Helmet habilitado;
- SQL parametrizado;
- telefone normalizado antes de busca e persistência;
- telefone normalizado único no banco;
- auditoria de tentativas de login;
- bloqueio temporário por excesso de falhas de conta, e-mail ou IP;
- erros internos retornam mensagem genérica, sem expor detalhes técnicos;
- exportação, backups, usuários, análise de exclusões e escrita de eventos são exclusivos de administradores.
- rate limit público por IP/telefone e limite global por IP;
- limite de concorrência e backpressure com 503/`Retry-After`;
- pool PostgreSQL limitado e com timeouts;
- encerramento gracioso e endpoints de readiness/liveness;
- `X-Request-Id`, compressão e limite de corpo;
- validação de segredos, HTTPS e TLS antes de iniciar em produção.

### 3.5 Rotas públicas

| Método | Endpoint | Resultado |
|---|---|---|
| `GET` | `/api/teste` | Testa API e conexão PostgreSQL. |
| `GET` | `/api/saude/vivo` | Confirma que o processo está vivo. |
| `GET` | `/api/saude/pronto` | Confirma que a API e o PostgreSQL estão prontos. |
| `GET` | `/api/publico/contatos/opcoes` | Retorna bairros, categorias e evento ativo. |
| `POST` | `/api/publico/contatos/verificar-evento` | Compara nome completo e telefone sem retornar dados pessoais. |
| `POST` | `/api/publico/contatos/inscrever-evento` | Vincula ao evento ativo um contato existente já identificado. |
| `POST` | `/api/publico/contatos` | Registra ou complementa um contato pelo telefone. |
| `POST` | `/api/autenticacao/login` | Valida credenciais e retorna JWT e usuário. |

O cadastro público recebe:

```json
{
  "nome": "Nome da pessoa",
  "telefone": "(21) 99999-9999",
  "bairro": "Vila Kennedy",
  "idade": 30,
  "problema": "Saúde",
  "eventoIdExibido": 1,
  "aceitePrivacidade": true,
  "autorizacaoMensagens": false,
  "autorizacaoLigacoes": false
}
```

Regras principais:

- nome, telefone, bairro, idade, categoria e aceite de privacidade são obrigatórios;
- idade deve ser inteira entre 16 e 120;
- o bairro deve existir e estar ativo no catálogo do banco;
- a categoria deve existir no catálogo centralizado do backend;
- mensagens e ligações são escolhas independentes e explícitas;
- o telefone é reduzido a dígitos e deve ter de 10 a 15 números;
- o formulário não contém descrição do problema nem pergunta eleitoral;
- se houver evento ativo e dentro do período, o vínculo é automático;
- `eventoIdExibido` recebe o identificador mostrado ou `null` quando não havia evento;
- se o evento ativo mudar antes do envio, a transação é cancelada com HTTP `409` e nenhum contato é persistido parcialmente;
- submissões usam advisory lock compartilhado; edição e mudança de status usam o lock exclusivo correspondente;
- sem evento ativo, o cadastro segue normalmente e sem aviso adicional;
- telefone existente não provoca sobrescrita silenciosa no fluxo público;
- somente campos anteriormente vazios podem ser complementados;
- durante evento, nome completo e telefone são solicitados antes dos demais campos;
- telefone inexistente libera o formulário completo e cria o contato antes do vínculo;
- telefone existente exige correspondência do nome completo, com normalização de maiúsculas, acentos e espaços;
- falha de correspondência retorna `422`, sem expor dados pessoais, criar contato ou criar vínculo;
- contato identificado pode confirmar diretamente a participação, sem reenviar os demais campos;
- `Meus dados mudaram` permite declarar dados atuais após a identificação; a alteração gera histórico `atualizacao_cadastro_publico_evento` e preserva a origem original;
- vínculo novo de contato existente retorna `200` com `inscricaoEventoCriada: true`;
- vínculo já existente retorna `200` com `jaInscritoEvento: true` e mensagem de inscrição repetida;
- se nada mudou, não é criado histórico repetido;
- a mensagem de sucesso é: `Cadastro realizado com sucesso. Obrigado por contribuir com o projeto A Voz do Bairro.`

### 3.6 Rotas administrativas

Todas exigem JWT.

| Método | Endpoint | Acesso |
|---|---|---|
| `GET` | `/api/admin/contatos` | operador/admin |
| `POST` | `/api/admin/contatos` | operador/admin |
| `GET` | `/api/admin/contatos/:id` | operador/admin |
| `POST` | `/api/admin/contatos/:id/revogar-consentimentos` | operador/admin |
| `POST` | `/api/admin/contatos/:id/solicitacao-exclusao` | operador/admin |
| `GET` | `/api/admin/origens` | operador/admin |
| `POST` | `/api/admin/importacoes/pre-visualizar` | operador/admin |
| `POST` | `/api/admin/importacoes/:id/confirmar` | operador/admin |
| `GET` | `/api/admin/relatorios/resumo` | operador/admin |
| `GET` | `/api/admin/relatorios/exportar.csv` | admin |
| `GET` | `/api/admin/relatorios/exportar.xlsx` | admin |
| `GET` | `/api/admin/eventos` | operador/admin |
| `POST` | `/api/admin/eventos` | admin |
| `PUT` | `/api/admin/eventos/:id` | admin |
| `POST` | `/api/admin/eventos/:id/ativar` | admin |
| `POST` | `/api/admin/eventos/:id/encerrar` | admin |
| `GET` | `/api/admin/solicitacoes-exclusao` | admin |
| `POST` | `/api/admin/solicitacoes-exclusao/:id/aprovar` | admin |
| `POST` | `/api/admin/solicitacoes-exclusao/:id/rejeitar` | admin |
| `GET` | `/api/admin/backups` | admin |
| `POST` | `/api/admin/backups/banco` | admin |
| `GET` | `/api/admin/usuarios` | admin |
| `POST` | `/api/admin/usuarios` | admin |
| `PATCH` | `/api/admin/usuarios/meu-perfil` | admin |
| `PATCH` | `/api/admin/usuarios/:id/senha` | admin, alvo operador |

A listagem de contatos usa paginação padrão de 20, máximo de 100, e aceita:

- `nome`, `telefone`, `bairro`, `problema`, `origem` e `status`;
- `consentimentoWhatsapp` e `consentimentoLigacoes`;
- `autorizacaoMensagens` e `autorizacaoLigacoes`;
- `idadeMinima` e `idadeMaxima`;
- `dataInicial` e `dataFinal`;
- `eventoId=<id>` ou `eventoId=sem_evento`;
- `ordenacao=mais_recentes|mais_antigos|nome_asc|nome_desc`;
- `pagina` e `limite`.

Nome e telefone podem ser combinados com `eventoId`. O botão `Ver participantes` da tela de eventos abre essa listagem com o evento selecionado, permitindo conferir rapidamente uma inscrição por nome completo ou telefone formatado.

### 3.7 Perfis e permissões

| Ação | Operador | Administrador |
|---|---:|---:|
| Consultar, cadastrar e atualizar contatos | Sim | Sim |
| Importar CSV/XLSX | Sim | Sim |
| Revogar mensagens ou ligações | Sim | Sim |
| Solicitar exclusão | Sim | Sim |
| Visualizar eventos | Sim | Sim |
| Criar, editar, ativar ou encerrar eventos | Não | Sim |
| Aprovar ou rejeitar exclusão | Não | Sim |
| Exportar CSV/Excel | Não | Sim |
| Gerar backup | Não | Sim |
| Criar usuários | Não | Sim |
| Redefinir senha de operador | Não | Sim |

Um administrador pode:

- atualizar o próprio nome;
- criar operador ou administrador;
- redefinir a senha de um operador.

Um administrador não pode alterar a conta nem a senha de outro administrador.

### 3.8 Importação

- formatos: CSV e XLSX;
- tamanho máximo: 5 MB, preservado para evitar pressão excessiva de memória na instância de 512 MiB;
- máximo: 20.000 linhas;
- processamento em duas etapas: pré-visualizar e confirmar;
- pré-visualização e confirmação em lotes parametrizados de 500 linhas;
- apenas uma confirmação pode ser processada por vez, coordenada por advisory lock do PostgreSQL;
- falha inesperada em lote retorna ao processamento isolado das linhas afetadas;
- telefone é o único dado obrigatório da linha;
- o banco mantém `NULL` em campos ausentes; a interface mostra `Não informado`;
- linhas inválidas, repetidas ou já processadas são identificadas;
- contato existente pode receber somente informações que estavam vazias;
- dados já preenchidos não são silenciosamente substituídos;
- complementos efetivos geram histórico;
- a importação não cria consentimentos automaticamente.

Cabeçalhos reconhecidos:

| Dado | Cabeçalhos aceitos |
|---|---|
| telefone | `telefone`, `celular`, `whatsapp` |
| nome | `nome`, `nome_completo` |
| bairro | `bairro` |
| idade | `idade` |
| categoria | `categoria`, `categoria_problema`, `problema` |
| descrição legada/opcional da importação | `descricao`, `descricao_problema`, `detalhes` |

A descrição continua aceita somente por compatibilidade das importações e do cadastro interno. Ela não aparece no formulário público.

### 3.9 Consentimentos e privacidade

- aceite de privacidade é obrigatório para o formulário público;
- mensagens e ligações são autorizações separadas;
- os textos apresentados são armazenados com versão, canal e origem;
- a mesma resposta, texto, versão e origem não deve gerar evento duplicado;
- revogação cria novo registro e referencia o anterior;
- revogações não são apagadas;
- revogação e solicitação de exclusão bloqueiam os usos correspondentes;
- pedido pendente bloqueia mensagens, ligações e campanhas;
- o consentimento legado `mensagens_whatsapp` não é convertido automaticamente.

### 3.10 Exclusão

Operador e administrador podem solicitar. Somente administrador pode aprovar ou rejeitar.

Ao aprovar:

- o contato é excluído fisicamente;
- dados pessoais dependentes são removidos conforme as chaves estrangeiras;
- consentimentos e a solicitação permanecem como trilha administrativa sem referência ativa ao contato;
- a solicitação registra solicitante, analista, datas e observações.

Não existe endpoint de exclusão direta de contato, revogação ou histórico.

### 3.11 Eventos

- estados: `rascunho`, `ativo` e `encerrado`;
- somente um evento pode estar ativo;
- o índice parcial único `eventos_apenas_um_ativo` garante essa regra diretamente no PostgreSQL;
- contém nome, motivo, data inicial e data final;
- a criação, edição, ativação e encerramento geram histórico;
- o formulário público mantém o mesmo endereço;
- o backend decide automaticamente se o telefone é novo ou se nome completo e telefone correspondem a um cadastro existente;
- o contato permanece único e mantém a origem original quando participa posteriormente de um evento;
- a restrição única de `contato_eventos` impede repetição do mesmo par contato/evento;
- inscrições repetidas retornam uma confirmação clara sem criar outro vínculo;
- operadores acessam a tela em modo somente leitura e podem abrir a lista de participantes;
- somente administradores veem e executam criação, edição, ativação e encerramento;
- listagem e relatórios podem filtrar pelo evento ou por ausência de evento.

### 3.12 Relatórios, exportação e backup

Relatórios apresentam totais e agrupamentos por bairro, categoria, origem, idade, data e evento. A quantidade máxima carregada é limitada por `RELATORIO_LIMITE_REGISTROS`.

Exportações:

- CSV separado por ponto e vírgula;
- planilha XLSX;
- exclusivas para administrador;
- usam os mesmos filtros do relatório;
- nomes no formato `a-voz-do-bairro-contatos-AAAA-MM-DD_HH-mm-ss`.

Backup:

- executa `pg_dump` sem shell;
- formato custom restaurável pelo PostgreSQL;
- exclusivo para administrador;
- impede duas execuções simultâneas;
- calcula SHA-256;
- registra responsável, estado, nome, tamanho, hash e eventual erro;
- remove o arquivo temporário do servidor depois do download;
- nome no formato `a-voz-do-bairro-backup-completo-postgresql-AAAA-MM-DD_HH-mm-ss.backup`.

### 3.13 Banco de dados

O schema possui 22 tabelas:

| Grupo | Tabelas |
|---|---|
| Cadastro | `bairros`, `origens`, `usuarios`, `contatos` |
| Privacidade e auditoria | `consentimentos`, `aceites_privacidade`, `historico_contatos`, `solicitacoes_exclusao`, `tentativas_login`, `backups_banco` |
| Eventos | `eventos`, `historico_eventos`, `contato_eventos` |
| Importação e conteúdo | `importacoes`, `importacao_linhas`, `textos_formulario` |
| Preparação ManyChat | `campanhas`, `campanha_contatos`, `envios_campanha`, `respostas_campanha`, `eventos_manychat`, `sincronizacoes_manychat` |

Proteções relevantes:

- identidade numérica e chaves estrangeiras;
- telefone normalizado único;
- e-mail de usuário único sem diferenciar maiúsculas/minúsculas;
- apenas um evento ativo;
- apenas uma solicitação pendente por contato;
- apenas um consentimento ativo de cada tipo por contato;
- índices de busca, filtros e datas;
- triggers de atualização de data;
- triggers que impedem inserir em campanha ou enviar para contato bloqueado;
- função `contato_pode_receber_campanha` como proteção adicional no banco.

As tabelas relacionadas ao ManyChat são somente preparação estrutural. A API, os webhooks, as filas e o envio real pelo ManyChat ainda não foram implementados.

Para criar um banco novo e vazio:

```powershell
createdb criar_banco
psql --set ON_ERROR_STOP=1 --dbname criar_banco --file backend/database/criar_banco.sql
```

O projeto atual não possui migrations. O script completo recusa execução em banco que já tenha estrutura. Nunca execute `criar_banco.sql` sobre banco existente com dados.

## 4. Frontend

### 4.1 Tecnologias

- React 19;
- React DOM;
- React Router DOM 7;
- Vite 8;
- JavaScript e CSS, sem TypeScript;
- Fetch API nativa.

Não há biblioteca visual externa. Componentes, layout responsivo e gráficos são implementados no próprio frontend.

### 4.2 Rotas e páginas

| Rota | Página | Acesso |
|---|---|---|
| `/` | Redireciona para `/participar` | público |
| `/participar` | Formulário A Voz do Bairro | público |
| `/login` | Login administrativo | público |
| `/admin` | Visão geral com indicadores | operador/admin |
| `/admin/contatos` | Listagem, filtros e paginação | operador/admin |
| `/admin/contatos/:id` | Detalhes, histórico e privacidade | operador/admin |
| `/admin/contatos/novo` | Cadastro/atualização interna | operador/admin |
| `/admin/importacoes` | CSV/XLSX | operador/admin |
| `/admin/relatorios` | Indicadores, gráficos e exportação | operador/admin |
| `/admin/eventos` | Consulta para operador; gestão para administrador | operador/admin |
| `/admin/solicitacoes-exclusao` | Fila de análise | admin |
| `/admin/backups` | Backup e histórico | admin |
| `/admin/usuarios` | Usuários e senhas de operadores | admin |
| `*` | Página não encontrada | público |

### 4.3 Organização

- `pages`: telas vinculadas às rotas;
- `components`: campos, seletores, paginação, tabela, mensagens, navegação e proteção de rotas;
- `services`: comunicação HTTP por domínio;
- `utils`: token e formatação de telefone;
- `data`: textos de consentimento usados pelo formulário;
- `styles`: CSS global, público, login e painel.

O serviço `api.js`:

- lê `VITE_API_URL`;
- remove barras extras da URL;
- adiciona JSON quando necessário;
- injeta o Bearer Token em chamadas autenticadas;
- preserva `FormData` para upload;
- transforma falhas HTTP e de conexão em mensagens para a interface.
- repete somente consultas GET diante de falhas transitórias, com espera progressiva.

O token e os dados básicos do usuário são mantidos no armazenamento local do navegador. Respostas 401 removem a sessão e redirecionam para o login. O frontend oculta ações não permitidas, mas o backend continua sendo a autoridade final.

### 4.4 Formulário público e visual

- layout de uma coluna;
- responsivo para celulares, notebooks e telas maiores;
- cor principal `#ff5c00`;
- cabeçalho discreto, formulário direto e rodapé;
- identificação A Voz do Bairro e Diogo Ventura;
- seletor pesquisável de bairro;
- categoria em seleção fechada;
- consentimentos desmarcados inicialmente;
- contexto de evento exibido somente quando há evento ativo;
- com evento ativo, primeira etapa reduzida a nome completo e telefone;
- contato existente recebe confirmação curta; contato novo segue ao formulário completo;
- os dados armazenados não são exibidos pela identificação pública;
- opção `Meus dados mudaram` disponível depois da correspondência;
- botão de WhatsApp exibido somente se o número estiver configurado;
- aviso de privacidade após o formulário.

### 4.5 Configuração e execução

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

```env
VITE_API_URL=http://localhost:3000
VITE_WHATSAPP_NUMERO=5521999999999
```

O número do WhatsApp deve conter somente país, DDD e número. O botão abre `wa.me` em uma nova aba e não envia dados automaticamente.

Endereços locais padrão:

- formulário: `http://localhost:5173/participar`;
- login: `http://localhost:5173/login`;
- saúde da API: `http://localhost:3000/api/teste`.

Build de produção:

```powershell
npm run build
```

## 5. Scripts operacionais e testes

Backend:

```powershell
npm test
npm run criar-admin -- "Nome" "email@dominio.com" "SenhaForte123!"
npm run testar:schema-vazio
npm run testar:importacao-carga
npm run banco:sincronizar-sequencias
```

O conjunto `npm test` executa verificações de:

- estrutura do banco;
- cadastro público;
- administração de contatos;
- cadastro manual;
- importações;
- relatórios e exportações;
- autenticação, usuários e permissões;
- privacidade e revogações;
- eventos e exclusões;
- backups.

Último resultado documentado no projeto, em 24/07/2026: 300 verificações do backend aprovadas e build do frontend concluído com 61 módulos transformados.

O teste adicional `testar:importacao-carga` valida separadamente 15.000 contatos temporários em um único arquivo, a rejeição de 20.001 linhas, pré-visualização, confirmação, contagem persistida, limpeza automática e ressincronização das sequências utilizadas. O limite aceito de 20.000 linhas também foi executado com sucesso. O script recusa execução em produção.

## 6. Publicação definida

- frontend: Vercel;
- backend: DigitalOcean App Platform, 512 MiB;
- banco: PostgreSQL gerenciado da DigitalOcean.

Na publicação:

1. criar o banco gerenciado na mesma região do backend quando possível;
2. executar o schema somente no banco vazio;
3. configurar segredos no painel da DigitalOcean;
4. publicar a pasta `backend`;
5. configurar `VITE_API_URL` e `VITE_WHATSAPP_NUMERO` na Vercel;
6. configurar `FRONTEND_URL` com o domínio final;
7. validar SSL, CORS, login, formulário, painel, exportação e backup;
8. habilitar deploy automático somente na branch de produção desejada.
9. configurar readiness em `/api/saude/pronto` e liveness em `/api/saude/vivo`;
10. ativar alertas e testar restauração do backup.

O Vercel Hobby deve ser usado apenas se o projeto se enquadrar nas condições pessoais e não comerciais vigentes da plataforma.

O backend de 512 MiB não permite escala horizontal e o PostgreSQL de nó único não é altamente disponível. Para uma operação que não aceite indisponibilidade por falha de instância, são necessárias pelo menos duas instâncias do backend e um standby do PostgreSQL. O código reduz e recupera falhas transitórias, mas não elimina uma falha física de nó único.

## 7. Pendências reais

- integração efetiva com API e webhooks do ManyChat;
- filas e execução real de campanhas;
- armazenamento externo e política de retenção de backups em produção;
- definição jurídica final dos textos de privacidade e consentimento;
- processo formal para alterações incrementais do banco após a publicação.
