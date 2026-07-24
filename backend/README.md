# Backend — Central de Comunicação

API do projeto A Voz do Bairro construída com Node.js, Express, PostgreSQL, CommonJS e SQL parametrizado. A organização é modular por funcionalidade: controller → service → model.

## Instalação e ambiente

```powershell
npm install
Copy-Item .env.example .env
npm start
```

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

O schema atual tem 22 tabelas:

- cadastros: `bairros`, `origens`, `usuarios`, `contatos`;
- privacidade: `consentimentos`, `aceites_privacidade`, `historico_contatos`, `solicitacoes_exclusao`;
- eventos: `eventos`, `historico_eventos`, `contato_eventos`;
- operação: `importacoes`, `importacao_linhas`, `tentativas_login`, `textos_formulario`, `backups_banco`;
- futura integração ManyChat: `campanhas`, `campanha_contatos`, `envios_campanha`, `respostas_campanha`, `eventos_manychat`, `sincronizacoes_manychat`.

As colunas anteriores de compatibilidade em `contatos` foram mantidas apenas quando ainda participam das interfaces de importação e resposta da API. Os antigos marcadores de exclusão lógica foram removidos. O fluxo oficial usa `solicitacoes_exclusao`.

## Regras de negócio atuais

- O formulário aceita cadastro com ou sem evento ativo.
- Quando há evento ativo dentro do período, o backend cria automaticamente o vínculo em `contato_eventos`; o frontend não escolhe o evento.
- Sem evento ativo, o formulário continua funcionando normalmente e não exibe aviso adicional.
- Um telefone não sobrescreve silenciosamente dados existentes; somente campos vazios podem ser complementados no fluxo público.
- Consentimentos de mensagens e ligações são explícitos e versionados.
- Revogar cria um novo registro ligado ao anterior por `registro_anterior_id`; nenhuma rota apaga revogações.
- Pedido pendente bloqueia mensagens, ligações e campanhas.
- Operador pode pedir exclusão, mas não pode aprovar, rejeitar ou exportar.
- Administrador pode aprovar ou rejeitar. Aprovação exclui fisicamente o contato e dados pessoais relacionados.
- `consentimentos` e `solicitacoes_exclusao` preservam a trilha administrativa após a exclusão, com `contato_id` nulo e o identificador original numérico.
- As exportações CSV e Excel exigem perfil `administrador` e aplicam o mesmo conjunto de filtros.
- A quantidade máxima de registros carregados por uma exportação é configurada em `RELATORIO_LIMITE_REGISTROS`, evitando consumo de memória sem limite.
- O backup pelo painel exige perfil `administrador`, impede execuções simultâneas, usa `pg_dump` sem shell, gera SHA-256 e registra sucesso ou falha em `backups_banco`.

## Rotas

Públicas:

| Método | Rota | Função |
|---|---|---|
| GET | `/api/teste` | Saúde da API e PostgreSQL. |
| GET | `/api/saude/vivo` | Liveness sem depender do banco. |
| GET | `/api/saude/pronto` | Readiness com consulta ao PostgreSQL. |
| GET | `/api/publico/contatos/opcoes` | Bairros, categorias e contexto do evento ativo. |
| POST | `/api/publico/contatos` | Cadastro público e vínculo automático ao evento. |
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
| POST | `/api/admin/importacoes/pre-visualizar` | operador/admin |
| POST | `/api/admin/importacoes/:id/confirmar` | operador/admin |

A listagem e os relatórios aceitam `eventoId=<id>` ou `eventoId=sem_evento`, além dos filtros documentados no frontend.

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

O backup técnico usa o nome `a-voz-do-bairro-backup-completo-postgresql-AAAA-MM-DD_HH-mm-ss.backup`. Ele é restaurável pelo PostgreSQL e não deve ser confundido com as exportações de contatos, baixadas como `a-voz-do-bairro-contatos-AAAA-MM-DD_HH-mm-ss.xlsx` ou `.csv`.

Para não afetar o formulário durante picos, o painel recusa iniciar backup quando a fila do banco já está acima do limite configurado. Também há limite preventivo de tamanho para o arquivo temporário. Em produção, o mecanismo principal deve ser o backup/PITR do PostgreSQL gerenciado; o backup do painel deve ser executado em horário de menor movimento, baixado e armazenado fora da App Platform.

## Testes

```powershell
npm test
node --check src/app.js
npm run testar:schema-vazio
npm run testar:importacao-carga
```

Resultado de 23/07/2026: 279 verificações aprovadas.

- estrutura, 166 bairros e proteções ManyChat: 26;
- cadastro público: 27;
- administração e filtros: 21;
- cadastro manual: 24;
- importações: 21;
- relatórios e permissões CSV/Excel: 23;
- segurança e usuários: 54;
- privacidade: 15;
- eventos, permissões e exclusão física: 28;
- backups, permissões, integridade e auditoria: 18.
- resiliência, rate limit, concorrência, saúde, pool e configuração: 22.

O teste de schema cria um banco temporário vazio, aplica `database/criar_banco.sql`, valida 22 tabelas e 166 bairros e remove o banco temporário ao final.

O teste de carga de importação gera 2.500 contatos temporários, percorre pré-visualização, confirmação e persistência, confere o resultado, remove todos os dados de teste e ressincroniza as sequências utilizadas. Ele recusa execução quando `NODE_ENV=production`. A pré-visualização grava as linhas no PostgreSQL em lotes parametrizados de 500; a confirmação continua transacional por contato para preservar duplicidade, complementação e histórico. O limite funcional permanece em 5.000 linhas por arquivo e 5 MB.

O backup mais recente anterior à atualização estrutural está fora do repositório em `C:\Users\gabriellindo\Backups\A_Voz_do_Bairro\criar_banco\2026-07-23_170901\`, com SHA-256 `E2E3B6C244B64D989BD0B1FD5EA261F5E386B4704504BE8A792AD4A51741A9A3`. A restauração validada `criar_banco_backup_20260723_170901` foi mantida para conferência.

## Pendências reais

- integração efetiva com a API/webhooks do ManyChat;
- execução de campanhas e filas de envio;
- política de retenção e armazenamento externo dos arquivos de backup em produção;
- política definitiva de retenção dos registros administrativos após exclusão.
