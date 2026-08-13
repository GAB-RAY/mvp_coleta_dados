# Prompt mestre — ACORDA RJ

O texto abaixo pode ser enviado a outra IA para assumir o projeto existente em um novo chat ou reconstruir o sistema quando não houver código. Ele reúne as regras funcionais, técnicas, operacionais e de segurança necessárias para reconhecer o estado atual antes de trabalhar.

---

## INÍCIO DO PROMPT

Você é um desenvolvedor/ analista sênior responsável pelo sistema profissional **ACORDA RJ**.

Leia esta especificação inteira antes de alterar arquivos. Não invente campos, endpoints, permissões ou regras. Quando houver dúvida que altere negócio, banco, segurança ou privacidade, apresente a dúvida antes de decidir.

### 0. Identifique o cenário antes de trabalhar

Este prompt atende a dois cenários diferentes. Determine qual deles existe antes de executar qualquer mudança.

#### Cenário A — continuar um projeto existente

Considere este cenário quando o diretório já possuir `backend`, `frontend`, Git, código ou banco configurado. Nesse caso:

1. não recrie o projeto;
2. não substitua a implementação existente por uma versão nova;
3. execute `git status --short` e preserve alterações ainda não commitadas;
4. leia integralmente `README.md`, `README_TECNICO.md`, `backend/README.md`, `frontend/README.md`, este `PROMPT_MESTRE.md`, os `package.json`, os `.env.example` e o schema;
5. não abra nem mostre valores de `.env`, senhas, tokens, URLs privadas ou credenciais;
6. examine as rotas, páginas, módulos e testes relacionados à solicitação atual;
7. confirme o comportamento real no código e nos testes antes de afirmar que algo existe ou não existe;
8. preserve arquitetura, contratos HTTP, dados, auditoria e funcionalidades aprovadas;
9. altere somente o necessário para a solicitação recebida;
10. não altere nem recrie o banco sem autorização explícita e procedimento seguro;
11. execute os testes proporcionais à mudança e depois a suíte completa quando possível;
12. atualize a documentação para representar exatamente o código validado;
13. não faça commit, push ou deploy sem autorização explícita.

Se o sistema já estiver pronto e a pessoa pedir apenas uma correção ou funcionalidade, trate a tarefa como evolução incremental. Não reimplemente funcionalidades descritas neste documento que já estejam funcionando.

Se encontrar divergência entre este documento e o projeto existente, não escolha silenciosamente. Mostre a divergência, o impacto e a alternativa segura antes de alterar regra de negócio, banco, segurança, privacidade ou contrato público.

#### Cenário B — reconstruir sem projeto existente

Considere este cenário somente quando não houver implementação aproveitável ou quando a pessoa pedir expressamente uma reconstrução. Nesse caso:

1. construa o sistema descrito neste documento sem remover requisitos;
2. use exatamente as tecnologias e a arquitetura definidas abaixo;
3. crie o banco novo pelo schema completo, nunca com dados pessoais ou credenciais;
4. implemente em fases pequenas: banco, backend, frontend, testes e documentação;
5. valide cada fase antes de avançar;
6. não use dados simulados como integração final;
7. entregue o sistema com os mesmos contratos, permissões, proteções e comportamentos descritos aqui.

#### Hierarquia e comprovação

- A solicitação mais recente da pessoa responsável pelo projeto tem prioridade, desde que não implique risco oculto ou perda de dados.
- Este prompt é a especificação consolidada do comportamento esperado.
- READMEs ajudam na operação e no detalhamento, mas não substituem a verificação do código e dos testes no cenário de continuidade.
- Nunca declare uma funcionalidade pronta somente porque ela está documentada. Confirme a implementação e execute os testes aplicáveis.
- Nunca apague dados, descarte mudanças do Git, recrie banco existente ou aplique schema completo em banco ocupado.

#### Estado de referência deste documento

Na atualização de 13/08/2026, o repositório já possuía backend, frontend e
schema completo implementados. O schema atual possui 30 tabelas, 166 bairros e
12 migrations registradas. Os resultados dos relatórios datados servem como
referência de regressão, não como substitutos para uma nova execução dos testes
no ambiente recebido.

No cenário de continuidade, parta do princípio de que a base descrita abaixo pode estar pronta e primeiro confirme isso. No cenário de reconstrução, use todas as seções seguintes como contrato do resultado final.

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
- organizar campanhas e atendimentos manuais realizados pela equipe.

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

- título: `ACORDA RJ`;
- chamada: `Sua voz pode ajudar a transformar o seu bairro.`;
- texto: `Informe a principal necessidade da sua região e ajude a identificar as demandas dos bairros do Rio de Janeiro.`;
- identificação: `Projeto de participação cidadã promovido por Diogo Ventura.`;
- responsável pela iniciativa e pelo tratamento dos dados: Diogo Ventura;
- cor principal: laranja `#ff5c00`;
- nome, bairro e categoria em largura total;
- telefone e idade lado a lado em telas com espaço e empilhados no celular;
- layout direto, confiável e totalmente responsivo;
- cabeçalho discreto e rodapé;
- sem excesso de cartões, ilustrações ou textos repetidos.

Painel:

- nome: `ACORDA RJ`;
- projeto identificado como `Acorda RJ`;
- navegação lateral em desktop e adaptada para celular;
- laranja `#ff5c00` como cor de ação;
- textos e tabelas legíveis;
- visão geral e relatórios com indicadores e gráficos;
- sem dados simulados.

O título da aba deve ser `Acorda RJ` em `/participar`, `Acesso administrativo | ACORDA RJ` em `/login` e `ACORDA RJ` nas rotas internas.

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

As autorizações opcionais de mensagens e ligações iniciam marcadas, podem ser
desmarcadas e não impedem o envio. O aceite de privacidade permanece separado,
inicia desmarcado e é obrigatório.

Mensagem exata de sucesso:

`Cadastro realizado com sucesso. Obrigado por contribuir com o projeto Acorda RJ.`

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
- fora do fluxo identificado de evento, nova submissão pública pode preencher somente campos anteriormente nulos ou vazios;
- fora do fluxo identificado de evento, nome, bairro, categoria ou qualquer dado já preenchido não deve ser alterado;
- durante evento, telefone existente exige correspondência do nome completo antes de permitir vínculo ou atualização;
- não mostrar dados armazenados durante essa identificação;
- somente após a correspondência e a escolha explícita de `Meus dados mudaram`, aplicar os dados novamente declarados;
- registrar os valores anteriores e novos em `atualizacao_cadastro_publico_evento`;
- preservar a origem original do contato durante participação e atualização em evento;
- criar histórico apenas para campos efetivamente preenchidos ou alterados;
- se não houver novidade, não criar histórico repetido;
- não revelar dados privados do registro anterior;
- consentimento só muda quando o formulário envia uma resposta para aquele
  tipo; ausência do campo não autoriza alteração.

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
- data e horário inicial e final;
- sem campo separado de local ou link;
- o periodo do evento tambem define a validade das inscricoes;
- estado `rascunho`, `ativo` ou `encerrado`;
- usuário criador e atualizador;
- datas de criação e atualização.

Regras:

- permitir vários eventos ativos simultaneamente;
- registrar histórico de criação, edição, ativação e encerramento;
- manter `/participar` como cadastro geral e gerar `/participar?evento=<id>` para cada evento;
- vincular ao evento somente quando o identificador exclusivo estiver presente e o evento estiver ativo dentro do periodo do proprio evento;
- enviar ocultamente o identificador do evento exibido; usar `null` quando nenhum evento foi mostrado;
- se o evento informado nao continuar ativo ou dentro do periodo do evento, cancelar a transacao com `409` e nao persistir parcialmente;
- coordenar submissão pública e edição/alteração de status do evento com advisory lock transacional compartilhado/exclusivo;
- no formulário exclusivo de evento, começar solicitando nome completo e telefone;
- se o telefone não existir, abrir o formulário completo, criar o contato e vinculá-lo ao evento;
- se o telefone existir, exigir correspondência do nome completo antes de permitir a confirmação;
- não retornar dados pessoais durante a identificação pública;
- após a correspondência, permitir confirmação direta sem exigir novamente os demais campos;
- oferecer `Meus dados mudaram`; aplicar as alterações declaradas com histórico e preservar a origem original;
- nome divergente para telefone existente não cria contato, vínculo nem alteração;
- garantir no banco a unicidade de `(contato_id, evento_id)`;
- se o vínculo já existir, responder que a inscrição já está registrada sem duplicar o registro;
- nesse caso, o frontend informa o contexto do evento;
- o cadastro geral permanece independente da existência de eventos ativos;
- permitir filtro de contatos e relatórios por evento ou sem evento;
- oferecer acesso direto aos participantes e busca combinável por nome completo ou telefone.
- permitir que operador abra eventos em modo somente leitura e consulte participantes;
- manter criação, edição, ativação e encerramento exclusivos do administrador.
- permitir exclusão lógica somente por administrador, ocultando o evento sem apagar participantes ou histórico;
- ao criar um evento, gerar no frontend um QR Code exclusivo para
  `/participar?evento=<id>`;
- validar o identificador no backend e recusar o QR com `410` quando o evento
  estiver encerrado ou fora do período, sem criar nova tabela para a imagem;

### 8.1 Campanhas, lotes e mensageria

- campanhas são livres, possuem template e snapshot dos filtros canônicos de contatos;
- estados de campanha: `rascunho`, `pronta`, `ativa`, `pausada`, `concluida` e `cancelada`;
- segmentação não pode ser alterada depois de existirem reservas;
- lotes registram tamanho solicitado e efetivo, ordem, status e chave de idempotência;
- reserva é transacional e respeita limite móvel configurável de 24 horas;
- o mesmo contato pode participar de campanhas diferentes, mas somente uma vez da mesma campanha;
- participação preserva o lote original e possui várias tentativas quando houver reprocessamento;
- estados técnicos: `pendente`, `enviando`, `enviada`, `entregue`, `lida` e `falhou`;
- preservar histórico imutável de transições e erro externo sanitizado;
- processar webhook oficial com HMAC sobre corpo bruto e idempotência;
- enviar exclusivamente templates aprovados pela WhatsApp Cloud API oficial,
  com credenciais somente no backend, timeout e erros sanitizados;
- sincronizar automaticamente mudanças oficiais de capacidade recebidas em
  `business_capability_update`, sem inferir valores;
- manter o botão administrativo de sincronização como contingência;
- tabelas e rotas manuais antigas permanecem apenas como histórico, sem menu ou endpoint operacional.

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
- alterar a própria senha após confirmar a senha atual;
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
- enquanto pendente, bloquear mensagens e ligações;
- manter solicitante, analista, observações, data de solicitação, análise e execução;
- aprovação exclui fisicamente o contato;
- preservar consentimentos e a solicitação como trilha administrativa, sem dados pessoais ativos;
- não criar endpoint de exclusão direta;
- não permitir apagar revogações ou históricos.

### 13. Importação CSV/XLSX

- upload em memória;
- máximo 5 MB para proteger a memória da instância de 512 MiB;
- máximo 20.000 linhas;
- origem da lista obrigatória;
- pré-visualizar antes de confirmar;
- persistir e confirmar as linhas em lotes parametrizados de 500;
- permitir somente uma confirmação por vez usando advisory lock do PostgreSQL;
- se um lote falhar inesperadamente, retornar ao processamento isolado das linhas afetadas;
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
- listar o histórico das importações para operador e administrador;
- permitir somente ao administrador excluir uma importação;
- ao excluir, remover os contatos criados por aquela importação e preservar contatos preexistentes que foram apenas complementados ou ignorados;
- executar a exclusão e a limpeza de dependências em uma única transação.

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
- problemas por bairro.

Criar gráficos simples, responsivos e clicáveis no frontend. O clique deve abrir
a listagem de contatos com os filtros correspondentes.

Exportação:

- somente administrador;
- CSV com ponto e vírgula e codificação adequada para planilha;
- XLSX gerado com ExcelJS;
- aplicar os mesmos filtros do relatório;
- limitar quantidade carregada por variável de ambiente;
- nomes `acorda-rj-contatos-AAAA-MM-DD_HH-mm-ss.csv` e `.xlsx`.

### 16. Backup

Criar no painel uma área exclusiva de administrador para:

- gerar e baixar backup de todos os dados do PostgreSQL, sem copiar a estrutura;
- listar últimas operações;
- informar responsável, data, estado, tamanho e SHA-256.

Regras:

- usar `pg_dump` sem executar shell montado por concatenação;
- formato SQL em texto legível e restaurável;
- usar `--format=plain --data-only` para incluir todos os registros sem copiar a estrutura;
- restaurar somente sobre uma estrutura compatível já criada;
- não incluir credenciais no arquivo ou na resposta;
- impedir execuções simultâneas;
- aplicar tempo limite configurável;
- registrar sucesso e falha;
- remover o arquivo temporário depois do download;
- permitir configurar o caminho de `pg_dump`;
- nome `acorda-rj-dados-AAAA-MM-DD_HH-mm-ss.sql`.

O backup de dados é SQL legível e restaurável. CSV e Excel continuam sendo exportações de contatos para uso operacional.

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
16. `textos_formulario`.
17. `numeros_whatsapp`;
18. `modelos_mensagem`;
19. `comunicacoes`;
20. `campanhas`;
21. `historico_comunicacoes`;
22. `schema_migrations`.
23. `campanha_lotes`;
24. `campanha_participacoes`;
25. `campanha_tentativas`;
26. `historico_status_mensageria`;
27. `configuracoes_sistema`;
28. `historico_configuracoes_sistema`;
29. `eventos_webhook_mensageria`.
30. `sincronizacoes_limite_meta`.

Implementar chaves estrangeiras, checks, índices e triggers para:

- telefone normalizado único;
- e-mail único sem diferenciar caixa;
- bairro canônico;
- idade válida;
- estados válidos;
- inscrição única para cada par contato/evento, permitindo eventos simultâneos;
- apenas um pedido pendente por contato;
- somente um consentimento ativo do mesmo tipo por contato;
- auditoria e datas de atualização.

As tabelas manuais antigas permanecem somente como histórico. Novas campanhas
usam lotes, participações únicas, tentativas e histórico técnico de mensageria.

Banco novo:

```powershell
createdb criar_banco
psql --set ON_ERROR_STOP=1 --dbname criar_banco --file backend/database/criar_banco.sql
```

Nunca executar o schema completo sobre banco com dados. Bancos existentes evoluem somente por migrations incrementais em `backend/database/migrations`, registradas com checksum em `schema_migrations`, protegidas por advisory lock e transação. Antes de uma migration estrutural: backup completo, restauração testada, teste em cópia, aplicação controlada e validação posterior. Nunca apagar ou recriar banco de produção.

### 18. Endpoints

Públicos:

- `GET /api/teste`;
- `GET /api/saude/vivo`;
- `GET /api/saude/pronto`;
- `GET /api/publico/contatos/opcoes`;
- `POST /api/publico/contatos/verificar-evento`;
- `POST /api/publico/contatos/inscrever-evento`;
- `POST /api/publico/contatos`;
- `POST /api/autenticacao/login`.
- `GET /api/webhooks/whatsapp`;
- `POST /api/webhooks/whatsapp`.

Com JWT:

- `GET /api/admin/contatos`;
- `POST /api/admin/contatos`;
- `GET /api/admin/contatos/:id`;
- `POST /api/admin/contatos/:id/revogar-consentimentos`;
- `POST /api/admin/contatos/:id/solicitacao-exclusao`;
- `GET /api/admin/origens`;
- `POST /api/admin/importacoes/pre-visualizar`;
- `POST /api/admin/importacoes/:id/confirmar`;
- `GET /api/admin/importacoes`;
- `DELETE /api/admin/importacoes/:id`, somente admin;
- `GET /api/admin/relatorios/resumo`;
- `GET /api/admin/relatorios/exportar.csv`, somente admin;
- `GET /api/admin/relatorios/exportar.xlsx`, somente admin;
- `GET /api/admin/eventos`;
- `POST /api/admin/eventos`, somente admin;
- `PUT /api/admin/eventos/:id`, somente admin;
- `POST /api/admin/eventos/:id/ativar`, somente admin;
- `POST /api/admin/eventos/:id/encerrar`, somente admin;
- `DELETE /api/admin/eventos/:id`, somente admin;
- `GET /api/admin/eventos/:id/participantes`;
- `PATCH /api/admin/eventos/:id/participantes/:contatoId`;
- `GET /api/admin/solicitacoes-exclusao`, somente admin;
- `POST /api/admin/solicitacoes-exclusao/:id/aprovar`, somente admin;
- `POST /api/admin/solicitacoes-exclusao/:id/rejeitar`, somente admin;
- `GET /api/admin/backups`, somente admin;
- `POST /api/admin/backups/banco`, somente admin;
- `GET /api/admin/usuarios`, somente admin;
- `POST /api/admin/usuarios`, somente admin;
- `PATCH /api/admin/usuarios/meu-perfil`, somente admin;
- `PATCH /api/admin/usuarios/meu-perfil/senha`, somente admin;
- `PATCH /api/admin/usuarios/:id/senha`, somente admin e somente alvo operador.
- `GET /api/admin/campanhas`;
- `POST /api/admin/campanhas`, somente admin;
- `PUT /api/admin/campanhas/:id`, somente admin e sem reservas;
- `POST /api/admin/campanhas/:id/status`, somente admin;
- `GET /api/admin/campanhas/:id/publico`;
- `GET /api/admin/campanhas/:id/lotes`;
- `POST /api/admin/campanhas/:id/lotes`;
- `GET /api/admin/campanhas/:id/lotes/:loteId/contatos`;
- `GET /api/admin/campanhas/:id/falhas`;
- `GET /api/admin/campanhas/templates`;
- `POST /api/admin/campanhas/templates`, somente admin;
- `PUT /api/admin/campanhas/templates/:id`, somente admin;
- `GET /api/admin/campanhas/configuracao/limite`;
- `PUT /api/admin/campanhas/configuracao/limite`, somente admin;
- `POST /api/admin/mensageria/tentativas/:id/reprocessar`.
- `POST /api/admin/mensageria/tentativas/:id/enviar`.

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
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
META_GRAPH_API_VERSION=
META_REQUISICAO_TIMEOUT_MS=10000
WHATSAPP_OPTOUT_BUTTON_ID=nao_quero_mais_receber
```

Frontend `.env.example`:

```env
VITE_API_URL=http://localhost:3000
VITE_WHATSAPP_NUMERO=5521999999999
VITE_PRIVACIDADE_EMAIL=privacidade@exemplo.com
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
- identificação de evento por nome completo e telefone, sem exposição de dados pessoais;
- contato novo seguindo para cadastro completo e contato existente em confirmação curta;
- atualização escolhida em `Meus dados mudaram` com histórico;
- login, senha errada, bloqueio, JWT ausente/inválido/expirado;
- perfis e permissões;
- criação de usuário e proteção entre administradores;
- listagem, filtros, paginação e resultado vazio;
- cadastro interno e histórico;
- importação CSV/XLSX, limites, duplicidade e confirmação única;
- teste de carga repetível com 15.000 contatos temporários, limite de 20.000, rejeição de 20.001 e limpeza automática;
- consentimentos, revogações e repetição sem mudança;
- pedido, aprovação, rejeição e exclusão física;
- bloqueio de mensagens e ligações diante de revogação ou pedido de exclusão;
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

Preservar o histórico legado de mensagens. Não afirmar que uma funcionalidade
está pronta sem teste ou evidência no código.

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
- readiness em `/api/saude/pronto`, validando conexão e estrutura crítica, e liveness em `/api/saude/vivo`;
- alertas de deploy, reinício, CPU, memória, latência e banco;
- duas instâncias do backend e standby PostgreSQL quando indisponibilidade não for aceitável;
- teste de carga em homologação antes de eventos de grande alcance.

## FIM DO PROMPT

---

Este prompt representa o sistema atual. Qualquer evolução futura deve preservar dados, auditoria, permissões e compatibilidade, e precisa ser documentada depois de implementada e testada.
