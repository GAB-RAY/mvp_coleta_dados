# Prompt mestre — Central de Comunicação / A Voz do Bairro

O texto abaixo pode ser enviado a uma IA de desenvolvimento para construir ou reconstruir o sistema. Ele descreve o comportamento esperado e deve ser tratado como especificação funcional e técnica.

---

## INÍCIO DO PROMPT

Você é um desenvolvedor sênior responsável por construir o sistema profissional **Central de Comunicação**, cuja interface pública se chama **A Voz do Bairro**.

Leia esta especificação inteira antes de alterar arquivos. Não invente campos, endpoints, permissões ou regras. Quando houver dúvida que altere negócio, banco, segurança ou privacidade, apresente a dúvida antes de decidir.

### 1. Objetivo

Construir uma aplicação para:

- coletar dados comunitários por formulário público;
- organizar contatos em um painel administrativo;
- registrar consentimentos e aceite de privacidade;
- permitir cadastro interno e importação de listas;
- administrar eventos associados ao mesmo formulário público;
- produzir indicadores e exportações;
- controlar pedidos de exclusão;
- gerar backup técnico do PostgreSQL;
- deixar estrutura de banco preparada, mas sem integração ativa, para o ManyChat.

Use sempre a palavra **contatos** para as pessoas cadastradas.

### 2. Tecnologias obrigatórias

Backend:

- Node.js;
- Express;
- CommonJS com `require` e `module.exports`;
- PostgreSQL;
- pacote `pg`;
- bcrypt;
- jsonwebtoken;
- helmet;
- cors;
- multer;
- exceljs;
- compression;
- express-rate-limit;
- dotenv;
- JavaScript, sem TypeScript;
- SQL direto e parametrizado;
- sem ORM, Prisma ou Sequelize.

Frontend:

- React;
- Vite;
- React Router DOM;
- JavaScript e CSS;
- Fetch API;
- sem TypeScript;
- sem dados simulados.

Qualidade de código:

- nunca usar `var`; usar `const` e `let`;
- preferir funções tradicionais; usar arrow function somente quando realmente fizer sentido no frontend;
- nomes de domínio claros em português;
- nomes convencionais da linguagem e framework, como `next`, `Error` e `AppError`, podem permanecer em inglês;
- código simples, legível e sem abstrações exageradas;
- não criar arquivos `index.js` apenas para reexportar;
- não misturar controller, service e model;
- não armazenar senha, token ou credencial no Git.

### 3. Arquitetura

Estrutura mínima:

```text
backend/
  database/
    criar_banco.sql
  scripts/
  src/
    config/
      banco.js
      categoriasProblema.js
    middlewares/
      autenticarUsuario.js
      autorizarAdministrador.js
      identificarRequisicao.js
      limitarConcorrencia.js
      limitarRequisicoes.js
      rotaNaoEncontrada.js
      tratarErro.js
    modules/
      autenticacao/
      backups/
      bairros/
      contatos/
      eventos/
      exclusoes/
      importacoes/
      origens/
      relatorios/
      teste/
      usuarios/
    utils/
      AppError.js
      normalizarTelefone.js
    app.js
    server.js

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
```

No backend, manter:

```text
Route -> Controller -> Service -> Model -> PostgreSQL
```

- Controller recebe `req`, `res` e `next`, chama o service e responde HTTP.
- Service valida e executa regras de negócio.
- Model executa SQL parametrizado e transações.
- Route apenas declara endpoint e middleware.

### 4. Identidade visual

Formulário público:

- título: `A VOZ DO BAIRRO`;
- chamada: `Sua voz pode ajudar a transformar o seu bairro.`;
- texto: `Informe a principal necessidade da sua região e ajude a identificar as demandas dos bairros do Rio de Janeiro.`;
- identificação: `Projeto de participação cidadã promovido por Diogo Ventura.`;
- responsável pela iniciativa e pelo tratamento dos dados: Diogo Ventura;
- cor principal: laranja `#ff5c00`;
- formulário em uma coluna;
- layout direto, confiável e totalmente responsivo;
- cabeçalho discreto e rodapé;
- sem excesso de cartões, ilustrações ou textos repetidos.

Painel:

- nome: `Central de Comunicação`;
- projeto identificado como `A Voz do Bairro`;
- navegação lateral em desktop e adaptada para celular;
- laranja `#ff5c00` como cor de ação;
- textos e tabelas legíveis;
- visão geral e relatórios com indicadores e gráficos;
- sem dados simulados.

### 5. Formulário público

Rota principal: `/participar`. A rota `/` redireciona para ela.

Campos visíveis:

- nome completo, obrigatório;
- telefone, obrigatório;
- bairro, obrigatório e pesquisável;
- idade, obrigatória, inteira, mínimo 16 e máximo 120;
- categoria da principal necessidade, obrigatória;
- autorização opcional para mensagens;
- autorização opcional para ligações;
- aceite obrigatório do Aviso de Privacidade.

Não incluir:

- descrição do problema no formulário público;
- pergunta eleitoral;
- data de nascimento;
- seleção manual de evento;
- acesso ao painel administrativo dentro do formulário.

O botão `Falar pelo WhatsApp`:

- só aparece se `VITE_WHATSAPP_NUMERO` estiver configurada;
- recebe país, DDD e número somente com dígitos;
- abre `wa.me` em outra aba;
- não envia dados do formulário automaticamente.

Consentimentos opcionais iniciam desmarcados e não podem impedir o envio. O aceite de privacidade deve estar separado e é obrigatório.

Mensagem exata de sucesso:

`Cadastro realizado com sucesso. Obrigado por contribuir com o projeto A Voz do Bairro.`

Proteção de carga pública:

- cache em memória com proteção contra stampede para os bairros;
- cache HTTP curto para opções do formulário;
- rate limit por combinação de IP e telefone;
- limite global alto por IP para conter abuso sem bloquear eventos legítimos;
- limite de requisições simultâneas e resposta 503 com `Retry-After`;
- corpo JSON limitado a 32 KB;
- não usar o PostgreSQL como armazenamento do rate limit, evitando aumentar a carga durante ataques;
- deixar limites configuráveis por ambiente.

### 6. Catálogos

Os bairros devem vir do PostgreSQL. Carregar 166 bairros do município do Rio de Janeiro no schema inicial. O backend valida o nome canônico e retorna a lista ativa ao frontend.

As categorias ficam centralizadas no backend e são retornadas ao formulário. Catálogo inicial:

- Saneamento básico;
- Saúde;
- Educação;
- Segurança pública;
- Iluminação pública;
- Limpeza urbana e coleta de lixo;
- Pavimentação e buracos;
- Transporte e mobilidade;
- Enchentes e drenagem;
- Moradia;
- Áreas de lazer e esporte;
- Assistência social;
- Meio ambiente;
- Outro.

### 7. Cadastro e duplicidade

- normalizar telefone removendo tudo que não seja número;
- aceitar de 10 a 15 dígitos;
- impedir dois contatos com o mesmo telefone normalizado;
- nunca sobrescrever silenciosamente dados existentes pelo formulário público;
- nova submissão pública pode preencher somente campos anteriormente nulos ou vazios;
- nome, bairro, categoria ou qualquer dado já preenchido não deve ser alterado pelo fluxo público;
- criar histórico apenas para campos efetivamente preenchidos ou alterados;
- se não houver novidade, não criar histórico repetido;
- não revelar dados privados do registro anterior;
- consentimento só muda quando a pessoa fornece resposta explícita.

No painel, operador e administrador podem cadastrar ou atualizar contato, sempre com origem e auditoria.

Campos ausentes de listas importadas permanecem `NULL` no banco. Exibir `Não informado` somente na interface; não gravar esse texto como dado.

### 8. Eventos

Um administrador pode:

- cadastrar;
- editar enquanto permitido pela regra de estado;
- ativar;
- encerrar.

Evento possui:

- nome;
- motivo;
- data inicial;
- data final;
- estado `rascunho`, `ativo` ou `encerrado`;
- usuário criador e atualizador;
- datas de criação e atualização.

Regras:

- somente um evento ativo por vez;
- registrar histórico de criação, edição, ativação e encerramento;
- o endereço público nunca muda;
- se houver evento ativo dentro do período, vincular automaticamente o cadastro;
- nesse caso, o frontend informa o contexto do evento;
- se não houver evento ativo, aceitar o cadastro normalmente e não mostrar aviso adicional;
- permitir filtro de contatos e relatórios por evento ou sem evento.

### 9. Autenticação e usuários

Login:

- e-mail e senha;
- bcrypt para comparação;
- JWT com tempo configurável;
- retornar token e dados básicos do usuário;
- registrar tentativas de login;
- bloquear temporariamente excesso de falhas por conta/e-mail/IP;
- nunca confirmar se um e-mail existe;
- extrair Bearer Token no middleware e preencher `req.usuario`.

Perfis:

- `operador`;
- `administrador`.

Administrador pode:

- criar operador;
- criar administrador;
- atualizar o próprio nome;
- redefinir a senha de operador.

Administrador não pode alterar dados nem senha de outro administrador. Operador não acessa gestão de usuários.

Criar script:

```powershell
npm run criar-admin -- "Nome" "email@dominio.com" "SenhaForte123!"
```

### 10. Permissões

Operador e administrador:

- consultar contatos;
- usar busca, filtros e paginação;
- cadastrar/atualizar contato internamente;
- importar CSV/XLSX;
- consultar relatórios;
- visualizar eventos;
- revogar mensagens, ligações ou ambos;
- solicitar exclusão.

Somente administrador:

- criar e gerenciar eventos;
- criar usuários;
- redefinir senha de operador;
- aprovar ou rejeitar exclusão;
- exportar CSV;
- exportar Excel;
- gerar e baixar backup PostgreSQL;
- consultar o histórico de backups.

O backend deve validar todas as permissões. Esconder botão no frontend não substitui autorização na API.

### 11. Consentimentos e privacidade

Novas autorizações oficiais:

- mensagens;
- ligações.

O aceite de privacidade não é consentimento de comunicação.

Cada registro guarda:

- contato atual e identificador original;
- tipo;
- resposta e estado;
- texto exato apresentado;
- versão do texto;
- canal;
- origem;
- usuário responsável quando administrativo;
- datas;
- registro anterior quando houver ajuste ou revogação;
- motivo opcional da revogação.

Estados: `autorizado`, `recusado` e `revogado`. Ausência de resposta é representada pela falta de autorização ativa e exibida como `Não informado` quando necessário.

Não duplicar histórico quando resposta, texto, versão e origem forem idênticos. Registrar novo evento quando resposta, versão, origem ou revogação mudar.

O consentimento legado `mensagens_whatsapp` pode existir como histórico, mas nunca deve ser convertido automaticamente em autorização atual.

Revogação:

- operador e administrador podem revogar mensagens, ligações ou ambos;
- registrar usuário, data, hora e motivo opcional;
- preservar o registro anterior;
- nunca apagar revogações;
- impedir automaticamente os usos revogados;
- repetição sem mudança não cria histórico duplicado.

### 12. Solicitação de exclusão

- operador ou administrador solicita;
- pedido inicia como `pendente`;
- somente administrador aprova ou rejeita;
- apenas um pedido pendente por contato;
- enquanto pendente, bloquear mensagens, ligações e campanhas;
- manter solicitante, analista, observações, data de solicitação, análise e execução;
- aprovação exclui fisicamente o contato;
- preservar consentimentos e a solicitação como trilha administrativa, sem dados pessoais ativos;
- não criar endpoint de exclusão direta;
- não permitir apagar revogações ou históricos.

### 13. Importação CSV/XLSX

- upload em memória;
- máximo 5 MB;
- máximo 5.000 linhas;
- origem da lista obrigatória;
- pré-visualizar antes de confirmar;
- persistir as linhas da pré-visualização em lotes parametrizados de 500;
- mostrar no máximo 100 linhas na prévia;
- telefone é obrigatório;
- outros campos são opcionais;
- detectar repetição no arquivo;
- validar bairro e categoria;
- idade, quando presente, deve ser inteira entre 16 e 120;
- não criar consentimento por importação;
- se o contato existir, complementar apenas campos vazios;
- não substituir dados preenchidos;
- gerar histórico somente quando houver complemento.

Aliases aceitos:

- telefone: `telefone`, `celular`, `whatsapp`;
- nome: `nome`, `nome_completo`;
- bairro: `bairro`;
- idade: `idade`;
- categoria: `categoria`, `categoria_problema`, `problema`;
- descrição interna/legada: `descricao`, `descricao_problema`, `detalhes`.

### 14. Listagem, filtros e detalhes

`GET /api/admin/contatos` deve retornar contatos e:

```json
{
  "paginaAtual": 1,
  "limite": 20,
  "totalRegistros": 0,
  "totalPaginas": 0
}
```

Padrão `pagina=1`, `limite=20`, máximo 100. Resultado vazio retorna 200 com lista vazia.

Filtros:

- nome;
- telefone normalizado;
- bairro;
- categoria;
- origem;
- estado;
- autorizações de mensagens e ligações;
- idade mínima e máxima;
- data inicial e final;
- evento ou sem evento;
- ordenação por mais recentes, mais antigos, nome crescente ou decrescente.

Usar os mesmos filtros na listagem e na contagem. Não devolver `telefone_normalizado`.

Detalhes exibem:

- dados do contato;
- origem;
- eventos vinculados;
- consentimentos e revogações;
- aceites de privacidade;
- histórico de alterações;
- pedido de exclusão pendente, quando existir.

### 15. Relatórios e exportações

Gerar indicadores por:

- total de contatos;
- bairro;
- categoria;
- origem;
- faixa etária;
- data de cadastro;
- evento.

Criar gráficos simples e responsivos no frontend.

Exportação:

- somente administrador;
- CSV com ponto e vírgula e codificação adequada para planilha;
- XLSX gerado com ExcelJS;
- aplicar os mesmos filtros do relatório;
- limitar quantidade carregada por variável de ambiente;
- nomes `a-voz-do-bairro-contatos-AAAA-MM-DD_HH-mm-ss.csv` e `.xlsx`.

### 16. Backup

Criar no painel uma área exclusiva de administrador para:

- gerar e baixar backup completo do PostgreSQL;
- listar últimas operações;
- informar responsável, data, estado, tamanho e SHA-256.

Regras:

- usar `pg_dump` sem executar shell montado por concatenação;
- formato custom restaurável;
- não incluir credenciais no arquivo ou na resposta;
- impedir execuções simultâneas;
- aplicar tempo limite configurável;
- registrar sucesso e falha;
- remover o arquivo temporário depois do download;
- permitir configurar o caminho de `pg_dump`;
- nome `a-voz-do-bairro-backup-completo-postgresql-AAAA-MM-DD_HH-mm-ss.backup`.

Backup técnico não é CSV nem Excel. CSV e Excel são exportações de contatos.

### 17. Banco PostgreSQL

Criar `backend/database/criar_banco.sql` idempotente apenas no sentido de recusar execução em banco ocupado. Ele deve construir um banco vazio completo e falhar com mensagem clara se a estrutura já existir.

Não incluir dados pessoais, usuário real, hash real ou credencial. Incluir somente catálogos e textos técnicos iniciais.

Tabelas obrigatórias:

1. `bairros`;
2. `origens`;
3. `usuarios`;
4. `eventos`;
5. `historico_eventos`;
6. `contatos`;
7. `contato_eventos`;
8. `consentimentos`;
9. `solicitacoes_exclusao`;
10. `aceites_privacidade`;
11. `historico_contatos`;
12. `importacoes`;
13. `importacao_linhas`;
14. `tentativas_login`;
15. `backups_banco`;
16. `textos_formulario`;
17. `campanhas`;
18. `campanha_contatos`;
19. `envios_campanha`;
20. `respostas_campanha`;
21. `eventos_manychat`;
22. `sincronizacoes_manychat`.

Implementar chaves estrangeiras, checks, índices e triggers para:

- telefone normalizado único;
- e-mail único sem diferenciar caixa;
- bairro canônico;
- idade válida;
- estados válidos;
- apenas um evento ativo;
- apenas um pedido pendente por contato;
- somente um consentimento ativo do mesmo tipo por contato;
- auditoria e datas de atualização;
- impedir participação e novos envios em campanhas quando houver bloqueio, revogação, ausência de autorização ou pedido de exclusão pendente.

Manter `manychat_contact_id` em contatos e as seis tabelas de preparação ManyChat. Não implementar API, webhook, fila ou envio do ManyChat sem uma especificação futura aprovada.

Banco novo:

```powershell
createdb criar_banco
psql --set ON_ERROR_STOP=1 --dbname criar_banco --file backend/database/criar_banco.sql
```

Nunca executar o schema completo sobre banco com dados. Para qualquer mudança futura em produção: backup completo, restauração testada, script incremental versionado, teste em cópia, aplicação controlada e validação posterior. Nunca apagar ou recriar banco de produção.

### 18. Endpoints

Públicos:

- `GET /api/teste`;
- `GET /api/saude/vivo`;
- `GET /api/saude/pronto`;
- `GET /api/publico/contatos/opcoes`;
- `POST /api/publico/contatos`;
- `POST /api/autenticacao/login`.

Com JWT:

- `GET /api/admin/contatos`;
- `POST /api/admin/contatos`;
- `GET /api/admin/contatos/:id`;
- `POST /api/admin/contatos/:id/revogar-consentimentos`;
- `POST /api/admin/contatos/:id/solicitacao-exclusao`;
- `GET /api/admin/origens`;
- `POST /api/admin/importacoes/pre-visualizar`;
- `POST /api/admin/importacoes/:id/confirmar`;
- `GET /api/admin/relatorios/resumo`;
- `GET /api/admin/relatorios/exportar.csv`, somente admin;
- `GET /api/admin/relatorios/exportar.xlsx`, somente admin;
- `GET /api/admin/eventos`;
- `POST /api/admin/eventos`, somente admin;
- `PUT /api/admin/eventos/:id`, somente admin;
- `POST /api/admin/eventos/:id/ativar`, somente admin;
- `POST /api/admin/eventos/:id/encerrar`, somente admin;
- `GET /api/admin/solicitacoes-exclusao`, somente admin;
- `POST /api/admin/solicitacoes-exclusao/:id/aprovar`, somente admin;
- `POST /api/admin/solicitacoes-exclusao/:id/rejeitar`, somente admin;
- `GET /api/admin/backups`, somente admin;
- `POST /api/admin/backups/banco`, somente admin;
- `GET /api/admin/usuarios`, somente admin;
- `POST /api/admin/usuarios`, somente admin;
- `PATCH /api/admin/usuarios/meu-perfil`, somente admin;
- `PATCH /api/admin/usuarios/:id/senha`, somente admin e somente alvo operador.

Usar um formato uniforme de erro:

```json
{
  "mensagem": "Descrição segura do erro."
}
```

### 19. Frontend

Criar:

- formulário público;
- login sem link administrativo no formulário;
- visão geral;
- listagem de contatos;
- detalhes do contato;
- cadastro interno;
- importações;
- relatórios;
- eventos;
- fila de exclusões;
- backups;
- usuários;
- página não encontrada;
- proteção JWT;
- proteção visual de rotas de administrador;
- logout e tratamento de sessão expirada.

Rotas:

- `/participar`;
- `/login`;
- `/admin`;
- `/admin/contatos`;
- `/admin/contatos/:id`;
- `/admin/contatos/novo`;
- `/admin/importacoes`;
- `/admin/relatorios`;
- `/admin/eventos`;
- `/admin/solicitacoes-exclusao`;
- `/admin/backups`;
- `/admin/usuarios`.

Criar serviço HTTP central que:

- exige `VITE_API_URL`;
- injeta Bearer Token;
- trata JSON e `FormData`;
- preserva downloads de arquivos;
- converte erro de conexão em mensagem amigável;
- ao receber 401, remove sessão e leva ao login.

### 20. Variáveis de ambiente

Backend `.env.example`:

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

Frontend `.env.example`:

```env
VITE_API_URL=http://localhost:3000
VITE_WHATSAPP_NUMERO=5521999999999
```

### 21. Testes obrigatórios

Backend:

- criação do schema em banco vazio;
- tabelas, colunas, constraints, índices, funções e triggers;
- 166 bairros;
- conexão e saúde;
- cadastro público válido e inválido;
- telefone duplicado e complemento sem sobrescrita;
- evento ativo e ausência de evento;
- login, senha errada, bloqueio, JWT ausente/inválido/expirado;
- perfis e permissões;
- criação de usuário e proteção entre administradores;
- listagem, filtros, paginação e resultado vazio;
- cadastro interno e histórico;
- importação CSV/XLSX, limites, duplicidade e confirmação única;
- teste de carga repetível com pelo menos 2.500 contatos temporários e limpeza automática;
- consentimentos, revogações e repetição sem mudança;
- pedido, aprovação, rejeição e exclusão física;
- bloqueio de campanhas;
- relatórios, CSV e Excel;
- proibição de exportação para operador;
- backup, hash, erro, concorrência, auditoria e arquivo temporário;
- rota inexistente.
- readiness, liveness, rate limit, concorrência e corpo excessivo;
- configuração insegura de produção;
- recuperação de conexões PostgreSQL e desligamento gracioso.

Executar:

```powershell
cd backend
npm test
npm run testar:schema-vazio
npm run testar:importacao-carga
```

Frontend:

```powershell
cd frontend
npm run build
```

Executar `node --check` em todos os arquivos JavaScript do backend, `npm audit` nos dois projetos e uma busca para garantir ausência de `var`, credenciais e arquivos mortos.

### 22. Documentação e entrega

Criar README técnico fiel ao código, contendo:

- instalação;
- variáveis;
- banco;
- arquitetura;
- páginas;
- endpoints;
- permissões;
- regras;
- importação;
- exportação;
- backup;
- testes;
- publicação;
- pendências reais.

Não afirmar que ManyChat está integrado. Não afirmar que uma funcionalidade está pronta sem teste ou evidência no código.

Ao terminar:

1. mostrar arquivos criados e alterados;
2. listar testes executados e resultados reais;
3. informar erros e pendências;
4. confirmar que banco e dados existentes não foram apagados;
5. não fazer commit nem push sem autorização explícita.

### 23. Publicação planejada

- frontend na Vercel;
- backend na DigitalOcean App Platform com 512 MiB;
- PostgreSQL gerenciado na DigitalOcean;
- HTTPS em todas as conexões públicas;
- segredos configurados apenas nos painéis;
- banco e backend preferencialmente na mesma região;
- deploy automático ligado à branch de produção somente após validação;
- testes rápidos de formulário, login, painel, exportação e backup depois de cada publicação;
- readiness em `/api/saude/pronto` e liveness em `/api/saude/vivo`;
- alertas de deploy, reinício, CPU, memória, latência e banco;
- duas instâncias do backend e standby PostgreSQL quando indisponibilidade não for aceitável;
- teste de carga em homologação antes de campanhas ou eventos de grande alcance.

## FIM DO PROMPT

---

Este prompt representa o sistema atual. Qualquer evolução futura deve preservar dados, auditoria, permissões e compatibilidade, e precisa ser documentada depois de implementada e testada.
