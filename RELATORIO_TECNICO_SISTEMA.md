# Relatório técnico — A Voz do Bairro

## 1. Resumo da etapa

Esta etapa tornou os consentimentos do formulário público auditáveis e passou a exibir seus três estados na listagem administrativa.

Foram preservados o banco existente, os contatos, os usuários, as rotas, o login, o cadastro público, os filtros e a paginação. A alteração de schema foi incremental e repetível. Nenhum commit foi criado.

Status geral: **implementado e testado**.

## 2. Estrutura encontrada antes das alterações

O projeto já possuía:

- backend Node.js, Express, CommonJS e PostgreSQL;
- arquitetura modular por funcionalidade;
- frontend React com Vite;
- cadastro público;
- login JWT;
- listagem administrativa protegida;
- filtros e paginação;
- banco PostgreSQL em uso.

O backend já seguia `Route -> Controller -> Service -> Model`. Essa arquitetura foi preservada.

## 3. Duas tabelas originais encontradas

A inspeção foi feita antes da primeira alteração de schema.

| Tabela | Registros encontrados |
| --- | ---: |
| `contatos` | 4 |
| `usuarios` | 1 |

Depois da migração e da limpeza dos testes, essas quantidades continuam iguais.

## 4. Colunas antigas de consentimento

A tabela `contatos` já possuía:

- `consentimento_armazenamento BOOLEAN NOT NULL`;
- `consentimento_mensagens BOOLEAN NOT NULL DEFAULT FALSE`;
- `consentimento_armazenamento_em TIMESTAMPTZ NOT NULL`;
- `consentimento_mensagens_em TIMESTAMPTZ`.

Os quatro contatos existentes tinham armazenamento e mensagens iguais a `true`. Esses campos foram preservados por compatibilidade; não foram removidos nem renomeados.

## 5. Migração criada

Arquivo:

```text
backend/database/migrations/003_consentimentos_publicos_e_listagem.sql
```

A migração:

- usa `BEGIN` e `COMMIT`;
- usa `ADD COLUMN IF NOT EXISTS`;
- usa `CREATE TABLE IF NOT EXISTS`;
- usa `CREATE INDEX IF NOT EXISTS`;
- não usa `DROP TABLE`;
- não usa `TRUNCATE`;
- não faz exclusão geral;
- pode ser executada novamente sem duplicar o histórico legado.

Comando:

```bash
cd backend
npm run banco:migrar
```

Status: **implementado, executado e testado em repetição**.

## 6. Tabelas alteradas

### `contatos`

Foram adicionadas, quando ausentes:

- `consentimento_tratamento_dados BOOLEAN`;
- `consentimento_whatsapp BOOLEAN`;
- `consentimento_ligacoes BOOLEAN`;
- `consentimentos_atualizados_em TIMESTAMPTZ`;
- `origem_atual VARCHAR(200)`;
- `status_contato VARCHAR(30)`;
- `bloqueado_para_mensagens BOOLEAN NOT NULL DEFAULT FALSE`;
- `excluido_logicamente BOOLEAN NOT NULL DEFAULT FALSE`;
- `atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`, somente se ausente.

Os três campos de consentimento atuais não possuem `DEFAULT FALSE` e aceitam `NULL`.

### `usuarios`

Não foi alterada.

## 7. Tabela `consentimentos`

A tabela nova registra:

- `id`;
- `contato_id`;
- `tipo`;
- `resposta` booleana obrigatória;
- `texto_apresentado`;
- `versao_texto`;
- `canal`;
- `origem_registro`;
- `registrado_por_usuario_id` opcional;
- `criado_em`;
- `revogado_em`;
- `ativo`.

Constraints limitam tipos, canais e origens válidas. Um índice parcial único permite somente um registro ativo por contato e tipo.

Tipos permitidos:

- `tratamento_dados`;
- `mensagens_whatsapp`;
- `ligacoes`.

Status: **implementado e testado**.

## 8. Arquivos criados

```text
backend/database/migrations/003_consentimentos_publicos_e_listagem.sql
backend/scripts/executarMigracoes.js
backend/scripts/testarConsentimentos.js
backend/src/config/textosConsentimento.js
backend/src/modules/contatos/consentimentoModel.js
frontend/src/data/textosConsentimento.js
frontend/public/favicon.svg
RELATORIO_TECNICO_SISTEMA.md
```

## 9. Arquivos modificados

```text
backend/package.json
backend/README.md
backend/src/modules/contatos/contatoModel.js
backend/src/modules/contatos/contatoService.js
frontend/README.md
frontend/index.html
frontend/src/components/CabecalhoAdministrativo.jsx
frontend/src/components/CampoSelecao.jsx
frontend/src/components/TabelaContatos.jsx
frontend/src/pages/ContatosAdministrativos.jsx
frontend/src/pages/FormularioPublico.jsx
frontend/src/pages/Login.jsx
frontend/src/services/contatoService.js
frontend/src/styles/administrativo.css
frontend/src/styles/formulario.css
```

As alterações de identificação em login e cabeçalho administrativo apenas alinham o nome visual com **A Voz do Bairro**.

## 10. Rotas alteradas

Nenhum nome de rota foi alterado e nenhuma rota existente foi removida.

| Rota | Alteração interna |
| --- | --- |
| `POST /api/publico/contatos` | Aceita os três nomes atuais, mantém aliases antigos e grava contato mais históricos em transação. |
| `GET /api/admin/contatos` | Passa a retornar os campos atuais e aceitar filtros de consentimento, origem e status. |
| `POST /api/autenticacao/login` | Sem alteração. |
| `GET /api/teste` | Sem alteração. |

## 11. Contrato atual do cadastro público

```json
{
  "nome": "Maria da Silva",
  "telefone": "(21) 99999-9999",
  "bairro": "Campo Grande",
  "problema": "Iluminação pública",
  "consentimentoTratamentoDados": true,
  "consentimentoWhatsapp": false,
  "consentimentoLigacoes": false
}
```

Regras:

- tratamento precisa existir, ser booleano e ser `true`;
- WhatsApp precisa existir e ser booleano;
- o frontend atual sempre envia ligações como booleano;
- clientes anteriores podem omitir ligações, recebendo `null` sem histórico inventado;
- strings que parecem booleanos são rejeitadas;
- telefone é normalizado e não pode ser duplicado;
- `consentimentoArmazenamento` e `consentimentoMensagens` continuam como aliases temporários;
- nomes novo e antigo conflitantes retornam `400`;
- sucesso retorna `201` com a mensagem já existente;
- duplicidade retorna `409` e não altera o contato anterior.

## 12. Contrato atual da listagem

`GET /api/admin/contatos` continua exigindo JWT e retorna:

```json
{
  "mensagem": "Contatos listados com sucesso.",
  "contatos": [
    {
      "id": "5",
      "nome": "Maria da Silva",
      "telefone": "(21) 99999-9999",
      "bairro": "Campo Grande",
      "problema": "Iluminação pública",
      "consentimentoArmazenamento": true,
      "consentimentoMensagens": false,
      "consentimentoTratamentoDados": true,
      "consentimentoWhatsapp": false,
      "consentimentoLigacoes": null,
      "origemAtual": "Formulário A Voz do Bairro",
      "statusContato": "ativo",
      "bloqueadoParaMensagens": true,
      "criadoEm": "2026-07-21T12:00:00.000Z"
    }
  ],
  "paginacao": {
    "paginaAtual": 1,
    "limite": 20,
    "totalRegistros": 1,
    "totalPaginas": 1
  }
}
```

Novos filtros:

- `consentimentoWhatsapp=true|false|null`;
- `consentimentoLigacoes=true|false|null`;
- `origem`;
- `status`.

Os filtros anteriores, o limite máximo de 100 e a paginação permanecem. A listagem e o `COUNT` usam o mesmo construtor de filtros.

## 13. Regra de Sim, Não e Não informado

| Valor | Significado | Exibição |
| --- | --- | --- |
| `true` | autorização expressa | Sim |
| `false` | opção apresentada e recusada | Não |
| `null` | não houve resposta documentada | Não informado |

O formulário público apresenta as três opções; por isso os opcionais desmarcados são `false`. Dados importados ou legados sem manifestação não devem ser convertidos para `false`.

## 14. Textos e versões

| Tipo | Versão | Situação |
| --- | --- | --- |
| Tratamento de dados | `tratamento_dados_v1` | Implementado e testado. |
| Mensagens pelo WhatsApp | `mensagens_whatsapp_v1` | Implementado e testado. |
| Ligações | `ligacoes_v1` | Implementado e testado. |

O backend centraliza os textos oficiais em `src/config/textosConsentimento.js` e grava essas constantes. Não confia em texto fornecido pelo navegador.

## 15. Tratamento dos dados antigos

O mapeamento executado foi:

- `consentimento_armazenamento` para `consentimento_tratamento_dados`;
- `consentimento_mensagens` para `consentimento_whatsapp`;
- ligações permaneceram `NULL`;
- origem recebeu `Cadastro legado`;
- status recebeu `ativo`;
- bloqueio foi calculado pela resposta antiga de mensagens.

Foram criados oito históricos para os quatro contatos: tratamento e WhatsApp por contato. Todos estão identificados com:

- canal `migracao`;
- origem `migracao_legado`;
- versão `legado_v1`;
- texto `Texto apresentado não registrado pelo sistema legado.`.

O relatório não afirma que o texto atual foi mostrado aos contatos antigos.

## 16. O que o sistema faz hoje

Status: **implementado e testado**.

- apresenta e envia três consentimentos separados;
- exige tratamento dos dados;
- permite recusa de WhatsApp e ligações;
- registra `true`, `false` e `null` sem confundi-los;
- grava texto oficial, versão, canal, origem e data/hora;
- usa transação no cadastro;
- bloqueia mensagens quando WhatsApp não é `true`;
- não sobrescreve consentimentos em telefone duplicado;
- lista estados atuais em camelCase;
- exibe Sim, Não e Não informado;
- filtra consentimentos pelos três estados;
- mantém login, JWT, filtros anteriores e paginação.

## 17. Limites atuais e canais externos

Status: **planejado e não implementado**.

- envio de mensagens, ligações ou campanhas;
- atualização ou revogação de consentimentos por rota;
- exclusão física automática;
- detalhe administrativo com histórico;
- importação, exportação e cadastro manual;
- relatórios gráficos;
- sorteios ou brindes;
- integração com redes sociais;
- canal real para solicitações dos titulares.

API direta da Meta/WhatsApp, WhatsApp Web, chatbox próprio e automação própria de mensagens foram retirados do planejamento. O ManyChat poderá ser contratado futuramente somente como canal adicional de automação e coleta pelo WhatsApp. O sistema A Voz do Bairro continuará sendo a fonte oficial dos dados e deverá funcionar sem essa contratação.

## 18. Testes realizados

Foram executados:

```bash
cd backend
npm run banco:migrar
npm run banco:migrar
npm run testar:consentimentos
```

O teste integrado cobre:

- inicialização da aplicação;
- conexão PostgreSQL pela rota de teste;
- rota administrativa sem token;
- rota inexistente;
- cadastros com opcionais `true` e `false`;
- ligações `true` e `false`;
- aliases antigos e ligação não informada;
- tratamento falso e ausente;
- tipos inválidos;
- telefone duplicado;
- criação dos históricos;
- rollback transacional;
- contato semelhante a importação com valores `null`;
- constraints;
- listagem camelCase sem campos internos;
- filtros de consentimento `true`, `false` e `null`;
- filtros combinados e paginação;
- limpeza dos registros temporários.

No frontend, o preview também foi aberto pelo Microsoft Edge em modo headless com viewport emulada de 375 x 1200. Foram inspecionados largura interna, largura rolável, elementos excedentes e erros do console.

Em servidores isolados, o navegador executou ainda o tratamento obrigatório, cadastros com os opcionais desmarcados e marcados, duplicidade e a leitura dos três estados na tabela. Os contatos temporários foram removidos ao final.

Também são verificados o build do frontend, a sintaxe de todos os arquivos JavaScript, a inexistência de arrow functions e a integridade textual do diff.

## 19. Resultados dos testes

| Grupo | Resultado |
| --- | --- |
| Migração | Aprovada em duas execuções consecutivas. |
| Banco | Tabelas antigas e dados preservados. |
| Cadastro `true/true/true` | Aprovado com três históricos versionados. |
| Cadastro `true/false/false` | Aprovado com bloqueio para mensagens. |
| Tratamento ausente ou falso | Rejeitado com `400`. |
| Tipos inválidos | Rejeitados com `400`. |
| Duplicidade | Rejeitada com `409`, sem sobrescrita. |
| Transação | Falha de histórico reverteu o contato. |
| `true`, `false`, `null` | Persistência, retorno e filtros aprovados. |
| Constraints | `23502`, `23514` e `23505` observados como esperado. |
| JWT obrigatório | Listagem sem token retornou `401`. |
| Rota inexistente | Retornou `404`. |
| Limpeza | Banco voltou a 4 contatos, 1 usuário e 8 históricos. |
| Build do frontend | Aprovado com 47 módulos transformados. |
| Responsividade em 375 px | Sem overflow horizontal ou elementos excedentes. |
| Console da página pública | Nenhum erro. |
| Frontend com opcionais desmarcados | Cadastro real aprovado. |
| Frontend com opcionais marcados | Cadastro real aprovado. |
| Erro de duplicidade no frontend | Mensagem apresentada corretamente. |
| Tabela administrativa real | Sim, Não e Não informado aprovados. |

Os resultados finais de build e verificações estáticas constam também nos READMEs.

## 20. Erros encontrados

1. Os campos antigos não distinguiam recusa de ausência de informação para todos os canais.
2. Não existia tabela de histórico auditável.
3. O frontend tinha apenas dois consentimentos e usava nomes antigos.
4. A listagem não mostrava tratamento atual, ligações, origem e status.
5. Os filtros não distinguiam `false` de `null`.
6. A especificação pedia canal `migracao` para legado, mas esse valor não aparecia na lista inicial de canais permitidos.
7. O rótulo inicial da versão migrada estava diferente do `legado_v1` determinado na especificação.
8. O HTML ainda usava o título antigo `Coleta Cidadã` e não tinha favicon, gerando recurso `404` no navegador.

## 21. Erros corrigidos

1. Foram criados campos atuais nullable para os três estados.
2. Foi criada a tabela histórica e a transação de cadastro.
3. O formulário passou a usar os três nomes atuais e os três textos.
4. A listagem passou a retornar e exibir todos os campos solicitados.
5. Os filtros usam igualdade para booleanos e `IS NULL` para não informado.
6. `migracao` foi incluído explicitamente nos canais válidos para identificar os dados antigos com honestidade.
7. Os históricos migrados foram normalizados para `legado_v1`, mantendo a observação de que o texto antigo não foi registrado.
8. Título, descrição e favicon foram alinhados à identidade **A Voz do Bairro**; a nova auditoria terminou sem erros no console.

## 22. Pendências

Classificação consolidada da entrega:

| Classificação | Itens |
| --- | --- |
| Implementado e testado | Migração, cadastro transacional, histórico, três consentimentos públicos, bloqueio, listagem, filtros, tabela e responsividade. |
| Implementado, mas não testado | Nenhuma funcionalidade nova foi deixada nesta condição. |
| Preparado no banco | Revogação, autoria do registro, exclusão lógica, origem e status. |
| Preparado apenas na arquitetura | Model de histórico, constantes versionadas e aliases de transição. |
| Planejado e não implementado | Detalhe, revogação por API, importação, cadastro manual e canal dos titulares. |

### Preparado no banco

- consentimento de ligações;
- três estados de consentimento;
- revogação e registros inativos;
- usuário responsável pelo registro;
- origem, status, bloqueio e exclusão lógica.

### Preparado apenas na arquitetura

- `consentimentoModel` separado para persistência do histórico;
- constantes versionadas;
- aliases temporários para transição dos clientes antigos.

### Planejado e não implementado

- endpoint de atualização/revogação;
- fluxo de exclusão lógica solicitado pelo titular;
- cadastro manual tri-state;
- importação sem manifestação;
- detalhe e histórico na interface;
- canal de contato para direitos LGPD;
- envio de mensagens.

## 23. Variáveis de ambiente

Backend, sem valores secretos:

- `PORTA`;
- `DATABASE_URL` ou o conjunto `BANCO_HOST`, `BANCO_PORTA`, `BANCO_USUARIO`, `BANCO_SENHA`, `BANCO_NOME`;
- `FRONTEND_URL`;
- `JWT_SECRET`;
- `JWT_TEMPO_EXPIRACAO`.

Frontend:

- `VITE_API_URL`.

Nenhum valor do `.env` foi incluído neste relatório.

## 24. Como executar

Backend:

```bash
cd backend
npm install
npm run banco:migrar
npm start
```

Frontend, em outro terminal:

```bash
cd frontend
npm install
npm run dev -- --host localhost --port 5173 --strictPort
```

Acessos padrão:

- formulário: `http://localhost:5173`;
- login: `http://localhost:5173/login`;
- área administrativa: `http://localhost:5173/admin/contatos`;
- API: `http://localhost:3000`.

Teste automatizado:

```bash
cd backend
npm run testar:consentimentos
```

## 25. Próxima etapa recomendada

Definir um canal real para solicitações dos titulares e, depois de aprovação específica, implementar o fluxo administrativo de atualização e revogação de consentimentos.

Essa próxima etapa deve:

- gerar um novo histórico em vez de alterar o anterior;
- desativar o registro ativo anterior;
- atualizar o campo rápido no contato;
- recalcular o bloqueio de mensagens;
- registrar usuário e data/hora;
- nunca excluir fisicamente o histórico.

Não iniciar essa etapa sem revisão e autorização.
