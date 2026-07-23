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
PORTA=3000
BANCO_HOST=localhost
BANCO_PORTA=5432
BANCO_USUARIO=postgres
BANCO_SENHA=sua_senha
BANCO_NOME=criar_banco
BANCO_SSL=false
JWT_SECRET=troque_por_um_segredo_forte
JWT_TEMPO_EXPIRACAO=8h
FRONTEND_URL=http://localhost:5173
PG_DUMP_CAMINHO=
BACKUP_TEMPO_LIMITE_MS=600000
RELATORIO_LIMITE_REGISTROS=50000
```

Também é possível usar `DATABASE_URL`. O `.env` não deve ser versionado.

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
- Sem evento ativo, o retorno informa “Cadastro geral do projeto A Voz do Bairro, sem vínculo com evento”.
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
| PATCH | `/api/admin/usuarios/:id/senha` | admin |
| POST | `/api/admin/importacoes/pre-visualizar` | operador/admin |
| POST | `/api/admin/importacoes/:id/confirmar` | operador/admin |

A listagem e os relatórios aceitam `eventoId=<id>` ou `eventoId=sem_evento`, além dos filtros documentados no frontend.

## Administradores

Para criar o primeiro administrador em banco sem usuário:

```powershell
npm run criar-admin -- "Nome" "email@dominio.com" "SenhaForte123!"
```

Depois, somente um administrador autenticado cria operadores ou outros administradores e redefine senhas pelo painel.

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

## Testes

```powershell
npm test
node --check src/app.js
npm run testar:schema-vazio
```

Resultado de 23/07/2026: 252 verificações aprovadas.

- estrutura, 166 bairros e proteções ManyChat: 26;
- cadastro público: 27;
- administração e filtros: 21;
- cadastro manual: 24;
- importações: 21;
- relatórios e permissões CSV/Excel: 23;
- segurança e usuários: 49;
- privacidade: 15;
- eventos, permissões e exclusão física: 28;
- backups, permissões, integridade e auditoria: 18.

O teste de schema cria um banco temporário vazio, aplica `database/criar_banco.sql`, valida 22 tabelas e 166 bairros e remove o banco temporário ao final.

O backup imediatamente anterior à recriação está fora do repositório em `C:\Users\gabriellindo\Backups\A_Voz_do_Bairro\criar_banco\2026-07-23_004714\`, com SHA-256 `38E328297998DAFB969A87BBF09ED8E55FDA80093B8D3F2D524E9EBE80E763C2`. A restauração validada `criar_banco_backup_correcao_20260723` foi mantida para conferência.

## Pendências reais

- integração efetiva com a API/webhooks do ManyChat;
- execução de campanhas e filas de envio;
- política de retenção e armazenamento externo dos arquivos de backup em produção;
- política definitiva de retenção dos registros administrativos após exclusão.
