# Relatório de Implementação — Fase 0 operacional e Fase 1

Data da execução: 21/07/2026.

## Escopo executado

Foram executadas somente as partes autorizadas:

- backup completo e restauração validada;
- checkpoint Git do estado anterior à Fase 1;
- controle formal de migrations;
- migrations `004` a `007`;
- testes de preservação, idempotência, backend e frontend;
- atualização da documentação.

Não foram implementados cadastro manual, importação, campanhas, ManyChat, novos consentimentos ou conversão do legado. A API pública e o frontend não tiveram suas regras alteradas nesta fase.

## 1. Backup e restauração

Backup externo criado em:

```text
C:\Users\gabriellindo\Backups\A_Voz_do_Bairro\criar_banco\2026-07-21_165352
```

Resultado:

| Item | Valor observado |
| --- | --- |
| Banco de origem | `criar_banco` |
| Archive | `criar_banco_2026-07-21_165352.dump` |
| Formato | `pg_dump` custom |
| Tamanho | 18850 bytes |
| SHA-256 | `BDC80E7095F87D96C040C5304360A3B38EB39AE909DA6CB8276D96786DF9BB84` |
| Banco restaurado | `criar_banco_restauracao_20260721_165352` |
| Estado do banco restaurado | preservado para aprovação |

Foram comparados entre origem e restauração:

- tabelas;
- colunas e defaults;
- estrutura de constraints;
- índices;
- triggers;
- sequências;
- contagens;
- consentimentos órfãos;
- telefones normalizados duplicados.

Os dois bancos apresentaram três tabelas no snapshot, 49 constraints validadas, 4 contatos, 1 usuário, 8 consentimentos legados, nenhum consentimento novo, nenhum órfão e nenhuma duplicidade.

Três checks com arrays foram renderizados pelo PostgreSQL com sintaxe canônica textual diferente após o restore. Nomes, tipos, colunas, estado validado e estrutura permaneceram equivalentes. O manifesto completo está no diretório externo.

## 2. Checkpoint Git

O estado existente foi revisado antes do staging:

- `node --check` aprovado;
- suíte integrada do backend aprovada;
- build do frontend aprovado;
- `git diff --check` aprovado;
- `.env`, `node_modules` e `dist` permaneceram ignorados;
- nenhum segredo real foi encontrado nos candidatos ao commit.

Foi criada uma exceção específica para versionar `backend/documentos/banco.sql`, mantendo os demais arquivos da pasta ignorados.

Checkpoint:

```text
ad61fd1 checkpoint: estado antes da fase 1
```

O acesso ao GitHub estava ativo e o push para `origin/main` foi concluído com sucesso.

## 3. Controle de migrations

O runner `backend/scripts/executarMigracoes.js` passou a:

- validar banco `criar_banco` e schema `public`;
- obter e liberar advisory lock;
- calcular SHA-256 normalizado;
- comparar checksum de migrations registradas;
- executar cada arquivo pendente em transação;
- registrar a execução na mesma transação;
- abortar diante de divergência;
- nunca reaplicar a migration `003`.

A tabela `schema_migrations` possui:

- `nome_arquivo` como chave primária;
- `checksum_sha256` obrigatório;
- `executada_em` com timestamp;
- `baseline` para diferenciar o estado anterior ao ledger.

Ledger observado:

| Migration | Baseline | SHA-256 | Resultado |
| --- | ---: | --- | --- |
| `003_consentimentos_publicos_e_listagem.sql` | sim | `d96d5589e822eabec16f33111922e89a73afbbd5cb22fbd594dc0ce80347bcf6` | estrutura verificada e registrada sem execução |
| `004_criar_schema_migrations.sql` | não | `7be6f73c42c42520bd7194e64159f35a47590ac7f12b4e7853776c50cb410270` | executada |
| `005_criar_origens_e_vincular_contatos.sql` | não | `38ea14cac35920a857e336eb96a1cd35caf1fa0b58a109d6ca8b96908d3acdfa` | executada |
| `006_adicionar_campos_publicos_contatos.sql` | não | `44aff31a5265e6887566684bef7f167b8026fea8b15bb7b8bb63df93c3d49903` | executada |
| `007_criar_historico_contatos.sql` | não | `782bc6ea8deaf1a872af3952b8d63b99dcc04b293edee95d8ecfe34000a86035` | executada |

Uma segunda execução do runner ignorou os cinco arquivos e não reaplicou SQL.

## 4. Estruturas da Fase 1

### `origens`

Criada com nome, slug, tipo, estado ativo e timestamps. O slug possui unicidade sem diferenciar maiúsculas e minúsculas.

Registro inicial:

```text
Cadastro legado | cadastro-legado | legado | ativo
```

Os quatro contatos existentes receberam `origem_id`, enquanto `origem_atual` foi preservada.

### `contatos`

Colunas adicionadas sem renomear ou remover as anteriores:

- `origem_id`;
- `idade`;
- `descricao_problema`;
- `participou_eleicao_anterior`.

Idade aceita `NULL` para o legado e, quando preenchida, somente valores inteiros de 16 a 120. A resposta eleitoral aceita `sim`, `nao`, `prefiro_nao_informar` ou `NULL`.

Os quatro contatos antigos permaneceram com idade e resposta eleitoral `NULL`.

### `historico_contatos`

Criada com contato, tipo de evento, dados anteriores e novos em JSONB, origem, usuário e timestamp. Nenhum evento retroativo foi criado.

### Consentimentos

A tabela `consentimentos` não foi alterada pelas migrations `004` a `007`.

- 8 registros legados preservados;
- 8 registros continuam com `origem_registro=migracao_legado` e `versao_texto=legado_v1`;
- 0 registros `projetos_sociais`;
- 0 registros `conteudo_politico`;
- nenhuma conversão de `mensagens_whatsapp`.

## 5. Testes executados

| Teste | Resultado |
| --- | --- |
| Migrations `004` a `007` no banco restaurado com rollback | aprovado; banco restaurado permaneceu com 3 tabelas |
| Primeira execução do runner | `003` baselined; `004` a `007` executadas |
| Segunda execução do runner | cinco arquivos ignorados |
| `npm run testar:fase1` | aprovado antes e depois da regressão integrada |
| Constraints da Fase 1 | limites 16/120, resposta eleitoral, slug único e histórico sem dados validados com rollback |
| `npm run testar:consentimentos` | todos os cenários aprovados e temporários removidos |
| `node --check` | 24 arquivos JavaScript aprovados |
| `npm run build` no frontend | aprovado; 47 módulos transformados |
| Estado final | 4 contatos, 1 usuário, 8 consentimentos legados, 0 novos, 0 históricos retroativos |

O primeiro bootstrap exibiu um aviso deprecatório do pacote `pg` porque o preflight usava consultas paralelas no mesmo cliente. O runner foi corrigido para consultas sequenciais; as execuções seguintes não exibiram o aviso. A migration já havia sido concluída com sucesso e o aviso não alterou a transação ou os dados.

## 6. Arquivos criados

- `backend/database/migrations/004_criar_schema_migrations.sql`;
- `backend/database/migrations/005_criar_origens_e_vincular_contatos.sql`;
- `backend/database/migrations/006_adicionar_campos_publicos_contatos.sql`;
- `backend/database/migrations/007_criar_historico_contatos.sql`;
- `backend/scripts/verificarFase1.js`;
- `RELATORIO_IMPLEMENTACAO.md`.

## 7. Arquivos alterados

- `backend/scripts/executarMigracoes.js`;
- `backend/package.json`;
- `backend/README.md`;
- `frontend/README.md`;
- `FASE_0_CONTINUACAO.md`, para registrar checkpoint e liberação operacional;
- `PLANO_IMPLEMENTACAO.md`, somente para registrar a resolução do nome oficial do banco.

As alterações de `.gitignore`, `.env.example` e da documentação da Fase 0 foram concluídas no checkpoint anterior à Fase 1.

## 8. Pendências reais

Permanecem fora desta fase:

- novos consentimentos e aceite separado de privacidade;
- textos jurídicos definitivos;
- rota pública `/participar`;
- idade e pergunta eleitoral no formulário;
- descrição opcional do problema no formulário;
- catálogo de problemas centralizado e consumido pelo frontend;
- regra pública para preencher somente campos vazios em telefone existente;
- geração de histórico por esse preenchimento;
- cadastro manual, importação, campanhas e ManyChat.

O banco restaurado `criar_banco_restauracao_20260721_165352` continua preservado, conforme solicitado.

## 9. Atualização oficial posterior de escopo

O planejamento foi atualizado para registrar que o A Voz do Bairro é a fonte oficial dos dados e deve funcionar integralmente sem ManyChat.

O ManyChat poderá ser contratado futuramente somente como canal adicional de automação e coleta pelo WhatsApp. Nenhuma integração, endpoint, webhook, token, origem, migration ou dependência foi criada nesta atualização.

Foram retiradas do planejamento as propostas de API direta da Meta/WhatsApp, WhatsApp Web, chatbox próprio e automação própria de mensagens. Os contratos de uma eventual integração ManyChat somente serão definidos depois da contratação e de autorização específica.

A limpeza removeu do plano os módulos, controllers, models, endpoints e testes fictícios de ManyChat. Nenhum arquivo foi excluído: a revisão confirmou finalidade para migrations, scripts, schema de referência, código, READMEs e relatórios históricos. Também não houve alteração de código ou banco nesta atualização de escopo.

## 10. Execução da Etapa 2 — Formulário público

O formulário React existente foi evoluído sem reconstrução do layout e sem duplicar o campo de categoria.

- `/participar` passou a ser a rota pública principal;
- `/` redireciona para `/participar`;
- `problema` continua sendo a categoria selecionada no catálogo existente;
- idade obrigatória entre 16 e 120 foi adicionada;
- descrição complementar opcional foi adicionada;
- a pergunta “Você votou na última eleição?” foi adicionada com as três opções oficiais;
- o rótulo passou de “Telefone ou WhatsApp” para “Telefone”.

Validação da etapa: build Vite aprovado com 47 módulos transformados.

## 11. Etapa 3 — Privacidade e autorizações

A migration `008_privacidade_e_autorizacoes.sql` foi validada no banco restaurado com rollback e executada uma vez no banco oficial.

Foram criadas `textos_formulario` e `aceites_privacidade`. A tabela `consentimentos` recebeu, de forma aditiva, `estado` e `origem_id`. Oito registros legados permaneceram com os dois campos novos em `NULL`; nenhum `mensagens_whatsapp` foi convertido.

Os textos provisórios de privacidade, mensagens e ligações ficaram versionados. Resposta opcional desmarcada não cria recusa nem evento. Resposta idêntica, com mesma versão, texto, origem e canal, não é duplicada.

## 12. Etapa 4 — Cadastro público transacional

O endpoint público passou a processar contato, complementação de campos vazios, histórico, aceite de privacidade e autorizações na mesma transação.

- telefone novo cria contato com origem `formulario-publico`;
- telefone existente preserva todos os campos já preenchidos;
- somente campos vazios são complementados;
- histórico só é criado quando existe mudança;
- a resposta HTTP não expõe dados anteriores;
- a mensagem oficial de sucesso foi aplicada;
- o catálogo de categorias foi centralizado no backend e disponibilizado por rota pública.

Teste: 22 verificações aprovadas, incluindo validações, duplicidade idempotente, não sobrescrita, privacidade, autorizações, legado e rollback.

## 13. Etapa 5 — Área administrativa

A listagem foi ampliada com idade, eleição, origem, período, situação das autorizações e ordenação. Foi criada a rota protegida de detalhe, com dados cadastrais, aceitações de privacidade, consentimentos, autorizações e histórico.

O frontend recebeu tela de detalhe e manteve logout e expiração de sessão.

Teste: 21 verificações aprovadas para login bcrypt, JWT, filtros combinados, paginação, campos internos não expostos e detalhes.

## 14. Etapa 6 — Cadastro manual

A migration `009_adicionar_origem_cadastro_manual.sql` adicionou a origem oficial `Cadastro manual`.

Foi criada a tela protegida de cadastro manual. Origem e status são obrigatórios. Contato novo é criado; telefone existente recebe alteração explícita e auditada, com usuário responsável. Privacidade e autorizações não são presumidas.

Teste: 16 verificações aprovadas.

## 15. Etapa 7 — Importação CSV/XLSX

A migration `010_criar_importacoes.sql` criou `importacoes` e `importacao_linhas`. Para cumprir os campos opcionais da importação, removeu somente `NOT NULL` de nome, bairro e problema; os cadastros público e manual continuam validando esses campos como obrigatórios.

A importação possui:

- origem obrigatória;
- upload em memória de até 5 MB;
- CSV e XLSX;
- até 5000 linhas;
- pré-visualização;
- validação por linha;
- confirmação idempotente;
- criação ou complementação sem sobrescrita;
- histórico de complementação;
- relatório final;
- nenhum consentimento ou aceite presumido.

O pacote inicial avaliado para XLSX apresentou vulnerabilidade alta sem correção disponível e foi removido. A implementação usa ExcelJS com override compatível de `uuid`; `npm audit` terminou com zero vulnerabilidades.

Teste: 20 verificações aprovadas para CSV, XLSX, inválidos, duplicados, complementação e reimportação.

## 16. Etapa 8 — Relatórios e exportação

Foram criadas rotas protegidas e tela para:

- contatos por bairro;
- categoria;
- faixa etária;
- participação eleitoral;
- origem;
- autorizações;
- período;
- exportação CSV dos mesmos filtros.

Teste: 15 verificações aprovadas.

## 17. Etapa 9 — Preparação futura

Nenhuma integração externa foi implementada. A arquitetura já possui origens extensíveis, telefone normalizado, canais no histórico e autorizações independentes do canal, suficientes para uma integração futura autorizada sem remodelagem central.

## 18. Regressão final

| Verificação | Resultado observado |
| --- | --- |
| `npm test` no backend | aprovado; 6 grupos executados |
| Cadastro público | 22 verificações |
| Administração | 21 verificações |
| Cadastro manual | 16 verificações |
| Importações | 20 verificações |
| Relatórios | 15 verificações |
| `npm run build` | aprovado com 52 módulos transformados |
| `npm audit` | 0 vulnerabilidades |
| Runner repetido | migrations 003 a 010 ignoradas, sem reaplicação |
| Dados após limpeza | 4 contatos, 1 usuário, 8 consentimentos legados |

Os arquivos obsoletos `scripts/testarConsentimentos.js` e `src/config/textosConsentimento.js` foram removidos depois de confirmada a ausência de uso. Seus papéis foram substituídos pela regressão atual e pelos textos versionados no banco.

## 19. Pendências reais

- revisão jurídica dos textos provisórios;
- canal operacional para solicitações dos titulares;
- fluxo futuro de revogação;
- eventual ManyChat, somente após autorização específica.

Permanecem fora do escopo: campanhas, disparos, WhatsApp/Meta, SMS, email, webhook e chatbox.
