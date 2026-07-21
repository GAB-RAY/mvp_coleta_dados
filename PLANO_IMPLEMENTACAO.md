# Plano de implementação — A Voz do Bairro

> Documento de diagnóstico. Nenhuma funcionalidade, rota, regra de negócio ou estrutura do banco foi alterada nesta etapa.

## Escopo da análise

Este diagnóstico foi produzido a partir de:

- leitura integral da especificação oficial recebida;
- inventário do repositório e do estado do Git;
- leitura de todo o backend, incluindo scripts, migration e testes;
- leitura de todo o frontend, incluindo páginas, componentes, serviços, dados e estilos;
- leitura do script original `backend/documentos/banco.sql`;
- inspeção somente de leitura do schema PostgreSQL realmente conectado;
- comparação entre código, documentação, schema físico e especificação nova.

Nenhum segredo do `.env` foi registrado neste documento.

## Conclusões críticas

1. A especificação informa que o banco possui duas tabelas, mas o banco físico atual possui **três**: `contatos`, `usuarios` e `consentimentos`. A terceira tabela foi criada pela migration já aplicada e contém dados. Ela deve ser preservada.
2. O banco conectado se chama **`criar_banco`**, enquanto READMEs anteriores citam `cirar_banco`. Essa divergência precisa ser corrigida na documentação depois da confirmação do nome oficial.
3. O consentimento atual `mensagens_whatsapp` reúne mensagens sociais e políticas. A especificação nova exige consentimentos separados para projetos sociais e conteúdo político. Os dados legados não permitem inferir autorização para cada finalidade.
4. O sistema atual não possui perfis de acesso. Existe somente usuário ativo/inativo e qualquer JWT válido acessa a listagem administrativa.
5. O formulário público, login e listagem funcionam, mas cadastro manual, importação, origens cadastradas, revogações, exclusões, campanhas e ManyChat não existem.
6. O repositório já está com alterações não commitadas e o frontend inteiro aparece como não rastreado no Git. Esse estado precisa ser preservado e revisado antes das próximas fases.
7. O executor de migrations reaplica todos os arquivos SQL em toda execução e não possui tabela de controle. Isso exige migrations rigorosamente idempotentes ou uma decisão sobre controle formal de versões.

# 1. Estado atual

## 1.1 Tecnologias e arquitetura

### Backend

- Node.js;
- Express 5;
- CommonJS;
- PostgreSQL 18.4;
- acesso direto com `pg`;
- `bcrypt`;
- `jsonwebtoken`;
- `helmet`;
- `cors`;
- `dotenv`;
- sem ORM e sem TypeScript.

Arquitetura modular por funcionalidade:

```text
Route -> Controller -> Service -> Model -> PostgreSQL
```

Módulos atuais:

- `autenticacao`;
- `contatos`;
- `usuarios`;
- `teste`.

Middlewares compartilhados:

- autenticação JWT;
- rota não encontrada;
- tratamento de erros.

### Frontend

- React 19;
- React Router DOM;
- Vite;
- JavaScript;
- Fetch nativo;
- CSS tradicional;
- JWT armazenado no `localStorage`.

O frontend separa páginas, componentes, serviços, dados, utilitários e estilos.

## 1.2 Funcionalidades existentes

### Prontas e em uso

- teste de conexão da API com o PostgreSQL;
- cadastro público sem autenticação;
- nome, telefone, bairro e problema;
- catálogo local de 166 bairros do Rio de Janeiro;
- catálogo local de 14 categorias de problema;
- busca e confirmação de bairro por combobox;
- normalização básica do telefone removendo caracteres não numéricos;
- unicidade física do telefone normalizado;
- rejeição de telefone duplicado com HTTP `409`;
- aceite obrigatório do tratamento dos dados;
- consentimento agregado para mensagens pelo WhatsApp;
- consentimento para ligações;
- gravação transacional do contato e do histórico de consentimentos;
- textos e versões centralizados no backend;
- login administrativo com bcrypt e JWT;
- criação de administrador por script;
- listagem administrativa protegida;
- filtros por nome, telefone, bairro, problema, consentimento WhatsApp, consentimento de ligações, origem textual e status textual;
- paginação;
- sessão expirada e logout local;
- respostas de erro sem stack trace;
- layout público responsivo em laranja;
- testes integrados do fluxo atual de consentimentos.

### Ainda inexistentes

- idade;
- participação na eleição anterior;
- categoria e descrição de problema separadas;
- origem cadastrada e validada por slug;
- links rastreáveis e QR Codes;
- página pública exclusiva de Aviso de Privacidade;
- consentimentos separados para projetos sociais e conteúdo político;
- estado explícito `revogado` na leitura atual;
- perfis e autorização por função;
- cadastro manual;
- importação CSV/XLSX;
- detalhe do contato;
- histórico geral do contato;
- interrupção geral;
- revogação administrativa;
- solicitações de exclusão/anonimização;
- campanhas e segmentação;
- endpoints ou contratos implementados para ManyChat;
- rate limit, honeypot e proteção anti-spam específica;
- relatórios por origem;
- testes automatizados de todas as áreas previstas na nova especificação.

## 1.3 Telas e rotas do frontend

| Rota | Tela atual | Acesso |
| --- | --- | --- |
| `/` | Formulário público | Público |
| `/login` | Login administrativo | Público |
| `/admin` | Redirecionamento para contatos | Depende de token local |
| `/admin/contatos` | Listagem, filtros e paginação | Protegido no frontend e backend |
| `*` | Página 404 | Público |

Não existem páginas de aviso de privacidade, contato detalhado, cadastro manual, importação, origens, campanhas, exclusões ou ManyChat.

## 1.4 Rotas do backend

| Método e rota | Proteção | Função |
| --- | --- | --- |
| `GET /api/teste` | Pública | Testa API e PostgreSQL |
| `POST /api/publico/contatos` | Pública | Cria um contato e seus históricos |
| `POST /api/autenticacao/login` | Pública | Valida credenciais e gera JWT |
| `GET /api/admin/contatos` | JWT | Lista, filtra e pagina contatos |

Não existe endpoint de perfil, detalhe, atualização, revogação, cadastro manual, importação, origem, exclusão, campanha ou integração.

## 1.5 Autenticação e acesso

- senha armazenada com bcrypt;
- JWT contém `id` e `email`;
- middleware valida Bearer Token;
- usuário possui somente `ativo`;
- não existe coluna `perfil`, `papel` ou permissões;
- não existe verificação de usuário no banco a cada requisição autenticada;
- um token já emitido não é revogado quando o usuário é desativado;
- qualquer JWT válido assinado pelo sistema acessa a listagem;
- frontend considera a simples presença do token para renderizar a rota protegida;
- token fica em `localStorage`.

## 1.6 Banco PostgreSQL real

Banco conectado: `criar_banco`.

Schema: `public`.

### Volumes atuais

| Tabela | Registros |
| --- | ---: |
| `contatos` | 4 |
| `usuarios` | 1 |
| `consentimentos` | 8 |

Não foram encontradas duplicidades em `telefone_normalizado` nem históricos órfãos.

### `usuarios`

Colunas:

- `id BIGINT IDENTITY`;
- `nome VARCHAR(150)`;
- `email VARCHAR(200)`;
- `senha_hash VARCHAR(255)`;
- `ativo BOOLEAN`;
- `criado_em TIMESTAMPTZ`;
- `atualizado_em TIMESTAMPTZ`.

Integridade:

- chave primária em `id`;
- email único sem diferenciar maiúsculas e minúsculas;
- checks mínimos de nome e email;
- trigger para atualizar `atualizado_em`.

O único usuário está ativo. Não há perfil de acesso.

### `contatos`

Colunas atuais:

- identificação: `id`, `nome`;
- telefone: `telefone`, `telefone_normalizado`;
- demanda: `bairro`, `problema`;
- campos legados: `consentimento_armazenamento`, `consentimento_mensagens`, `consentimento_armazenamento_em`, `consentimento_mensagens_em`;
- datas: `criado_em`, `atualizado_em`, `consentimentos_atualizados_em`;
- campos atuais: `consentimento_tratamento_dados`, `consentimento_whatsapp`, `consentimento_ligacoes`;
- operação: `origem_atual`, `status_contato`, `bloqueado_para_mensagens`, `excluido_logicamente`.

Integridade:

- chave primária em `id`;
- telefone normalizado único;
- telefone normalizado somente numérico e entre 10 e 15 dígitos;
- checks de texto não vazio;
- campo legado de armazenamento sempre `true`;
- coerência entre o campo legado de mensagens e sua data;
- índices de busca e ordenação;
- trigger de atualização de data.

Estado agregado atual:

- 4 contatos com status `ativo`;
- 4 contatos com origem `Cadastro legado`;
- 4 contatos não bloqueados para mensagens;
- 4 contatos não excluídos logicamente;
- 4 com tratamento `true`;
- 4 com WhatsApp agregado `true`;
- 4 com ligações `null`.

### `consentimentos`

Colunas atuais:

- `id BIGINT IDENTITY`;
- `contato_id`;
- `tipo`;
- `resposta BOOLEAN`;
- `texto_apresentado`;
- `versao_texto`;
- `canal`;
- `origem_registro`;
- `registrado_por_usuario_id`;
- `criado_em`;
- `revogado_em`;
- `ativo`.

Tipos permitidos atualmente:

- `tratamento_dados`;
- `mensagens_whatsapp`;
- `ligacoes`.

Relacionamentos:

- `consentimentos.contato_id -> contatos.id`;
- `consentimentos.registrado_por_usuario_id -> usuarios.id`, com `ON DELETE SET NULL`.

Integridade:

- resposta obrigatoriamente booleana;
- checks para tipo, canal e origem do registro;
- índice único parcial permite apenas um registro ativo por contato e tipo;
- índices por contato e data.

Dados atuais:

- 4 históricos `tratamento_dados=true`;
- 4 históricos `mensagens_whatsapp=true`;
- todos são de migração legada, versão `legado_v1`;
- não existem históricos de ligação;
- não existem históricos com usuário responsável;
- não existem registros revogados.

### Outros objetos

- função `atualizar_data_modificacao()`;
- triggers em `contatos` e `usuarios`;
- Row Level Security desativado nas três tabelas;
- nenhuma tabela de controle de migrations;
- `pg_dump`, `pg_restore` e `psql` não estão disponíveis no `PATH` atual.

## 1.7 Regra atual de duplicidade

O backend:

1. remove tudo que não é dígito;
2. exige entre 10 e 15 dígitos;
3. busca igualdade em `telefone_normalizado`;
4. retorna `409` se já existir;
5. não atualiza dados nem consentimentos.

A especificação nova exige criar ou atualizar sem duplicar, mas não define quais campos podem ser atualizados. Essa mudança está bloqueada por decisão de negócio.

## 1.8 Regra atual de consentimentos

- tratamento dos dados: obrigatório e `true`;
- WhatsApp: booleano agregado para assuntos sociais e políticos;
- ligações: booleano quando apresentado;
- cliente antigo pode omitir ligações, gerando `null`;
- `true`, `false` e `null` são exibidos como Sim, Não e Não informado;
- não existe estado explícito `revogado` na resposta administrativa;
- bloqueio geral de mensagens considera somente o consentimento agregado de WhatsApp;
- o aceite de privacidade é armazenado como um tipo na mesma tabela de consentimentos.

## 1.9 Estado visual

- página pública usa Laranja Neon `#FF5C00` e é responsiva;
- formulário possui identidade, símbolo simples, aviso e rodapé;
- login e área administrativa ainda usam tokens globais verdes;
- tokens de tema globais são verdes, enquanto o laranja é redefinido localmente na página pública;
- a hierarquia atual mostra o subtítulo em `<h1>` e o nome do projeto em texto pequeno, diferente da hierarquia pedida;
- o rodapé repete iniciativa e tratamento dos dados em uma frase que não corresponde exatamente às duas opções da nova especificação.

## 1.10 Testes atuais

Existe um script integrado próprio:

```text
npm run testar:consentimentos
```

Ele cobre:

- inicialização e banco;
- autenticação obrigatória da listagem;
- rota inexistente;
- consentimentos `true`, `false` e `null`;
- aliases antigos;
- validações de tipo;
- duplicidade;
- rollback transacional;
- constraints;
- filtros e paginação;
- limpeza dos registros temporários.

Limitações dos testes atuais:

- não existe framework de testes configurado;
- não existem testes versionados do frontend;
- não há testes de perfil/autorização;
- não há cobertura das funcionalidades novas da especificação;
- o script de teste usa o banco configurado no `.env`, embora limpe os IDs criados por ele.

# 2. Comparação com a especificação

Legenda:

- ✅ já existe;
- 🟡 existe parcialmente;
- ❌ não existe.

## 2.1 Regras gerais e restrições

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Preservar projeto e banco | ✅ | O projeto e o banco existentes estão em uso e podem ser evoluídos incrementalmente. |
| Banco com apenas duas tabelas | ❌ | O banco físico possui três tabelas; `consentimentos` já existe e tem 8 registros. |
| Migrations seguras | 🟡 | Existe uma migration idempotente, mas não há controle de migrations executadas nem rollback documentado. |
| CommonJS no backend | ✅ | Todo o backend usa CommonJS. |
| Código simples e modular | ✅ | Arquitetura modular por funcionalidade, sem ORM. |
| Validação no backend | 🟡 | O fluxo atual é validado, mas ainda não existem validações dos novos domínios. |
| SQL parametrizado | ✅ | Models atuais usam parâmetros. |
| Tratamento de erros | ✅ | Há middleware e mensagens sem stack trace. |
| Não enviar mensagens/Meta/ManyChat real | ✅ | Nenhuma integração ou disparo existe. |
| Não criar consentimento por email | ✅ | Não existe consentimento nem envio por email. |
| Não coletar data de nascimento | ✅ | Data de nascimento não é coletada. |
| Coletar idade | ❌ | Campo inexistente. |
| Consentimentos desmarcados por padrão | ✅ | Os três checkboxes atuais começam em `false`. |
| Aceite de privacidade independente da comunicação | ✅ | O tratamento é obrigatório e não marca os opcionais. |

## 2.2 Quatro formas de entrada e objetivo da etapa

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Cadastro público | ✅ | Existe e está integrado ao banco. |
| Importação CSV/XLSX | ❌ | Não há upload, parsing, prévia, mapeamento ou relatório. |
| Cadastro manual | ❌ | Não há rota nem tela. |
| Entrada futura via ManyChat | ❌ | Não existem contratos, endpoints ou configuração preparatória. |
| Origem, idade, eleição anterior e descrição | ❌ | Não existem, salvo origem textual fixa. |
| Recusas e revogações | 🟡 | Recusa booleana pode ser gravada; revogação não tem fluxo. |
| Interrupção geral | ❌ | Existe apenas um bloqueio calculado pelo WhatsApp agregado. |
| Solicitações de exclusão | 🟡 | Há flag de exclusão lógica, mas não há solicitação, workflow ou histórico. |
| Campanhas e segmentação | ❌ | Não existem estruturas ou telas. |

## 2.3 Identidade institucional e visual

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Laranja como identidade principal | 🟡 | Página pública é laranja; login e administração continuam verdes. |
| Tokens centrais de tema | 🟡 | Existem variáveis CSS, mas o tema global é verde e há hexadecimais laranja repetidos localmente. |
| Contraste e responsividade | ✅ | Página pública e tabela possuem tratamento responsivo. |
| Hierarquia institucional no topo | 🟡 | Os três textos existem, mas `A VOZ DO BAIRRO` não é o título principal. |
| Rodapé sem repetição | 🟡 | Há identificação, porém o texto combina iniciativa e tratamento, repetindo informações da seção de privacidade. |

## 2.4 Cadastro público por link ou QR Code

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Acesso sem login por link | ✅ | A rota `/` é pública. |
| Rota `/participar` | ❌ | O formulário existe somente em `/`. |
| QR Code | ❌ | Um QR externo poderia apontar para `/`, mas o sistema não gera, valida nem gerencia QR Codes. |
| Responsividade e laranja | ✅ | Implementados na página pública. |
| Proteção contra abuso | ❌ | Não há rate limit, honeypot, CAPTCHA ou proteção específica. |
| Origem da divulgação | ❌ | A origem é fixa no backend e a query string é ignorada. |
| Não expor dados administrativos | ✅ | A página pública não lista contatos. |
| Nome, telefone, bairro e problema | ✅ | Implementados. |
| Idade | ❌ | Inexistente. |
| Categoria e descrição do problema | 🟡 | `problema` guarda uma categoria local; não há campos separados nem descrição opcional. |
| Participação na eleição anterior | ❌ | Inexistente. |
| Participação com comunicação recusada | ✅ | O formulário aceita WhatsApp e ligações desmarcados. |
| Sanitização | 🟡 | Há `trim` e normalização de telefone; não há estratégia explícita para todos os novos campos. |
| Criar ou atualizar sem duplicar | 🟡 | Impede duplicidade, mas sempre retorna `409`; não atualiza. |
| Histórico geral | 🟡 | Há histórico de consentimento, não do cadastro e demais alterações. |
| Confirmação de sucesso | ✅ | Existe, com texto diferente da sugestão nova. |

## 2.5 Origens, links e QR Codes

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Origem recebida na URL | ❌ | Query `origem` não é lida pelo formulário. |
| Origem validada por slug/código | ❌ | Não há catálogo. |
| Origem padrão | 🟡 | Existe string fixa, mas não uma origem cadastrada e validada. |
| Ativar/desativar origem | ❌ | Inexistente. |
| Gerar links e preparar QR Codes | ❌ | Inexistente. |
| Relatório por origem | ❌ | Inexistente. |
| Tela administrativa de origens | ❌ | Inexistente. |

## 2.6 Aviso de Privacidade e aceite

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Responsável identificado | ✅ | Diogo Ventura aparece na página. |
| Aceite obrigatório junto ao envio | ✅ | Checkbox obrigatório e desmarcado. |
| Data, hora e versão | ✅ | Gravadas no histórico oficial. |
| Origem do aceite | 🟡 | Canal é gravado, mas não há origem de divulgação validada. |
| Independência de comunicações | ✅ | Aceite não marca comunicação. |
| Página pública própria | ❌ | Existe somente uma seção resumida dentro do formulário. |
| Conteúdo completo do aviso | 🟡 | Finalidade e responsável aparecem; faltam detalhamento, retenção, interrupção, exclusão e canais. |
| Canal real do titular | ❌ | Não definido, e corretamente não foi inventado. |

## 2.7 Consentimentos

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Projetos sociais separado | ❌ | Está misturado em `mensagens_whatsapp`. |
| Conteúdo político separado | ❌ | Está misturado em `mensagens_whatsapp`. |
| Ligações separado | ✅ | Existe campo e tipo próprios. |
| Sem consentimento por email | ✅ | Não existe. |
| Estados não informado/autorizado/recusado/revogado | 🟡 | `null/true/false` existem; revogado não é representado claramente na API e UI. |
| Auditoria com texto, versão, canal e data | ✅ | Existe na tabela atual. |
| Usuário interno responsável | 🟡 | A coluna existe, mas não há cadastro manual que a use. |
| Conversa/evento ManyChat | ❌ | Campo inexistente. |
| Observação opcional | ❌ | Campo inexistente. |
| Textos configuráveis e versionados | 🟡 | São centralizados e versionados em arquivo, mas não configuráveis sem alteração de código. |
| Um consentimento não altera os demais | 🟡 | WhatsApp e ligações são independentes, mas social e político ainda são um só. |

## 2.8 Cadastro manual interno

Todos os requisitos estão ❌: não há rota, controller, service, model específico, tela, perfil de autorização, autoria, origem ou coleta tri-state manual.

## 2.9 Importação CSV e XLSX

Todos os requisitos estão ❌: não há dependência para upload/XLSX, seleção, prévia, mapeamento, validação, relatório, proteção de arquivo ou histórico de importação.

## 2.10 Contatos, normalização e duplicidade

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Dados básicos do contato | 🟡 | Nome, telefone, bairro e problema existem; idade, categoria, descrição e eleição não. |
| Telefone original e normalizado | ✅ | Ambos existem. |
| Normalização reutilizável | 🟡 | A função é reutilizável, mas apenas remove não dígitos; não trata país/DDD de forma canônica. |
| Busca antes de criar | ✅ | Implementada. |
| Atualização segura do existente | ❌ | Duplicidade retorna `409`. |
| Histórico da atualização | ❌ | Não há histórico geral. |
| Relatório prévio de duplicidades | ✅ | A auditoria atual encontrou zero duplicidades. |
| Unicidade após análise | ✅ | Índice único já existe no banco físico. |

## 2.11 Status do contato

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Campo de status | 🟡 | `status_contato` existe como texto livre nullable. |
| Valores claros e consistentes | ❌ | Não há check, catálogo, service de transição ou histórico. |
| Separar recusa, bloqueio, interrupção e exclusão | ❌ | O modelo atual não representa todos esses eventos separadamente. |

## 2.12 Interrupção, recusa e revogação

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Recusa específica | 🟡 | Pode ser registrada no cadastro público para os tipos atuais. |
| Revogação | 🟡 | A tabela possui `revogado_em`, mas não há regra, rota ou interface. |
| Interrupção geral | ❌ | Inexistente. |
| Bloqueio para campanhas | 🟡 | Há um booleano para mensagens, sem campanhas e sem separação por finalidade. |
| Registro de data, origem e histórico | 🟡 | Existe para consentimentos iniciais, não para interrupção. |
| Preparação de frases de parada | ❌ | Nenhum contrato ou endpoint preparado. |

## 2.13 Solicitações de exclusão

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Flag de exclusão lógica | 🟡 | `excluido_logicamente` existe. |
| Registro da solicitação e workflow | ❌ | Tabela e regras inexistentes. |
| Bloqueio imediato de mensagens e ligações | ❌ | Não há fluxo. |
| Anonimização e decisão administrativa | ❌ | Inexistentes. |

## 2.14 Campanhas e segmentação

Todos os requisitos estão ❌: não existem campanhas, audiência, critérios de elegibilidade, prévia, motivos de inelegibilidade ou configuração jurídica. Nenhum disparo existe, conforme exigido.

## 2.15 Preparação para ManyChat

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Integração real desativada | ✅ | Não existe conexão, token ou envio. |
| Sistema como fonte principal | ✅ | O PostgreSQL local é a fonte atual. |
| Endpoints preparatórios | ❌ | Nenhum endpoint existe. |
| Autenticação de integração | ❌ | Inexistente. |
| Feature flag, rate limit e logs | ❌ | Inexistentes. |
| Contratos e exemplos no README | ❌ | Inexistentes. |

## 2.16 Histórico e auditoria

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Histórico de consentimentos | ✅ | Existe com integridade referencial. |
| Histórico de cadastro, atualização e status | ❌ | Inexistente. |
| Histórico de origem, importação e campanha | ❌ | Inexistente. |
| Eventos de integração | ❌ | Inexistente. |
| Logs sem segredos | 🟡 | Erros atuais não imprimem tokens, mas não há política estruturada de auditoria. |

## 2.17 Frontend

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Formulário público | ✅ | Existe. |
| Aviso de privacidade | 🟡 | Seção resumida, não página própria. |
| Confirmação | ✅ | Mensagem na página. |
| Origem na URL | ❌ | Inexistente. |
| Acessibilidade básica | ✅ | Labels, ARIA, foco e teclado estão presentes. |
| Listagem administrativa | ✅ | Existe com filtros e paginação. |
| Detalhe, manual, importação, origens | ❌ | Páginas inexistentes. |
| Consentimentos e histórico no detalhe | ❌ | Inexistente. |
| Campanhas, exclusões e ManyChat | ❌ | Inexistentes. |
| Indicadores de quatro estados | 🟡 | Mostra Sim, Não e Não informado; não mostra revogado. |

## 2.18 Banco de dados

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Analisar tabelas existentes | ✅ | Três tabelas físicas foram auditadas. |
| Não duplicar estruturas corretas | ✅ | A tabela `consentimentos` deve ser evoluída, não recriada. |
| FKs, índices e constraints | 🟡 | Presentes nas estruturas atuais; domínios novos não existem. |
| Preservar dados | ✅ | Não houve escrita nesta etapa. |
| Migrations ordenadas | 🟡 | Existe `003`; não há `001/002` na pasta nem ledger de execução. |
| Reversão segura documentada | ❌ | Inexistente. |

## 2.19 Segurança

| Requisito | Estado | Diagnóstico |
| --- | --- | --- |
| Autenticação administrativa | ✅ | JWT aplicado à listagem. |
| Autorização por perfil | ❌ | Não há perfis. |
| Validação de payload | 🟡 | Existe nos fluxos atuais. |
| Rate limit e anti-spam | ❌ | Inexistentes. |
| Segurança de upload | ❌ | Upload não existe. |
| SQL Injection | ✅ | Queries atuais são parametrizadas. |
| XSS | 🟡 | React escapa renderização; não há estratégia de sanitização para novos campos/arquivos. |
| CORS e headers | ✅ | CORS configurado e Helmet habilitado. |
| Segredos em ambiente | ✅ | `.env` é ignorado e exemplos não contêm segredo real. |
| Proteção de integração | ❌ | Endpoints não existem. |
| Erros sem detalhes internos | ✅ | Middleware usa mensagem genérica no `500`. |

## 2.20 Testes

| Grupo | Estado | Diagnóstico |
| --- | --- | --- |
| Cadastro atual, consentimentos e duplicidade | ✅ | Cobertura integrada existente. |
| Origem válida/inválida e atualização segura | ❌ | Funcionalidades inexistentes. |
| Cadastro manual e importação | ❌ | Inexistentes. |
| Consentimento político independente | ❌ | Tipo inexistente. |
| Revogação, interrupção e exclusão | ❌ | Inexistentes. |
| Campanhas e elegibilidade | ❌ | Inexistentes. |
| Autenticação/payload ManyChat | ❌ | Inexistentes. |
| Testes automatizados do frontend | ❌ | Não há suíte versionada. |

## 2.21 README obrigatório

🟡 Os READMEs atuais documentam bem o MVP atual, mas não cobrem backup, origens/QR, cadastro manual, importação, consentimento político separado, interrupções, exclusões, campanhas ou ManyChat. Também citam um nome de banco divergente do banco conectado.

## 2.22 Relatório final obrigatório

🟡 Existe `RELATORIO_TECNICO_SISTEMA.md` referente à etapa anterior. Não existe `RELATORIO_IMPLEMENTACAO.md` com o escopo desta especificação. Ele só deve ser criado e atualizado durante as fases aprovadas.

## 2.23 Ordem de execução

🟡 A análise e o diagnóstico foram feitos. Backup, decisões, migrations e implementação ainda não começaram, corretamente, porque dependem da aprovação deste plano.

## 2.24 Entrega

🟡 Nesta etapa será entregue somente o diagnóstico e o plano. Código, migrations futuras, testes novos, README final e `RELATORIO_IMPLEMENTACAO.md` dependem de aprovação fase a fase.

# 3. Alterações necessárias

As listas abaixo são uma proposta de escopo, não autorização para implementar. Itens marcados como “decisão pendente” não podem avançar sem resposta às dúvidas da seção 6.

## 3.1 Backup e controle de migrations

Antes de qualquer alteração estrutural:

1. localizar ou instalar as ferramentas oficiais `pg_dump` e `pg_restore`;
2. criar backup com timestamp fora do repositório;
3. registrar banco, tamanho e horário sem expor credenciais;
4. validar o arquivo gerado;
5. preferencialmente testar restauração em outro banco;
6. decidir se será criada uma tabela de controle de migrations;
7. nunca usar o banco principal como ambiente de teste destrutivo.

## 3.2 Alterações propostas em tabelas existentes

### `contatos`

Campos necessários pela especificação:

- idade;
- categoria do problema;
- descrição opcional do problema;
- participação opcional na eleição anterior;
- referência para origem cadastrada;
- referência para usuário criador, quando manual;
- meio ou forma de entrada;
- data da interrupção geral;
- origem da interrupção;
- bloqueio específico para ligações ou regra equivalente;
- campos necessários para solicitação de exclusão e anonimização, sem substituir a tabela de solicitações;
- status com valores e transições aprovados.

Decisões pendentes:

- tipos, limites e obrigatoriedade de idade;
- modelo de categoria/problema;
- opções da participação eleitoral;
- estratégia para campos rápidos de consentimento;
- nomenclatura e transições de status;
- quais campos podem ser atualizados em duplicidade.

### `usuarios`

Necessário para autorização:

- perfil/papel ou relacionamento equivalente;
- possivelmente data de desativação e auditoria de alteração.

A matriz de perfis ainda não foi definida.

### `consentimentos`

A tabela atual deve ser evoluída, nunca recriada.

Necessidades:

- tipos específicos `projetos_sociais`, `conteudo_politico` e `ligacoes`;
- representação explícita de autorizado, recusado e revogado;
- “não informado” pela ausência de registro ativo ou regra aprovada;
- identificador futuro de conversa/evento;
- observação opcional;
- meio/origem da resposta;
- coerência de revogação;
- preservação integral dos registros legados.

Não é seguro converter `mensagens_whatsapp` legado automaticamente em autorização social e política.

## 3.3 Novas tabelas propostas

### Necessárias para requisitos explícitos

| Tabela proposta | Finalidade |
| --- | --- |
| `origens` | Catálogo seguro de origens, slug, tipo, atividade e autoria. |
| `historico_contatos` | Eventos gerais de cadastro, atualização, status, bloqueio, origem e demais ações. |
| `solicitacoes_exclusao` | Workflow de exclusão/anonimização. |
| `importacoes` | Lote, arquivo controlado, origem, status e totais. |
| `importacao_erros` | Erros por linha e motivo. |
| `campanhas` | Definição e configuração da campanha, sem envio. |
| `campanha_contatos` | Prévia/associação, elegibilidade e motivo de exclusão. |
| `eventos_integracao` | Auditoria de chamadas futuras e erros de integração. |

### Dependentes de decisão arquitetural

| Tabela candidata | Questão |
| --- | --- |
| `versoes_consentimento` | Usar banco para textos configuráveis ou manter constantes versionadas em código? |
| `respostas_coleta` | Necessária se respostas arbitrárias do ManyChat forem persistidas separadamente. |
| `migrations_executadas` | Adotar ledger próprio ou outra ferramenta de migrations? |
| `categorias_problema` | Manter catálogo no frontend, criar catálogo no banco ou usar texto controlado? |
| `perfis`/`usuario_perfis` | Usar enum/check simples ou tabelas de papéis e permissões? |

## 3.4 Migrations propostas

Após backup e decisões:

1. preflight com relatório de schema, duplicidades e compatibilidade;
2. origens, perfis mínimos e evolução não destrutiva de contatos;
3. evolução segura de consentimentos e preservação do legado;
4. histórico, interrupções e solicitações de exclusão;
5. importações e erros;
6. campanhas e audiência;
7. eventos de integração e campos ManyChat;
8. índices, constraints e comentários finais após validação dos dados.

Cada migration deverá usar transação quando aplicável, ser revisada, testada em cópia do banco e possuir instrução de recuperação. Nenhuma coluna antiga será removida na primeira passagem.

## 3.5 Novos módulos do backend

Mantendo a arquitetura modular atual:

```text
src/modules/
  origens/
  historico/
  importacoes/
  campanhas/
  solicitacoesExclusao/
  integracoes/manychat/
```

O módulo `contatos` deverá ser ampliado sem misturar responsabilidades:

- detalhe do contato;
- criação pública evoluída;
- cadastro manual;
- atualização segura;
- interrupção geral;
- consentimentos e revogações por services/models próprios dentro do módulo ou módulo dedicado, conforme decisão.

O módulo `usuarios` precisará de service/controller somente se houver gestão administrativa de usuários/perfis aprovada.

## 3.6 Controllers, services e models necessários

### Controllers

- `origemController`;
- `importacaoController`;
- `campanhaController`;
- `solicitacaoExclusaoController`;
- `manychatController`;
- ampliação de `contatoController` para detalhe e cadastro manual;
- controller específico de consentimentos/interrupções, se aprovado.

### Services

- validação e resolução de origem;
- criação/atualização segura de contato;
- consentimento por tipo e revogação transacional;
- histórico geral;
- cadastro manual com autoria;
- importação, prévia, mapeamento, confirmação e relatório;
- interrupção geral;
- solicitação de exclusão;
- elegibilidade de campanhas;
- autenticação e validação ManyChat;
- autorização por perfil.

### Models

- `origemModel`;
- `historicoContatoModel`;
- `importacaoModel`;
- `importacaoErroModel`;
- `campanhaModel`;
- `campanhaContatoModel`;
- `solicitacaoExclusaoModel`;
- `eventoIntegracaoModel`;
- evolução de `contatoModel`, `consentimentoModel` e `usuarioModel`.

## 3.7 Rotas propostas

Os nomes finais dependem de aprovação para manter um contrato consistente.

### Públicas

- manter `POST /api/publico/contatos`;
- criar rota pública do aviso apenas se o conteúdo vier da API;
- validar origem no envio e, opcionalmente, expor consulta pública somente do slug ativo;
- manter `/` e decidir se `/participar` será rota principal ou alias.

### Administrativas

- detalhe do contato;
- cadastro manual;
- registro de consentimento/recusa/revogação;
- interrupção geral;
- CRUD controlado de origens;
- prévia, confirmação e relatório de importação;
- gestão e prévia de campanhas;
- gestão de solicitações de exclusão;
- consulta de histórico.

### Integração futura

Rotas candidatas fornecidas pela especificação:

- `POST /api/integracoes/manychat/contatos`;
- `POST /api/integracoes/manychat/respostas`;
- `POST /api/integracoes/manychat/consentimentos`;
- `POST /api/integracoes/manychat/interrupcoes`;
- `POST /api/integracoes/manychat/solicitacoes-exclusao`;
- `POST /api/integracoes/manychat/eventos`.

Elas não devem ser registradas até serem definidos feature flag, autenticação, rate limit e contratos exatos.

## 3.8 Novas páginas do frontend

- `/participar`, caso aprovada como rota canônica;
- `/aviso-de-privacidade`;
- `/admin/contatos/novo` para cadastro manual;
- `/admin/contatos/:id` para detalhe;
- `/admin/importacoes`;
- `/admin/importacoes/:id` para prévia/relatório;
- `/admin/origens`;
- `/admin/campanhas`;
- `/admin/campanhas/:id`;
- `/admin/solicitacoes-exclusao`;
- página preparatória de integração, somente se houver informação útil sem segredo.

## 3.9 Novos componentes React

- layout e navegação administrativa;
- seletor explícito de consentimento com quatro estados;
- badge `Revogado` e badge `Bloqueado`;
- campos de idade, participação eleitoral, categoria e descrição;
- seletor de origem;
- painel de histórico;
- formulário manual;
- upload seguro de arquivo;
- prévia tabular e mapeador de colunas;
- resumo/relatório da importação;
- formulário e prévia de campanha;
- lista e tratamento de solicitações de exclusão;
- aviso de privacidade completo;
- indicador de origem válida/padrão;
- navegação e mensagens de permissão negada.

## 3.10 Segurança necessária

- rate limit no formulário público e nas integrações;
- honeypot ou alternativa aprovada;
- limite de JSON e de upload;
- validação MIME e extensão;
- nomes temporários seguros;
- descarte garantido do upload;
- autorização por perfil;
- validação central de payloads;
- feature flag e segredo de integração;
- logs estruturados sem payload sensível;
- revisão de armazenamento do JWT;
- revisão de CORS para ambientes permitidos;
- política de status e transições;
- bloqueio imediato em interrupção/exclusão.

## 3.11 Novos testes

### Banco e migrations

- backup e restauração em ambiente separado;
- migration em schema atual;
- repetição controlada;
- preservação dos 4 contatos, 1 usuário e 8 históricos;
- conversão legada sem inferir novos consentimentos;
- FKs, índices, checks e rollback.

### Backend

- origem válida, inválida, inativa e padrão;
- idade e participação eleitoral;
- categorias e descrição;
- atualização segura de contato duplicado;
- independência social/político/ligações;
- quatro estados de consentimento;
- cadastro manual com autoria e permissão;
- importação CSV e XLSX, arquivos inválidos e limites;
- interrupção geral;
- revogação específica;
- exclusão e anonimização;
- elegibilidade de campanha;
- endpoints ManyChat desativados, sem autenticação, autenticados e com payload inválido;
- rate limit e honeypot;
- regressão de login, listagem, filtros e paginação.

### Frontend

- formulário público com todos os consentimentos recusados;
- origem pela URL;
- aviso de privacidade;
- cadastro manual;
- importação e relatório;
- quatro estados visuais;
- detalhe e histórico;
- permissões;
- campanhas e exclusões;
- responsividade, acessibilidade e build.

## 3.12 README e relatório

Após cada fase aprovada:

- atualizar README do backend;
- atualizar README do frontend;
- documentar backup e migrations;
- registrar contratos reais e exemplos;
- separar implementado, preparado e inexistente;
- criar e manter `RELATORIO_IMPLEMENTACAO.md`;
- preservar `RELATORIO_TECNICO_SISTEMA.md` como histórico da etapa anterior.

# 4. Ordem ideal de implementação

Cada fase deve ser aprovada isoladamente.

## Fase 0 — Decisões e backup

- responder às dúvidas da seção 6;
- definir regras oficiais;
- regularizar ou registrar o estado do Git;
- criar e validar backup;
- definir estratégia de migrations;
- não alterar funcionalidades.

## Fase 1 — Fundação do banco

- preflight e relatório de dados;
- origens;
- evolução de contatos;
- perfis mínimos;
- constraints inicialmente compatíveis;
- executar e validar somente essa migration.

## Fase 2 — Consentimentos e privacidade

- novo modelo de tipos/status;
- preservação do legado sem inferência;
- textos/versionamento;
- aviso de privacidade;
- revogação específica no backend;
- testes de independência.

## Fase 3 — Cadastro público e origens

- idade, eleição, categoria e descrição aprovadas;
- origem por slug/link;
- atualização segura de duplicidade;
- rate limit e anti-spam;
- rota `/participar`, se aprovada;
- testes completos do fluxo público.

## Fase 4 — Perfis e cadastro manual

- autorização por perfil;
- cadastro manual;
- autoria e meio da coleta;
- consentimentos tri-state/status;
- detalhe básico do contato.

## Fase 5 — Importação

- upload controlado;
- CSV/XLSX;
- prévia e mapeamento;
- validação e confirmação;
- relatório e limpeza de temporários;
- nenhum consentimento importado.

## Fase 6 — Histórico, interrupção e exclusão

- histórico geral;
- interrupção geral;
- bloqueios separados;
- solicitações de exclusão;
- fluxo administrativo e auditoria.

## Fase 7 — Campanhas sem disparo

- campanhas;
- regras aprovadas de consentimento;
- prévia de audiência;
- motivos de inelegibilidade;
- nenhum envio real.

## Fase 8 — Preparação ManyChat

- contratos aprovados;
- feature flag desativada por padrão;
- segredo e autenticação;
- rate limit;
- validação e eventos;
- exemplos no README;
- nenhuma conexão real.

## Fase 9 — Consolidação do frontend

- navegação administrativa;
- páginas restantes;
- tema laranja central;
- estados visuais;
- responsividade e acessibilidade.

## Fase 10 — Regressão e documentação final

- executar todos os testes;
- validar banco e dados preservados;
- validar build e console;
- atualizar READMEs;
- concluir `RELATORIO_IMPLEMENTACAO.md`;
- entregar limitações e próximos passos.

# 5. Riscos

## 5.1 Dados e migrations

- o schema real já diverge da premissa de duas tabelas;
- a migration `003` já foi aplicada e não pode ser ignorada;
- o runner reaplica todos os SQLs e não registra versões executadas;
- constraints legadas obrigam `consentimento_armazenamento=true` e `consentimento_mensagens` não nulo;
- usar `false` em campo legado para uma importação sem resposta pode ser confundido com recusa, mesmo que os campos atuais usem `null`;
- alterar checks e tipos de consentimento pode bloquear os 8 históricos existentes;
- scripts de rollback que removam colunas ou tabelas podem causar perda;
- ferramentas de backup não estão no `PATH`;
- o banco configurado pode ser o banco principal do usuário, portanto testes destrutivos são inadequados.

## 5.2 Consentimentos e LGPD

- autorização legada de WhatsApp não prova autorização social e política separadamente;
- o aceite do aviso está na tabela de consentimentos, embora a nova especificação limite os consentimentos de comunicação a três tipos;
- copiar o consentimento agregado para os dois novos tipos seria uma inferência proibida;
- revogação, interrupção e exclusão precisam de efeitos diferentes;
- falta canal real para direitos dos titulares;
- critérios de retenção e anonimização não estão definidos.

## 5.3 Duplicidade e atualização

- mudar de `409` para atualização automática pode sobrescrever nome, bairro, problema ou consentimentos antigos;
- telefone com e sem código do país pode representar a mesma pessoa e hoje não é canonicalizado;
- normalização mais agressiva pode criar colisões entre os 4 contatos existentes e registros futuros;
- importação e cadastro manual precisam compartilhar exatamente a mesma regra.

## 5.4 Acesso e segurança

- não existem perfis;
- token emitido continua válido mesmo após desativação do usuário;
- JWT no `localStorage` aumenta impacto de eventual XSS;
- formulário público não possui rate limit;
- upload de planilha amplia superfície de ataque;
- endpoints ManyChat não podem ser registrados antes da proteção;
- CORS aceita uma única origem configurada, o que pode precisar de adaptação por ambiente.

## 5.5 Interface e escopo

- o escopo é grande para uma única entrega e deve permanecer dividido;
- alterar o tema global pode quebrar contraste do login e da administração;
- a tabela atual já exige rolagem horizontal; mais colunas devem ir para detalhe, não para a listagem inteira;
- categorias mantidas somente no frontend podem divergir do backend/importação;
- frontend inteiro está não rastreado no Git, aumentando o risco de perda ou revisão incompleta.

## 5.6 Campanhas e regras políticas

- pesquisa e institucional não possuem regra de consentimento definida;
- regras eleitorais não podem ser codificadas sem orientação jurídica e configuração;
- estimativa de audiência precisa usar filtros reproduzíveis e auditáveis;
- “preparar campanha” não autoriza qualquer disparo.

# 6. Dúvidas bloqueantes

Nenhuma das decisões abaixo deve ser assumida durante a implementação.

## 6.1 Banco e ambiente

1. O nome oficial do banco deve ser `criar_banco` ou `cirar_banco`? O `.env` conecta no primeiro e a documentação anterior cita o segundo.
2. Confirma que a tabela `consentimentos`, já existente e populada, deve ser considerada parte oficial do estado atual apesar da frase “apenas 2 tabelas”?
3. Você aprova criar uma tabela de controle de migrations ou prefere manter scripts idempotentes reaplicados em ordem?
4. Onde o backup deve ser armazenado e quem validará a restauração?

## 6.2 Consentimentos e legado

5. O consentimento legado `mensagens_whatsapp=true` deve permanecer apenas como legado sem equivaler a projetos sociais ou conteúdo político? Esta é a opção tecnicamente mais conservadora.
6. O aceite obrigatório do aviso de privacidade deve continuar na tabela `consentimentos` como `tratamento_dados`, ou deve ser representado separadamente como aceite/evento para que a tabela contenha somente consentimentos de comunicação?
7. O estado oficial deve ser uma coluna textual (`autorizado`, `recusado`, `revogado`) ou manter `resposta + ativo + revogado_em` e derivar o estado na aplicação?
8. Os textos “sugeridos” da especificação já são os textos jurídicos finais da versão 1 ou ainda serão revisados?
9. Ao registrar uma nova resposta, o histórico anterior deve ser desativado sempre, inclusive em uma repetição com o mesmo valor?

## 6.3 Cadastro público

10. `/participar` deve substituir `/`, ser um alias ou coexistir como rota principal mantendo `/`?
11. Idade é obrigatória? Qual é o intervalo aceito? O projeto aceitará menores de 18 anos?
12. “Participação na eleição anterior” se refere a qual eleição e quais opções devem existir: Sim, Não e Prefiro não informar?
13. O campo atual `problema` representa a categoria. A nova modelagem deve ter categoria obrigatória mais descrição opcional, ou também um terceiro campo de problema principal?
14. Quando o telefone já existir, quais campos podem ser atualizados pelo formulário público?
15. Uma segunda submissão pode criar novos consentimentos ou isso exige um fluxo explícito de atualização/validação da pessoa?
16. A mensagem sugerida de sucesso deve substituir oficialmente a mensagem atual?

## 6.4 Origens e QR Codes

17. Quais origens iniciais devem ser cadastradas e qual será o slug padrão?
18. Quais tipos de origem são definitivos?
19. Quem pode criar, editar, ativar ou desativar origens?
20. A geração de QR Code deve produzir uma imagem para download ou apenas preparar/copiar o link rastreável?

## 6.5 Usuários e cadastro manual

21. Quais perfis existirão? Sugestões como administrador e operador não podem ser adotadas sem aprovação.
22. Qual perfil pode cadastrar manualmente, importar, gerenciar origens, tratar exclusões e criar campanhas?
23. Em duplicidade no cadastro manual, o usuário poderá atualizar o contato ou apenas abrir o registro existente?
24. Quais meios de coleta manual serão permitidos e registrados?

## 6.6 Importação

25. Qual é o tamanho máximo de arquivo e o número máximo de linhas?
26. Quais extensões exatas serão aceitas: `.csv`, `.xlsx` e também `.xls`?
27. Em contato existente, a importação deve ignorar, atualizar campos específicos ou apenas apontar a duplicidade no relatório?
28. Arquivos temporários devem ser descartados após o processamento ou preservados de forma controlada para auditoria?
29. O nome da lista é apenas metadado da importação ou também cria uma entidade reutilizável?

## 6.7 Status, interrupção e exclusão

30. Quais status da lista sugerida são oficiais e quais transições serão permitidas?
31. “Parar todas as mensagens” também bloqueia ligações ou somente campanhas de mensagem?
32. Qual canal real será divulgado para correção, revogação e exclusão?
33. Quais campos podem ser anonimizados e quais registros devem permanecer por auditoria?
34. Quem pode concluir ou recusar uma solicitação de exclusão?

## 6.8 Campanhas

35. Qual consentimento será exigido para campanhas de pesquisa?
36. Qual consentimento será exigido para campanhas institucionais?
37. Quais status de campanha são oficiais?
38. Quais campos jurídicos/configuráveis devem existir antes de criar uma campanha política?

## 6.9 ManyChat

39. “Preparar endpoints” significa implementar rotas desativadas ou apenas documentar contratos nesta primeira etapa?
40. Qual header e formato de segredo serão usados na autenticação futura?
41. Qual feature flag deve controlar a integração?
42. Quais dos seis endpoints sugeridos serão realmente adotados?
43. Um evento ManyChat poderá criar contato automaticamente ou somente atualizar contato já existente?

## 6.10 Testes e operação

44. Você autoriza adicionar um framework de testes ou prefere manter scripts Node simples?
45. Haverá um banco separado de testes?
46. Quais ambientes precisam ser documentados: apenas local ou também homologação e produção?

# Condição para iniciar implementação

A implementação deve permanecer parada até:

1. este diagnóstico ser revisado;
2. as dúvidas bloqueantes da fase escolhida serem respondidas;
3. a fase ser aprovada explicitamente;
4. o backup ser criado antes da primeira migration estrutural.

Depois disso, somente uma fase deverá ser executada por vez, com testes, README e `RELATORIO_IMPLEMENTACAO.md` atualizados ao final de cada fase.
