# Relatório — Validação centralizada de templates externos APPROVED

**Projeto:** ACORDA RJ  
**Data:** 15 de agosto de 2026  
**Ambiente:** PostgreSQL temporário isolado e provider Meta fake  
**Produção, deploy, commit e push:** não realizados

## 1. Bloqueios antigos

O provider possuía validações independentes para corpo, cabeçalho, imagem e
botões. Elas geravam, em sequência, códigos como:

```text
TEMPLATE_META_INVALIDO
MIDIA_TEMPLATE_NAO_CONFIGURADA
BOTOES_TEMPLATE_NAO_CONFIGURADOS
```

O problema principal era considerar todo `QUICK_REPLY` parametrizado e exigir
configuração local de opt-out mesmo quando o botão sincronizado da Meta era uma
resposta rápida comum. O envio também não recebia `meta_origem`, portanto não
distinguia formalmente o modelo externo aprovado do modelo interno.

## 2. Centralização

A análise de prontidão foi centralizada em:

```text
backend/src/modules/mensageria/analisadorRequisitosTemplate.js
analisarRequisitosDeEnvio(template, configuracao, opcoes)
```

Ela retorna:

```json
{
  "validoParaEnvio": false,
  "pendencias": [
    {
      "tipo": "imagem_cabecalho",
      "mensagem": "Configure a imagem do cabeçalho."
    }
  ],
  "templateExternoAprovado": true
}
```

O provider consulta essa análise uma vez antes de montar o payload. Pendências
operacionais usam o código único `CONFIGURACAO_ENVIO_INCOMPLETA`, título
**Configuração necessária para o envio** e categoria
`configuracao_template`. Não são apresentadas como falha da Meta.

## 3. Requisitos por componente

- `HEADER IMAGE`: exige somente `image.id` ou `image.link` HTTPS.
- `HEADER TEXT` com variáveis: exige somente o mapeamento das posições usadas.
- `BODY` com variáveis: exige somente o mapeamento de `{{1}}`, `{{2}}` e
  seguintes realmente presentes.
- `BODY` ou `HEADER` sem variáveis: não cria configuração adicional.
- URL estática e telefone: não criam parâmetro de envio.
- URL dinâmica: exige somente o valor dinâmico do botão correspondente.

Os componentes oficiais sincronizados são agora a fonte para a montagem. Uma
configuração local antiga ou excedente não cria cabeçalho, corpo ou botão que
não exista em `meta_componentes`.

## 4. Botões e SAIR

Um `QUICK_REPLY` externo comum não cria pendência e não é convertido em
opt-out. Ele permanece definido pelo template oficial da Meta, sem parâmetro
local inventado.

O comportamento SAIR só é incluído quando o botão oficial naquele índice é
`QUICK_REPLY` e sua configuração local declara explicitamente:

```json
{
  "subtipo": "quick_reply",
  "origem": "opt_out"
}
```

Nesse caso, o payload recebe exclusivamente o identificador configurado em
`WHATSAPP_OPTOUT_BUTTON_ID`. O webhook e a revogação existentes não foram
alterados.

## 5. Templates externos e internos

Para `meta_origem = meta` e `meta_status_oficial = APPROVED`, o sistema usa
`meta_componentes` e exige apenas dados necessários ao payload. Não exige
`header_handle`, imagem de exemplo, submissão interna ou nova aprovação.

Para `meta_origem = interno`, continuam valendo as regras completas de criação
e configuração do ACORDA RJ. Um modelo interno com `QUICK_REPLY` sem a
configuração de SAIR permanece bloqueado. Template não aprovado também
permanece bloqueado sob a trava transacional já existente.

## 6. Payload fake equivalente ao template real

Foi testado um modelo externo `APPROVED` com `HEADER IMAGE`, `BODY` com
`{{1}}`, um `QUICK_REPLY` comum e um botão SAIR explicitamente configurado. O
provider fake recebeu os componentes equivalentes a:

```json
[
  {
    "type": "header",
    "parameters": [
      { "type": "image", "image": { "id": "media-id-real-equivalente" } }
    ]
  },
  {
    "type": "body",
    "parameters": [
      { "type": "text", "text": "Maria" }
    ]
  },
  {
    "type": "button",
    "sub_type": "quick_reply",
    "index": "1",
    "parameters": [
      { "type": "payload", "payload": "nao_quero_mais_receber" }
    ]
  }
]
```

O `QUICK_REPLY` comum do índice 0 não recebeu payload nem comportamento de
opt-out inventado.

## 7. Matriz e regressão

A matriz A–K foi coberta por `testarRequisitosEnvioTemplates.js`:

- texto externo aprovado;
- imagem ausente, por link e por Media ID;
- variável ausente e configurada;
- botão estático;
- `QUICK_REPLY` comum;
- SAIR real;
- interno incompleto;
- status não aprovado.

O cenário L permaneceu no teste integrado: falha anterior, correção da imagem,
nova tentativa e envio sem duplicar lote ou participação.

O teste integrado com PostgreSQL também passou a usar `HEADER IMAGE` com
`QUICK_REPLY` comum, reproduzindo o bloqueio real anterior de ponta a ponta.

## 8. Arquivos alterados

- `backend/src/modules/mensageria/analisadorRequisitosTemplate.js`;
- `backend/src/modules/mensageria/metaCloudApiProvider.js`;
- `backend/src/modules/mensageria/mensageriaService.js`;
- `backend/src/modules/mensageria/mensageriaModel.js`;
- `backend/scripts/testarRequisitosEnvioTemplates.js`;
- `backend/scripts/testarTemplatesExternosMeta.js`;
- `backend/scripts/testarTemplatesMeta.js`;
- `backend/scripts/testarIntegracaoMeta.js`;
- `backend/scripts/testarFluxoCampanhasMetaIsolado.js`;
- `backend/package.json`.

Nenhuma migration, tabela, campanha, capacidade, lote, lock, idempotência,
consentimento, opt-out, webhook, autenticação ou permissão foi alterada.

## 9. Testes e resultados

```text
npm run testar:requisitos-templates
22 verificações aprovadas; matriz A-K e template equivalente validados.

npm run testar:fluxo-campanhas-meta
10 grupos aprovados.
Templates externos da Meta: 22 verificações aprovadas.
Envio simplificado: 2.421 verificações aprovadas.

npm run build
72 módulos transformados; build aprovado.
```

Também foram aprovadas as verificações de sintaxe dos arquivos JavaScript
alterados, a conferência funcional do fluxo completo em banco temporário e
`git diff --check`, sem erro de whitespace.

## 10. Segurança e conclusão

- nenhuma chamada real à Meta;
- nenhum envio ou upload real;
- nenhum banco de produção acessado;
- nenhuma migration criada ou alterada;
- nenhum deploy, commit ou push;
- custo real zero.

**CONFIRMADO: TEMPLATE EXTERNO APPROVED COM IMAGEM CONFIGURADA E BOTÕES OFICIAIS
CHEGA AO PROVIDER FAKE SEM BLOQUEIOS INTERNOS INDEVIDOS.**
