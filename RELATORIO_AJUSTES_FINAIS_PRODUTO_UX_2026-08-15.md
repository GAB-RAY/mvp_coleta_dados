# Relatório — Ajustes finais de produto e UX

**Projeto:** ACORDA RJ  
**Data:** 15 de agosto de 2026  
**Validação:** PostgreSQL local e temporário isolado, provider Meta fake e Microsoft Edge local  
**Produção, Meta real, deploy, commit e push:** não acessados ou realizados

## 1. Construtor de modelos

O administrador agora monta o modelo em uma sequência operacional: identificação,
conteúdo, cabeçalho e imagem, personalizações, rodapé, botões e prévia. É possível
salvar o rascunho, reabri-lo sem perder a ordem dos componentes e enviá-lo pelo
fluxo existente para análise oficial.

A interface distingue os três momentos:

- rascunho: criação e edição do conteúdo;
- em análise: acompanhamento, sem apresentar configuração de envio prematura;
- aprovado: configuração operacional de imagem, personalizações e botão SAIR,
  sem alterar o conteúdo aprovado pela Meta.

A Meta permanece como fonte de verdade. Nenhuma aprovação local foi criada.

## 2. Botões implementados

A interface oferece somente o subconjunto usado e suportado pelo ACORDA RJ:

- **Abrir link**, persistido como `URL`;
- **Ligar**, persistido como `PHONE_NUMBER`;
- **Não receber mais contatos**, persistido como `QUICK_REPLY` e associado
  explicitamente ao fluxo SAIR.

O administrador pode adicionar, remover e ordenar os botões. A ordem visual é a
mesma ordem preservada no componente oficial e usada posteriormente no índice do
envio. Um `QUICK_REPLY` comum não é transformado silenciosamente em opt-out.

## 3. Regras e limites

O backend valida antes da submissão:

- de um a três botões na área de botões;
- somente os três tipos expostos pelo sistema;
- no máximo dois botões de link ou ligação;
- no máximo um botão de ligação;
- no máximo um botão de opt-out;
- texto obrigatório;
- URL pública HTTPS;
- telefone obrigatório;
- exemplo e configuração quando a URL possui variável.

Esses limites formam o subconjunto conservador deliberadamente suportado pelo
ACORDA RJ; não são apresentados como uma enumeração universal de tudo que a Meta
possa oferecer. Não foram expostos Flow, catálogo, OTP ou outros componentes sem
uso validado no produto.

Os contratos foram confrontados com a coleção oficial da WhatsApp Business
Platform, inclusive os exemplos de dois botões de ação, dois botões de resposta
e envio de modelo interativo:

- https://www.postman.com/meta/whatsapp-business-platform/folder/lczy75a/templates
- https://www.postman.com/meta/whatsapp-business-platform/request/n3jhmr4/create-template-w-image-header-text-body-text-footer-and-2-call-to-action-buttons
- https://www.postman.com/meta/whatsapp-business-platform/request/uvx80vi/create-template-w-text-header-text-body-text-footer-and-2-quick-reply-buttons
- https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive

## 4. Persistência e SAIR

Os vários botões continuam armazenados em `meta_componentes` e suas associações
operacionais em `meta_configuracao_envio`, ambos já existentes. Nenhuma migration
foi necessária para modelos.

O botão **Não receber mais contatos** usa a posição real escolhida pelo
administrador. A configuração conserva `origem: opt_out`; o envio e o webhook
continuam usando `WHATSAPP_OPTOUT_BUTTON_ID`. O fluxo já validado de revogação
global, bloqueio de mensagens e ligações, histórico, inelegibilidade e
idempotência não foi modificado.

## 5. Prévia e UX

A prévia acompanha cabeçalho, imagem, BODY, valores de exemplo, rodapé e todos os
botões na ordem atual. Ela continua estritamente visual.

Na criação do BODY, o administrador pode posicionar o cursor e escolher **Nome
da pessoa**, **Bairro**, **Principal necessidade** ou **Outro texto**. A interface
insere automaticamente o próximo marcador posicional oficial (`{{1}}`, `{{2}}`
e seguintes), já associa seu significado e preenche um exemplo inicial. O
payload continua usando o contrato oficial da Meta; a descrição amigável existe
somente na interface.

A explicação de variáveis deixou de ficar escondida em um tópico expansível. Ela
agora permanece visível e informa diretamente:

- `{{1}}` é a primeira informação personalizada;
- `{{2}}` é a segunda informação personalizada;
- os próximos números seguem a mesma ordem;
- `{{1}} = Nome da pessoa` e `{{2}} = Bairro` resultam, por exemplo, em
  **“Olá, João! Seu bairro é Copacabana”**.

O campo **Texto principal** também não exige que o operador memorize ou digite
manualmente a sintaxe. A seção **Adicionar ao texto** insere o marcador na
posição atual do cursor. O formato `{{n}}` permanece visível para manter a
mensagem fiel ao modelo que será analisado, mas seu significado fica identificado
logo abaixo por linguagem operacional.

Termos como `QUICK_REPLY`, índice, payload, Media ID, `parameter_name`, Graph API
e `header_handle` não aparecem para o operador. Modelos aprovados com mídia por
ID mostram **Imagem da mensagem — Configurada**, com ações claras para trocar ou
remover; nenhuma URL temporária ou `blob:` é persistida.

## 6. Exclusão e arquivamento de campanhas

Somente administrador recebe e pode executar **Excluir campanha**. A rota também
é protegida no backend.

- sem lote, participação, tentativa ou comunicação: exclusão permanente;
- com histórico operacional: arquivamento transacional, preservando todos os
  registros;
- repetição do arquivamento: resultado idempotente;
- campanha arquivada: não aparece na listagem principal, pode ser consultada no
  filtro **Mostrar campanhas arquivadas** e não aceita alteração nem novo envio.

Locks, constraints e a barreira de criação de envio foram preservados.

## 7. Migration 017 e banco local

Foi necessária a migration incremental:

```text
017_arquivar_campanhas_com_historico.sql
```

Ela adiciona somente `arquivada_em`, `arquivada_por_usuario_id`, chave estrangeira
para o administrador responsável e índice de listagem. Não altera migration 016,
status de campanha nem registros existentes.

Após autorização explícita, a migration 017 foi aplicada pelo migrador normal
somente no PostgreSQL local. A estrutura local foi revalidada e os dados
artificiais do teste foram removidos. O banco publicado não foi acessado.

## 8. Como usar

A central foi atualizada depois da interface e agora descreve criação do modelo,
conteúdo, imagem, personalizações, vários botões, link, SAIR, prévia, análise,
aprovação, configuração do modelo aprovado, campanhas, aptos e não aptos, envio,
continuação, revogação global e exclusão/arquivamento.

## 9. Arquivos alterados

### Backend e banco

- `backend/database/migrations/017_arquivar_campanhas_com_historico.sql`;
- `backend/database/criar_banco.sql`;
- `backend/src/modules/campanhas/campanhaController.js`;
- `backend/src/modules/campanhas/campanhaModel.js`;
- `backend/src/modules/campanhas/campanhaRoutes.js`;
- `backend/src/modules/campanhas/campanhaService.js`;
- `backend/src/modules/campanhas/templateMetaService.js`;
- `backend/scripts/testarConstrutorBotoesModelos.js`;
- `backend/scripts/testarExclusaoArquivamentoCampanhas.js`;
- `backend/scripts/testarTemplatesMeta.js`;
- `backend/scripts/testarFluxoCampanhasMetaIsolado.js`;
- `backend/scripts/testarSchemaVazio.js`;
- `backend/scripts/testarEstruturaBanco.js`;
- `backend/scripts/testarJornadasE2E.js`;
- `backend/package.json`;
- `backend/README.md`.

### Frontend

- `frontend/src/pages/CampanhasAdministrativas.jsx`;
- `frontend/src/pages/AjudaAdministrativa.jsx`;
- `frontend/src/services/campanhaService.js`;
- `frontend/src/styles/administrativo.css`;
- `frontend/scripts/testarPreviaModeloMensagem.js`;
- `frontend/scripts/testarPreviaImagemRenderizada.js`.

## 10. Testes executados

```text
npm run testar:construtor-botoes
Construtor de botoes: 10 verificacoes aprovadas.

npm run testar:exclusao-campanhas
Exclusao e arquivamento de campanhas: 10 verificacoes aprovadas.

npm run testar:templates-meta
Templates oficiais da Meta: 42 verificações aprovadas.

npm run testar:fluxo-campanhas-meta
15 grupos aprovados; envio simplificado: 2.421 verificações aprovadas.

npm run testar:schema-vazio
31 tabelas, 166 bairros e 17 migrations validadas.

npm run testar:banco
Estrutura, catálogo e integridade: 25 verificações aprovadas.

npm run testar:previa-modelo
Prévia visual de modelos: 49 verificações aprovadas, incluindo a explicação e os atalhos oficiais de {{1}} e {{2}}.

npm run testar:previa-imagem-renderizada
Personalização assistida, imagem, persistência, múltiplos botões, ordenação, remoção, desktop e celular aprovados em Edge real.
```

Os testes de regressão incluíram modelo sem botão, URL, URL + SAIR, ordem real,
combinações rejeitadas antes do provider, rascunho reaberto, submissão fake,
modelo externo `APPROVED`, SAIR, status de webhook, campanha limpa, campanha com
histórico, permissão administrativa, ocultação de arquivada, desktop e celular.

## 11. Validação manual pelo usuário

Com backend, frontend e PostgreSQL locais, o usuário confirmou manualmente:

```text
escrever “Olá, ”
→ clicar em Nome da pessoa
→ sistema inserir {{1}} e associar Nome da pessoa
→ clicar em Bairro
→ sistema inserir {{2}} e associar Bairro
→ prévia resolver os exemplos corretamente
```

O teste manual foi concluído com sucesso. Essa evolução alterou somente a
experiência de criação, a prévia, a ajuda e os testes frontend. Não foram
alterados `metaCloudApiProvider.js`, `mensageriaService.js`, webhook, montagem do
payload de envio, BODY NAMED, HEADER IMAGE ou processamento do botão SAIR.

## 12. Build e integridade

```text
npm run build
72 módulos transformados; build aprovado.

node --check
Oito arquivos backend relevantes aprovados.

git diff --check
Aprovado.
```

## 13. Segurança e conclusão

- nenhuma chamada real à Meta;
- nenhum template real criado ou submetido;
- nenhuma mensagem real enviada;
- nenhum acesso ao banco de produção;
- nenhum secret ou variável de ambiente alterado;
- nenhum deploy, commit ou push;
- custo real zero.

**PRONTO PARA VALIDAÇÃO MANUAL LOCAL E, APÓS PUBLICAÇÃO CONTROLADA DA MIGRATION
017 E DO CÓDIGO, PARA O PRÓXIMO TESTE REAL AUTORIZADO.**
