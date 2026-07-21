# A Voz do Bairro — Continuação da Fase 0

Data do levantamento: 21/07/2026.

Este documento complementa o `PLANO_IMPLEMENTACAO.md`, já aprovado como retrato do estado atual. Ele registra as decisões oficiais recebidas, o estado preservado do Git e as propostas para backup, controle de migrations e modelagem mínima da Fase 1.

## Limites da proposta original

Na elaboração original deste documento:

- nenhuma migration foi executada;
- nenhum comando SQL de escrita foi executado;
- nenhuma tabela, coluna, constraint, índice ou dado foi alterado;
- nenhum arquivo da aplicação foi alterado;
- nenhum arquivo foi adicionado ao staging;
- nenhum commit foi criado;
- nenhuma alteração existente foi descartada;
- nenhum backup foi criado ainda, pois o destino e a execução dependem de aprovação;
- este documento é a única entrega nova desta continuação.

## 1. Decisões oficiais incorporadas

As decisões abaixo passam a substituir as dúvidas correspondentes do plano aprovado.

1. O banco oficial conectado é `criar_banco`.
2. O estado físico oficial possui três tabelas: `contatos`, `usuarios` e `consentimentos`.
3. As três tabelas existentes e seus dados serão preservados; nenhuma será apagada ou recriada.
4. Será adotado um ledger simples de migrations executadas.
5. O primeiro passo antes de qualquer migration estrutural será um backup completo, com data e hora, fora do repositório, seguido de restauração testada em banco separado.
6. `mensagens_whatsapp` permanece exclusivamente como registro legado.
7. Nenhum registro legado será convertido para os novos consentimentos.
8. Os novos consentimentos de comunicação serão somente `projetos_sociais`, `conteudo_politico` e `ligacoes`.
9. O aceite do Aviso de Privacidade terá estrutura própria e não será um consentimento de comunicação.
10. A leitura oficial de estado será: `nao_informado`, `autorizado`, `recusado` ou `revogado`.
11. Os textos atuais são rascunhos versionados e configuráveis, não textos jurídicos definitivos.
12. Uma resposta idêntica em valor, texto, versão e origem não criará novo evento. Mudança de qualquer um desses elementos ou revogação criará novo evento.
13. A rota pública principal será `/participar`; `/` poderá apenas redirecionar para ela.
14. Será coletada idade, nunca data de nascimento.
15. A participação na eleição anterior será opcional e aceitará `Sim`, `Não` e `Prefiro não informar`.
16. O problema será representado por categoria e descrição opcional.
17. Telefone existente não autoriza sobrescrita silenciosa.
18. Nova submissão poderá preencher campos vazios. Mudanças em campos já preenchidos dependerão de regra explícita e gerarão histórico.
19. Consentimento somente mudará quando houver escolha explícita para aquele consentimento.
20. A mensagem oficial será: “Cadastro realizado com sucesso. Obrigado por contribuir com o projeto A Voz do Bairro.”
21. Cadastro manual, importação, campanhas e ManyChat permanecem fora do escopo autorizado.

## 2. Estado do Git

### 2.1 Referência atual

- branch: `main`;
- HEAD: `0b916ca` (`backend finalizado`);
- remote: `origin`, apontando para `https://github.com/GAB-RAY/mvp_coleta_dados.git`;
- staging: vazio;
- integridade: `git fsck` não encontrou objeto ausente ou corrompido;
- observação: existem árvores órfãs (`dangling tree`), que são objetos recuperáveis e não representam corrupção do repositório.

### 2.2 Alterações rastreadas preservadas

Existem seis arquivos rastreados modificados:

```text
backend/README.md
backend/package.json
backend/src/app.js
backend/src/modules/contatos/contatoController.js
backend/src/modules/contatos/contatoModel.js
backend/src/modules/contatos/contatoService.js
```

O diff rastreado contém atualmente 820 inserções e 168 remoções. Nenhuma dessas alterações foi descartada, corrigida, adicionada ao staging ou consolidada em commit nesta etapa.

### 2.3 Arquivos não rastreados preservados

Antes da criação deste documento havia 42 arquivos não rastreados:

- 34 arquivos do frontend;
- `PLANO_IMPLEMENTACAO.md`;
- `RELATORIO_TECNICO_SISTEMA.md`;
- `backend/database/migrations/003_consentimentos_publicos_e_listagem.sql`;
- `backend/scripts/executarMigracoes.js`;
- `backend/scripts/testarConsentimentos.js`;
- `backend/src/config/textosConsentimento.js`;
- `backend/src/modules/contatos/consentimentoModel.js`;
- `backend/src/modules/contatos/contatoAdminRoutes.js`.

Com este documento, o total esperado passa a 43 arquivos não rastreados. Todo esse conteúdo foi mantido.

### 2.4 Arquivos ignorados relevantes

Os seguintes itens estão corretamente ignorados por conterem dependências, artefatos ou configuração local:

- `backend/.env`;
- `backend/node_modules/`;
- `frontend/.env`;
- `frontend/dist/`.

Há um ponto que precisa de decisão: `backend/documentos/banco.sql` também está ignorado pela regra `documentos/` do `.gitignore` do backend. O arquivo é uma referência importante do schema inicial, mas hoje não está protegido pelo histórico do Git.

Nenhuma regra de ignore foi alterada. Antes do futuro checkpoint, deve ser aprovado um destes caminhos:

1. manter o arquivo no local e criar uma exceção específica no `.gitignore`; ou
2. mover uma cópia revisada para uma pasta de documentação versionada, preservando o original.

### 2.5 Regularização segura proposta

“Regularizar” não será interpretado como apagar ou sobrescrever trabalho. O procedimento futuro proposto é:

1. revisar o diff dos seis arquivos rastreados;
2. revisar os 43 arquivos não rastreados, especialmente o frontend e a migration `003` já aplicada;
3. decidir como versionar a referência `backend/documentos/banco.sql`;
4. executar novamente testes de backend e build do frontend;
5. adicionar ao staging somente os arquivos revisados;
6. criar um checkpoint identificado como estado anterior às novas migrations;
7. confirmar que o remote recebeu o checkpoint, se o usuário autorizar push.

Esse procedimento exige autorização específica. Nenhum `git add`, commit, push, reset, checkout ou clean foi executado agora.

### 2.6 Observação sobre finais de linha

O Git informou que alguns arquivos rastreados poderão ser convertidos de LF para CRLF quando forem novamente gravados. Isso não quebra o repositório, mas pode produzir diffs ruidosos. A política de finais de linha deve ser definida em etapa própria; nenhuma conversão foi realizada agora.

## 3. Estratégia de backup e restauração

### 3.1 Ferramentas disponíveis

As ferramentas oficiais do PostgreSQL 18 estão instaladas, embora não estejam no `PATH`:

```text
C:\Program Files\PostgreSQL\18\bin\pg_dump.exe
C:\Program Files\PostgreSQL\18\bin\pg_restore.exe
C:\Program Files\PostgreSQL\18\bin\createdb.exe
C:\Program Files\PostgreSQL\18\bin\psql.exe
C:\Program Files\PostgreSQL\18\bin\pg_dumpall.exe
```

Serão usados caminhos absolutos para evitar depender da configuração do terminal.

### 3.2 Destino

O backup deve ficar fora de `C:\Users\gabriellindo\Documents\MVP_coletas_dados`.

Destino proposto, ainda não criado:

```text
C:\Users\gabriellindo\Backups\A_Voz_do_Bairro\criar_banco\AAAA-MM-DD_HHmmss\
```

Estrutura proposta:

```text
criar_banco_AAAA-MM-DD_HHmmss.dump
criar_banco_AAAA-MM-DD_HHmmss.sha256.txt
manifesto_backup_AAAA-MM-DD_HHmmss.md
lista_conteudo_AAAA-MM-DD_HHmmss.txt
```

O `.dump` conterá schema, dados, sequências, constraints, índices, funções, triggers e large objects pertencentes ao banco. Roles e tablespaces são objetos do cluster, não do banco; se for necessário preservá-los, será criado separadamente um arquivo protegido por `pg_dumpall --globals-only`, pois ele pode conter informações sensíveis de autenticação.

### 3.3 Procedimento de criação

Depois da aprovação:

1. interromper temporariamente escritas da aplicação ou colocar o backend em janela de manutenção;
2. registrar data, hora, host, porta, versão do PostgreSQL, banco `criar_banco` e contagens atuais, sem copiar senha para o manifesto;
3. gerar o archive em formato custom com `pg_dump --format=custom --blobs`;
4. exigir código de saída zero;
5. confirmar que o arquivo existe e possui tamanho maior que zero;
6. gerar a listagem do archive com `pg_restore --list`;
7. calcular SHA-256 com `Get-FileHash`;
8. registrar tamanho, hash e contagens no manifesto;
9. manter o backup fora do Git e nunca registrar `DATABASE_URL`, senha ou conteúdo do `.env`.

Não será usado `--no-owner` nem `--no-acl` ao gerar o archive, para que as informações originais permaneçam nele. A restauração de teste poderá ignorar owner e ACL para ser portátil no ambiente local.

### 3.4 Teste obrigatório de restauração

Será criado um banco separado com nome semelhante a:

```text
criar_banco_restauracao_AAAAMMDD_HHmmss
```

Validação proposta:

1. confirmar que o nome é diferente de `criar_banco` antes de qualquer comando;
2. criar o banco vazio com `createdb`;
3. restaurar com `pg_restore --exit-on-error --single-transaction --no-owner --no-privileges`;
4. confirmar código de saída zero;
5. verificar que existem `contatos`, `usuarios` e `consentimentos`;
6. comparar as contagens registradas imediatamente antes do backup com as contagens restauradas;
7. comparar colunas, tipos, chaves primárias, chaves estrangeiras, índices, checks, sequências, funções e triggers;
8. verificar ausência de consentimentos órfãos e de telefones normalizados duplicados;
9. executar consultas de leitura e um teste de conexão apontado exclusivamente para o banco restaurado;
10. registrar os resultados no manifesto.

O banco de restauração será mantido até a validação humana. Ele não será removido sem autorização explícita.

### 3.5 Critério de liberação

Nenhuma migration estrutural poderá iniciar enquanto todos estes itens não estiverem confirmados:

- archive criado fora do repositório;
- hash SHA-256 registrado;
- listagem do archive legível;
- restauração concluída em banco separado;
- schema e contagens equivalentes;
- manifesto sem segredos;
- aprovação explícita para iniciar a Fase 1.

## 4. Proposta de controle formal de migrations

### 4.1 Problema atual

O script `backend/scripts/executarMigracoes.js` lê todos os arquivos `.sql`, ordena por nome e executa todos em cada chamada. Não existe registro de execução nem verificação de conteúdo. A migration `003_consentimentos_publicos_e_listagem.sql` já foi aplicada no banco e não deve ser executada novamente.

### 4.2 Ledger proposto

Será criada uma tabela técnica simples chamada `schema_migrations`, sem substituir ou recriar qualquer tabela atual.

| Coluna | Tipo proposto | Regra |
| --- | --- | --- |
| `nome_arquivo` | `VARCHAR(255)` | chave primária |
| `checksum_sha256` | `CHAR(64)` | obrigatório |
| `executada_em` | `TIMESTAMPTZ` | obrigatório, padrão `CURRENT_TIMESTAMP` |
| `baseline` | `BOOLEAN` | obrigatório, padrão `FALSE` |

Não é necessário ORM, biblioteca externa ou tabela adicional.

### 4.3 Bootstrap seguro

A adoção ocorrerá uma única vez, somente após backup validado:

1. o runner obtém um advisory lock exclusivo para impedir duas execuções simultâneas;
2. verifica se o schema físico contém todas as estruturas esperadas da migration `003`;
3. executa a migration `004`, que cria somente `schema_migrations`;
4. registra `003_consentimentos_publicos_e_listagem.sql` como `baseline=TRUE`, usando o SHA-256 do arquivo existente, sem executar novamente seu SQL;
5. registra a própria migration `004` como executada;
6. confirma tudo na mesma transação;
7. libera o lock mesmo em caso de erro.

Os nomes `001` e `002` não serão inventados ou reconstruídos. A sequência continuará a partir do arquivo `003` já existente.

### 4.4 Regra normal do runner

Depois do bootstrap:

- arquivo registrado com o mesmo checksum: ignorar com mensagem clara;
- arquivo registrado com checksum diferente: abortar; migration aplicada é imutável;
- arquivo não registrado: executar em transação e inserir o ledger na mesma transação;
- erro SQL ou erro ao registrar: rollback completo daquele arquivo;
- duas instâncias concorrentes: somente uma avança por causa do advisory lock;
- migrations executadas nunca serão editadas; correções usarão um novo número;
- não haverá rollback automático destrutivo;
- recuperação será feita por correção progressiva ou restauração validada, conforme o incidente.

A nova convenção será uma transação controlada pelo runner. O arquivo `003`, que já contém `BEGIN` e `COMMIT`, permanecerá intacto e será apenas baselined.

### 4.5 Segurança operacional

Antes de executar cada nova migration, o runner deverá mostrar:

- banco de destino;
- host e porta, sem senha;
- nome do arquivo;
- checksum;
- estado: pendente, já executada ou divergente.

Em ambiente de produção, o banco esperado deverá ser confirmado explicitamente. O runner recusará execução quando o banco não corresponder ao ambiente configurado.

## 5. Modelagem mínima proposta para a Fase 1

Esta modelagem é deliberadamente incremental. Ela prepara o cadastro público seguro sem introduzir cadastro manual, importação, campanhas ou ManyChat.

### 5.1 Estruturas existentes preservadas

| Estrutura | Decisão |
| --- | --- |
| `usuarios` | nenhuma alteração na Fase 1 |
| `contatos` | evoluir com colunas aditivas; nenhuma coluna removida ou renomeada |
| `consentimentos` | preservar integralmente na Fase 1; evolução de consentimentos fica para a Fase 2 |
| `mensagens_whatsapp` | manter somente como legado, sem conversão |
| `tratamento_dados` legado | preservar como registro histórico, sem tratá-lo como novo consentimento de comunicação |

### 5.2 Nova tabela `origens`

Finalidade: substituir gradualmente o texto livre de origem por uma referência consistente, sem apagar `contatos.origem_atual`.

| Coluna | Tipo proposto | Regra inicial |
| --- | --- | --- |
| `id` | `BIGINT IDENTITY` | chave primária |
| `nome` | `VARCHAR(150)` | obrigatório |
| `slug` | `VARCHAR(100)` | obrigatório e único sem diferenciar maiúsculas/minúsculas |
| `tipo` | `VARCHAR(50)` | obrigatório |
| `ativa` | `BOOLEAN` | obrigatório, padrão `TRUE` |
| `criado_em` | `TIMESTAMPTZ` | obrigatório |
| `atualizado_em` | `TIMESTAMPTZ` | obrigatório |

Na Fase 1 será necessária somente a origem de preservação `Cadastro legado`, com slug proposto `cadastro-legado` e tipo proposto `legado`. Nenhuma origem de campanha, importação ou ManyChat será criada.

Em `contatos` será adicionada `origem_id BIGINT NULL`, com chave estrangeira para `origens(id)`. Os quatro contatos atuais serão vinculados à origem legada somente quando `origem_atual` indicar `Cadastro legado`. A coluna `origem_atual` continuará existindo para compatibilidade.

### 5.3 Evolução aditiva de `contatos`

| Coluna nova | Tipo proposto | Regra inicial |
| --- | --- | --- |
| `idade` | `SMALLINT` | `NULL` para preservar registros antigos; obrigatoriedade e faixa dependem de decisão |
| `descricao_problema` | `TEXT` | opcional |
| `participou_eleicao_anterior` | `VARCHAR(30)` | opcional; somente `sim`, `nao` ou `prefiro_nao_informar` |
| `origem_id` | `BIGINT` | opcional no legado; FK para `origens` |

A coluna atual `problema` será preservada e continuará representando a categoria do problema. Isso evita renomear coluna, quebrar SQL ou duplicar a mesma informação. O futuro contrato da API poderá apresentar esse valor como `categoriaProblema`, mas essa mudança de API não pertence à Fase 1.

Não será criada coluna de data de nascimento.

### 5.4 Nova tabela `historico_contatos`

Finalidade: permitir, em fase posterior, preencher campos vazios e auditar alterações autorizadas em campos já preenchidos.

| Coluna | Tipo proposto | Regra inicial |
| --- | --- | --- |
| `id` | `BIGINT IDENTITY` | chave primária |
| `contato_id` | `BIGINT` | obrigatório, FK para `contatos` |
| `tipo_evento` | `VARCHAR(50)` | obrigatório |
| `dados_anteriores` | `JSONB` | opcional |
| `dados_novos` | `JSONB` | opcional |
| `origem_id` | `BIGINT` | opcional, FK para `origens` |
| `registrado_por_usuario_id` | `BIGINT` | opcional, FK para `usuarios`, `ON DELETE SET NULL` |
| `criado_em` | `TIMESTAMPTZ` | obrigatório |

Não será gravado histórico nessa tabela durante a Fase 1. Ela será apenas a fundação para a regra de atualização futura. Os tipos de evento serão definidos junto com a regra de atualização, evitando inventar transições agora.

### 5.5 Consentimentos e Aviso de Privacidade

Para preservar a divisão aprovada de fases, a Fase 1 não modificará a tabela `consentimentos` e não criará ainda a estrutura de aceites de privacidade.

A modelagem obrigatória reservada para a Fase 2 será:

- `aceites_privacidade` em estrutura própria;
- textos configuráveis e versionados;
- novos tipos `projetos_sociais`, `conteudo_politico` e `ligacoes`;
- `nao_informado` derivado da ausência de resposta explícita, sem inventar evento;
- histórico apenas para resposta explícita ou mudança de resposta, texto, versão, origem ou revogação;
- preservação integral de `tratamento_dados` e `mensagens_whatsapp` legados;
- nenhuma conversão dos oito registros atuais.

Os detalhes físicos e as migrations da Fase 2 serão propostos e aprovados antes de sua execução. Eles não estão incluídos na autorização da Fase 1.

## 6. Lista exata de migrations propostas para a Fase 1

Se esta proposta for aprovada, a próxima fase criará exatamente estes quatro arquivos, nesta ordem:

### `004_criar_schema_migrations.sql`

- cria somente `schema_migrations`;
- não altera as três tabelas atuais;
- viabiliza o baseline controlado da migration `003` pelo runner;
- deve ser a primeira mudança estrutural e só pode ocorrer depois do backup restaurado e validado.

### `005_criar_origens_e_vincular_contatos.sql`

- cria `origens`;
- cria índices e unicidade do slug;
- insere apenas a origem `Cadastro legado`;
- adiciona `contatos.origem_id` como nullable;
- vincula os registros legados compatíveis;
- preserva `contatos.origem_atual`.

### `006_adicionar_campos_publicos_contatos.sql`

- adiciona `idade`;
- adiciona `descricao_problema`;
- adiciona `participou_eleicao_anterior`;
- adiciona o check apenas das três opções eleitorais aprovadas;
- não renomeia nem remove `problema`;
- não adiciona data de nascimento;
- não preenche idade ou resposta eleitoral dos registros antigos.

### `007_criar_historico_contatos.sql`

- cria `historico_contatos`;
- cria chaves estrangeiras para contato, origem e usuário;
- cria índices por contato e data;
- não gera eventos retroativos;
- não altera dados existentes.

Nenhuma migration `008` ou posterior faz parte desta proposta da Fase 1. Os arquivos de consentimentos e privacidade serão numerados somente quando a modelagem da Fase 2 for aprovada, evitando congelar agora uma estrutura ainda não revisada.

## 7. Preflight obrigatório da futura Fase 1

Antes da `004`, será produzido um relatório de leitura confirmando:

- banco conectado igual a `criar_banco`;
- exatamente as três tabelas atuais esperadas;
- contagens antes da mudança;
- estrutura física compatível com a migration `003`;
- ausência de telefone normalizado duplicado;
- ausência de consentimento órfão;
- oito registros legados preservados;
- nenhum registro novo em `projetos_sociais` ou `conteudo_politico`;
- backup e restauração aprovados;
- working tree documentada e checkpoint autorizado.

Se qualquer item divergir, a execução será interrompida antes de escrever no banco.

## 8. Decisões ainda necessárias antes de executar a Fase 1

As seguintes definições não foram inventadas e permanecem pendentes:

1. confirmar o diretório externo proposto para os backups;
2. autorizar ou não um checkpoint Git e definir se ele poderá incluir push;
3. escolher como versionar `backend/documentos/banco.sql`;
4. definir se idade será obrigatória, a faixa aceita e a participação de menores;
5. definir a qual eleição o texto “eleição anterior” se refere, para que a interface não seja ambígua;
6. confirmar `Cadastro legado`, `cadastro-legado` e `legado` como valores da origem inicial;
7. definir futuramente as categorias oficiais de problema e se serão catálogo no banco ou configuração compartilhada;
8. definir quais campos já preenchidos poderão ser alterados, sob quais critérios e como a pessoa será validada;
9. aprovar posteriormente a modelagem física separada de privacidade e consentimentos da Fase 2.

## 9. Estado ao encerrar esta continuação

- Git: alterações existentes preservadas e inventariadas;
- banco oficial: `criar_banco` documentado;
- tabelas oficiais atuais: três;
- backup: estratégia pronta, ainda não executada;
- restauração: estratégia pronta, ainda não executada;
- controle de migrations: proposta pronta, ainda não implementada;
- Fase 1: modelagem mínima e quatro migrations propostas, ainda não criadas;
- aplicação: nenhuma funcionalidade alterada;
- banco: nenhuma alteração realizada.

## 10. Execução operacional aprovada

Após a aprovação da continuação da Fase 0, o backup e a restauração foram executados em 21/07/2026.

- diretório externo: `C:\Users\gabriellindo\Backups\A_Voz_do_Bairro\criar_banco\2026-07-21_165352`;
- archive: `criar_banco_2026-07-21_165352.dump`;
- tamanho: `18850` bytes;
- SHA-256: `BDC80E7095F87D96C040C5304360A3B38EB39AE909DA6CB8276D96786DF9BB84`;
- banco restaurado: `criar_banco_restauracao_20260721_165352`;
- banco restaurado preservado para aprovação;
- tabelas equivalentes: `consentimentos`, `contatos` e `usuarios`;
- contagens equivalentes: 4 contatos, 1 usuário, 8 consentimentos legados e nenhum consentimento novo;
- colunas, estrutura de constraints, índices, triggers e sequências comparados por assinaturas;
- 49 constraints presentes e validadas nos dois bancos;
- nenhum consentimento órfão e nenhum telefone normalizado duplicado.

Três expressões `CHECK` que usam arrays foram renderizadas com sintaxe canônica diferente após a restauração. Nomes, tipos, colunas, estado validado e comportamento estrutural permaneceram equivalentes. O resultado completo está no manifesto externo do backup.

A documentação passou a usar o nome oficial `criar_banco`. O `backend/.gitignore` recebeu uma exceção específica para versionar `backend/documentos/banco.sql`, mantendo os demais itens de `documentos/` ignorados.

O backup e a restauração cumpriram o bloqueio operacional anterior à primeira migration estrutural. O checkpoint `ad61fd1` (`checkpoint: estado antes da fase 1`) foi criado e enviado para `origin/main`. Depois disso, o preflight imediatamente anterior às migrations foi aprovado e a Fase 1 pôde ser executada.

## 11. Atualização oficial sobre ManyChat

O A Voz do Bairro permanece como fonte oficial dos dados e deve funcionar sem ManyChat. A plataforma poderá ser contratada futuramente apenas como canal adicional de automação e coleta pelo WhatsApp.

Nenhuma integração, webhook, endpoint, token, origem específica ou alteração de banco foi criada para simular essa contratação. API direta da Meta/WhatsApp, WhatsApp Web, chatbox próprio e automação própria de mensagens foram retirados do planejamento.
