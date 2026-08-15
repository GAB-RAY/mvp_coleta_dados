# Relatório — Log técnico seguro de erros da Meta

**Projeto:** ACORDA RJ  
**Data:** 15 de agosto de 2026  
**Escopo:** somente observabilidade do provider Meta Cloud API  
**Produção, deploy, commit e push:** não realizados

## 1. Onde a resposta era sanitizada

A resposta não-2xx da Graph API já era convertida em erro amigável por
`prepararErroMeta`, dentro de
`backend/src/modules/mensageria/metaCloudApiProvider.js`.

Esse comportamento protegia o frontend, mas descartava dos logs os campos
técnicos retornados pela Meta. O middleware registrava apenas a mensagem
amigável final:

```text
A Meta recusou a operação solicitada.
```

## 2. Onde o log foi adicionado

O evento técnico foi adicionado em `requisitarMeta`, imediatamente depois de a
chamada HTTP retornar uma resposta não-2xx e antes de criar o erro sanitizado.

O log só existe quando houve resposta HTTP real do endpoint da Meta. Erro de
validação local, credencial ausente no ambiente, timeout sem resposta e falha de
rede não são registrados como resposta recusada pela Meta.

Evento estruturado:

```text
erro_meta_cloud_api
```

## 3. Campos registrados

Quando fornecidos pela Meta, o JSON técnico contém somente:

- `nivel`;
- `evento`;
- `operacao`;
- `statusMeta`;
- `mensagemMeta`;
- `codigoMeta`;
- `subcodigoMeta`;
- `tipoMeta`;
- `detalhesMeta`;
- `produtoMeta`;
- `fbtraceId`.

Não são registrados URL completa, headers, payload, telefone destinatário ou
conteúdo da mensagem enviada.

## 4. Proteção de dados sensíveis

Antes da escrita, os textos técnicos passam por normalização, limite de tamanho
e remoção de:

- `Authorization` e qualquer valor `Bearer`;
- `WHATSAPP_ACCESS_TOKEN`;
- `META_APP_SECRET`;
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`;
- `DATABASE_URL`;
- `BANCO_SENHA` e `PGPASSWORD`;
- `JWT_SECRET`;
- e-mails;
- sequências compatíveis com telefone de 10 a 15 dígitos.

Os valores são substituídos por marcadores como `[CREDENCIAL_REMOVIDA]`,
`[EMAIL_REMOVIDO]` e `[TELEFONE_REMOVIDO]`. Nenhuma variável de ambiente ou
coleção de headers é serializada no log.

## 5. Mensagem apresentada ao usuário

O frontend continua recebendo somente:

```text
A Meta recusou a operação solicitada.
```

Os detalhes oficiais permanecem exclusivamente no log técnico. O payload, as
campanhas, lotes, templates, capacidade, reprocessamento, webhook e opt-out não
foram alterados.

## 6. Testes

Foi criado:

```text
backend/scripts/testarLogErroMeta.js
```

O mock retornou HTTP 400 com:

- `code = 132000`;
- `error_subcode = 2494010`;
- `type = OAuthException`;
- `error_data.details = detalhe de exemplo`;
- `error_data.messaging_product = whatsapp`;
- `fbtrace_id = TESTE123`.

O mesmo retorno fake incluiu deliberadamente `Authorization: Bearer`, token,
telefone e e-mail para provar a remoção.

Resultados:

```text
npm run testar:log-meta
Log seguro de erro Meta: 9 verificações aprovadas.

npm run testar:fluxo-campanhas-meta
11 grupos aprovados; nenhuma chamada real executada.
```

Também passaram:

- validação de sintaxe dos arquivos JavaScript afetados;
- regressão dos templates, campanhas, envio, reprocessamento e webhook;
- `git diff --check` sem erro de whitespace.

## 7. Arquivos desta correção

- `backend/src/modules/mensageria/metaCloudApiProvider.js`;
- `backend/scripts/testarLogErroMeta.js`;
- `backend/scripts/testarFluxoCampanhasMetaIsolado.js`;
- `backend/package.json`;
- `RELATORIO_LOG_TECNICO_SEGURO_META_2026-08-15.md`.

Nenhuma migration ou alteração de banco foi criada.

## Conclusão

**CONFIRMADO: O USUÁRIO RECEBE A MENSAGEM AMIGÁVEL, O LOG TÉCNICO PRESERVA OS
CAMPOS NECESSÁRIOS DA META E NENHUM TOKEN, AUTHORIZATION OU BEARER É
REGISTRADO.**

Não houve chamada real à Meta, envio real, deploy, commit ou push.
