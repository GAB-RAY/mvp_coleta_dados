# Backend — Central de Comunicação

API do projeto Acorda VK construída com Node.js, Express, PostgreSQL, CommonJS e SQL parametrizado. A organização é modular por funcionalidade: controller → service → model.

## Instalação e ambiente

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Antes de iniciar o servidor, o `prestart` executa o sincronizador idempotente
dos estados de exclusão de eventos. Quando a estrutura já está atualizada,
nenhuma alteração é reaplicada.

Variáveis principais:

```env
NODE_ENV=development
PORTA=3000
BANCO_HOST=localhost
BANCO_PORTA=5432
BANCO_USUARIO=postgres
BANCO_SENHA=sua_senha
BANCO_NOME=criar_banco
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
JWT_SECRET=troque_por_um_segredo_forte
JWT_TEMPO_EXPIRACAO=8h
FRONTEND_URL=http://localhost:5173
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

Também é possível usar `DATABASE_URL`. O `.env` não deve ser versionado.

Em produção, `DATABASE_URL` deve usar `sslmode=require`, `verify-ca` ou `verify-full`; `JWT_SECRET` deve possuir pelo menos 32 bytes; `FRONTEND_URL` deve ser HTTPS. A aplicação falha antes de abrir a porta quando uma dessas configurações críticas está insegura ou ausente.

## Resiliência e carga pública

- o catálogo de 166 bairros permanece em cache por cinco minutos, com proteção contra várias cargas simultâneas;
- as opções públicas usam cache HTTP curto de 30 segundos;
- cada combinação de IP e telefone pode tentar o cadastro cinco vezes em 15 minutos por padrão;
- o limite global padrão é alto, 1.200 requisições por IP/minuto, para não bloquear eventos legítimos;
- no máximo 100 requisições ficam ativas por processo; excesso recebe 503 e `Retry-After`;
- o pool usa cinco conexões por instância, com limites de conexão, consulta, comando, bloqueio e transação ociosa;
- falhas temporárias de PostgreSQL retornam 503 sem expor detalhes;
- conexões ociosas com erro são removidas do pool sem derrubar silenciosamente a API;
- cada resposta possui `X-Request-Id` para investigação;
- respostas JSON maiores que 1 KB são comprimidas;
- corpos JSON são limitados a 32 KB;
- SIGTERM/SIGINT encerram servidor e pool de forma graciosa;
- filtros, eventos e relatórios usam explicitamente `America/Sao_Paulo`.

Os limites são configuráveis. Não os aumente antes de um teste de carga em homologação. Em múltiplas instâncias, o rate limit em memória passa a valer por instância; para proteção global contra ataque distribuído, configure também WAF/rate limiting na borda.

## Banco de dados

Para banco novo e vazio:

```powershell
psql --set ON_ERROR_STOP=1 --dbname criar_banco --file database/criar_banco.sql
```

O projeto não utiliza migrations. Para atualizar um banco existente, gere e valide um backup completo, crie um banco vazio com `database/criar_banco.sql` e restaure somente os dados expressamente aprovados. Nunca execute o schema em um banco com estrutura ou dados.

Para aplicar a identidade pública e os textos atuais de consentimento em um banco
existente, sem apagar versões anteriores:

```powershell
npm run atualizar-identidade-publica
```

O comando é idempotente. Ele mantém uma versão ativa de cada tipo, preserva as
versões anteriores e não altera consentimentos já registrados. As versões ativas
são `aviso_privacidade_v3`, `mensagens_whatsapp_v3` e `ligacoes_v3`.

O schema atual tem 21 tabelas:

- cadastros: `bairros`, `origens`, `usuarios`, `contatos`;
- privacidade: `consentimentos`, `aceites_privacidade`, `historico_contatos`, `solicitacoes_exclusao`;
- eventos: `eventos`, `historico_eventos`, `contato_eventos`;
- operação: `importacoes`, `importacao_linhas`, `tentativas_login`, `textos_formulario`, `backups_banco`;
- comunicação manual: `numeros_whatsapp`, `modelos_mensagem`, `campanhas`,
  `comunicacoes`, `historico_comunicacoes`.

As tabelas de comunicação organizam o atendimento manual. As autorizações
registradas servem para controle de privacidade e contato realizado pela equipe.

As colunas anteriores de compatibilidade em `contatos` foram mantidas apenas quando ainda participam das interfaces de importação e resposta da API. Os antigos marcadores de exclusão lógica foram removidos. O fluxo oficial usa `solicitacoes_exclusao`.

## Regras de negócio atuais

- `/participar` é sempre o cadastro geral e nunca escolhe automaticamente um evento ativo.
- Cada evento usa o link exclusivo `/participar?evento=<id>` e somente esse contexto cria o vínculo em `contato_eventos`.
- Vários eventos podem estar ativos simultaneamente. A disponibilidade de cada formulário depende do status e do próprio período de inscrições.
- O QR exclusivo usa `GET /api/publico/contatos/opcoes?eventoId=<id>`. O backend
  aceita somente o evento informado que continuar ativo e dentro do período;
  após encerramento ou expiração, retorna HTTP `410`.
- O frontend envia `eventoIdExibido`; o backend confirma que aquele evento específico continua aceitando inscrições antes de persistir.
- No link exclusivo de um evento disponível, o formulário começa solicitando nome completo e telefone. Se o telefone não existir, o preenchimento completo é liberado.
- Se o telefone existir, nome completo e telefone precisam corresponder ao cadastro. A API não devolve os dados pessoais armazenados.
- Depois da confirmação, o contato original recebe somente o vínculo com o evento. A origem e o tipo de entrada não mudam.
- A restrição única `(contato_id, evento_id)` e o `ON CONFLICT` impedem duas inscrições do mesmo contato no mesmo evento.
- A unicidade `(contato_id, evento_id)` impede inscrição duplicada, sem limitar a quantidade de eventos ativos.
- Um reenvio para o mesmo evento retorna `200` e informa que a inscrição já está registrada, sem duplicar o vínculo.
- O formulário geral continua funcionando normalmente, independentemente dos eventos ativos.
- Um telefone não sobrescreve silenciosamente dados existentes; somente campos vazios podem ser complementados no fluxo público.
- A opção `Meus dados mudaram` somente é liberada após a correspondência de nome completo e telefone. As alterações declaradas são aplicadas com o evento em contexto e registradas como `atualizacao_cadastro_publico_evento`.
- Autorizações de mensagens e ligações são independentes e versionadas; o
  frontend as envia conforme o estado visível das caixas no momento do envio.
- No formulário público, ambas começam desmarcadas. `mensagens` representa o
  opt-in específico para WhatsApp; uma resposta não marcada não cria autorização.
- `consentimentos` guarda separadamente tipo, resposta, estado, texto, versão,
  canal, origem, data, revogação, motivo e vínculo com o registro anterior.
- Revogar cria um novo registro ligado ao anterior por `registro_anterior_id`; nenhuma rota apaga revogações.
- Pedido pendente bloqueia mensagens e ligações.
- Operador pode pedir exclusão, mas não pode aprovar, rejeitar ou exportar.
- Administrador pode aprovar ou rejeitar. Aprovação exclui fisicamente o contato e dados pessoais relacionados.
- `consentimentos` e `solicitacoes_exclusao` preservam a trilha administrativa após a exclusão, com `contato_id` nulo e o identificador original numérico.
- As exportações CSV e Excel exigem perfil `administrador` e aplicam o mesmo conjunto de filtros.
- O resumo de relatórios também devolve `problemasPorBairro`, com total e
  distribuição das categorias para cada bairro.
- A quantidade máxima de registros carregados por uma exportação é configurada em `RELATORIO_LIMITE_REGISTROS`, evitando consumo de memória sem limite.
- O backup pelo painel exige perfil `administrador`, impede execuções simultâneas, usa `pg_dump` sem shell, gera SHA-256 e registra sucesso ou falha em `backups_banco`.
- Comunicações são exclusivamente manuais. O estado de autorização não esconde o contato nem o botão de atendimento; bloqueios e revogações explícitas continuam impedindo a preparação da mensagem.
- Abrir `wa.me` não altera o status. Somente `confirmar-envio` registra data,
  hora e usuário da confirmação.
- O operador atualiza manualmente: aguardando resposta, respondeu, sem resposta,
  recusou atendimento, telefone inválido ou concluído.
- Uma campanha já confirmada para o mesmo contato gera alerta. O reenvio exige
  confirmação explícita e motivo, preservado no registro.
- Campanhas são agrupadores de segmentação e histórico do atendimento manual.

## Rotas

Públicas:

| Método | Rota | Função |
|---|---|---|
| GET | `/api/teste` | Saúde da API e PostgreSQL. |
| GET | `/api/saude/vivo` | Liveness sem depender do banco. |
| GET | `/api/saude/pronto` | Readiness com consulta ao PostgreSQL. |
| GET | `/api/publico/contatos/opcoes` | Bairros e categorias; aceita `eventoId` para validar um formulário exclusivo. |
| POST | `/api/publico/contatos/verificar-evento` | Verifica nome completo e telefone sem retornar dados pessoais. |
| POST | `/api/publico/contatos/inscrever-evento` | Confirma o vínculo de um contato existente com o evento informado. |
| POST | `/api/publico/contatos` | Cadastro geral ou inscrição no evento explicitamente informado. |
| POST | `/api/autenticacao/login` | Login e emissão do JWT. |

Administrativas com JWT:

| Método | Rota | Perfil |
|---|---|---|
| GET/POST | `/api/admin/contatos` | operador/admin |
| GET | `/api/admin/contatos/:id` | operador/admin |
| POST | `/api/admin/contatos/:id/revogar-consentimentos` | operador/admin |
| POST | `/api/admin/contatos/:id/solicitacao-exclusao` | operador/admin |
| GET | `/api/admin/eventos` | operador/admin |
| POST/PUT | `/api/admin/eventos` e `/api/admin/eventos/:id` | admin |
| POST | `/api/admin/eventos/:id/ativar` | admin |
| POST | `/api/admin/eventos/:id/encerrar` | admin |
| DELETE | `/api/admin/eventos/:id` | admin; exclusão lógica com histórico preservado |
| GET | `/api/admin/eventos/:id/participantes` | operador/admin |
| PATCH | `/api/admin/eventos/:id/participantes/:contatoId` | operador/admin |
| GET/POST/PUT/DELETE | `/api/admin/comunicacoes/numeros` | leitura operador/admin; escrita admin; exclusão somente sem histórico |
| GET/POST/PUT | `/api/admin/comunicacoes/modelos` | leitura operador/admin; escrita admin |
| GET/POST/PUT | `/api/admin/comunicacoes/campanhas` | leitura operador/admin; escrita admin |
| GET | `/api/admin/comunicacoes/operadores` | operador/admin |
| GET | `/api/admin/comunicacoes/contatos` | operador/admin; segmentação |
| GET | `/api/admin/comunicacoes` | operador/admin |
| POST | `/api/admin/comunicacoes/preparar` | operador/admin |
| POST | `/api/admin/comunicacoes/:id/confirmar-envio` | operador/admin |
| DELETE | `/api/admin/comunicacoes/:id` | cancela somente mensagem ainda preparada |
| GET | `/api/admin/comunicacoes/:id/historico` | operador/admin |
| PATCH | `/api/admin/comunicacoes/:id` | operador/admin |
| GET | `/api/admin/solicitacoes-exclusao` | admin |
| POST | `/api/admin/solicitacoes-exclusao/:id/aprovar` | admin |
| POST | `/api/admin/solicitacoes-exclusao/:id/rejeitar` | admin |
| GET | `/api/admin/relatorios/resumo` | operador/admin |
| GET | `/api/admin/relatorios/exportar.csv` | admin |
| GET | `/api/admin/relatorios/exportar.xlsx` | admin |
| GET | `/api/admin/backups` | admin |
| POST | `/api/admin/backups/banco` | admin |
| GET/POST | `/api/admin/usuarios` | admin |
| PATCH | `/api/admin/usuarios/meu-perfil` | admin, somente o próprio nome |
| PATCH | `/api/admin/usuarios/:id/senha` | admin, somente senha de operador |
| GET | `/api/admin/importacoes` | operador/admin |
| POST | `/api/admin/importacoes/pre-visualizar` | operador/admin |
| POST | `/api/admin/importacoes/:id/confirmar` | operador/admin |
| DELETE | `/api/admin/importacoes/:id` | admin |

A listagem e os relatórios aceitam `eventoId=<id>` ou `eventoId=sem_evento`, além dos filtros documentados no frontend. Os filtros `bairro`, `problema` e `origem` aceitam `nao_informado`; para idade ausente, use `idadeNaoInformada=true`. Na tela de eventos, `Ver participantes` abre a listagem já filtrada; nome completo e telefone formatado podem ser pesquisados junto com o evento.

A listagem de importações retorna apenas metadados do lote, sem os dados dos contatos. A exclusão é restrita ao administrador, não pode ocorrer enquanto o lote está sendo processado e preserva os contatos que já foram importados. As linhas técnicas da importação são removidas em cascata.

## Administradores

Para criar o primeiro administrador em banco sem usuário:

```powershell
npm run criar-admin -- "Nome" "email@dominio.com" "SenhaForte123!"
```

Depois, somente um administrador autenticado cria operadores ou outros administradores. Cada administrador pode atualizar o próprio nome e redefinir senhas de operadores, mas não pode alterar a conta de outro administrador.

## Operação do banco

Backup completo:

```powershell
node scripts/backupBanco.js "C:\caminho\absoluto\AAAA-MM-DD_HHmmss"
```

O comando gera `criar_banco.backup` e `manifesto.json` com SHA-256. Para testar uma restauração em banco separado:

```powershell
node scripts/restaurarBackupTeste.js "C:\caminho\criar_banco.backup" nome_banco_teste
```

Sincronizar contadores após uma limpeza controlada:

```powershell
npm run banco:sincronizar-sequencias
```

No painel, um administrador também pode gerar e baixar um backup em `/admin/backups`. O servidor precisa ter `pg_dump` compatível com a versão do PostgreSQL. Configure `PG_DUMP_CAMINHO` quando o executável não estiver no `PATH`.

Na DigitalOcean App Platform, o arquivo `Aptfile` instala o cliente oficial do PostgreSQL 18 durante a compilação. O script `heroku-postbuild` valida a presença do `pg_dump` e interrompe a implantação caso o executável não esteja disponível, evitando publicar o recurso de backup sem sua dependência de sistema.

O backup técnico usa o nome `acorda-vk-backup-completo-postgresql-AAAA-MM-DD_HH-mm-ss.backup`. Ele é restaurável pelo PostgreSQL e não deve ser confundido com as exportações de contatos, baixadas como `acorda-vk-contatos-AAAA-MM-DD_HH-mm-ss.xlsx` ou `.csv`.

Para não afetar o formulário durante picos, o painel recusa iniciar backup quando a fila do banco já está acima do limite configurado. Também há limite preventivo de tamanho para o arquivo temporário. Em produção, o mecanismo principal deve ser o backup/PITR do PostgreSQL gerenciado; o backup do painel deve ser executado em horário de menor movimento, baixado e armazenado fora da App Platform.

## Testes

```powershell
npm test
node --check src/app.js
npm run testar:schema-vazio
npm run testar:importacao-carga
```

Resultado de 02/08/2026: 385 verificações aprovadas.

- estrutura, 166 bairros, eventos simultâneos e integridade: 22;
- cadastro público, idade mínima, opt-in opcional, textos públicos e metadados versionados: 42;
- administração e filtros: 43;
- cadastro manual: 24;
- importações: 30;
- relatórios, necessidades por bairro e permissões CSV/Excel: 25;
- segurança e usuários: 54;
- privacidade e bloqueio durante pedido de exclusão: 16;
- eventos, QR exclusivo, identificação por nome e telefone, contato novo, reinscrição idempotente, atualização auditada, busca de participantes, permissões, exclusão lógica de eventos e exclusão física aprovada de contatos: 54;
- comunicação manual, CRUD seguro de números, textos prontos obrigatórios, campanhas, permissões, confirmação explícita, cancelamento de preparo, reenvio justificado, auditoria e filtros: 35;
- backups, permissões, integridade e auditoria: 18.
- resiliência, rate limit, concorrência, saúde, pool e configuração: 22.

O teste de schema cria um banco temporário vazio, aplica `database/criar_banco.sql`, valida 21 tabelas e 166 bairros e remove o banco temporário ao final.

O teste de carga de importação gera 15.000 contatos temporários, percorre pré-visualização, confirmação e persistência, valida a rejeição de 20.001 linhas, remove todos os dados de teste e ressincroniza as sequências utilizadas. Ele recusa execução quando `NODE_ENV=production`.

CSV e XLSX aceitam até 5 MB e 20.000 linhas. O limite de arquivo permanece conservador para o plano de 512 MiB, pois arquivos XLSX são descompactados em memória. Pré-visualização e confirmação trabalham em lotes parametrizados de 500. Se um lote apresentar falha inesperada, a confirmação retorna ao processamento isolado das linhas daquele lote, preservando o relatório individual. Um advisory lock do PostgreSQL permite somente uma confirmação de importação por vez; tentativas simultâneas recebem `409`, sem ocupar todo o pool necessário ao formulário público.

O backup mais recente anterior à atualização estrutural está fora do repositório em `C:\Users\gabriellindo\Backups\A_Voz_do_Bairro\criar_banco\2026-07-23_170901\`, com SHA-256 `E2E3B6C244B64D989BD0B1FD5EA261F5E386B4704504BE8A792AD4A51741A9A3`. A restauração validada `criar_banco_backup_20260723_170901` foi mantida para conferência.

## Pendências reais

- política de retenção e armazenamento externo dos arquivos de backup em produção;
- política definitiva de retenção dos registros administrativos após exclusão.
