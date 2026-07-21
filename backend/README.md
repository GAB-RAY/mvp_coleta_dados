# Backend — A Voz do Bairro

API Node.js/Express do projeto A Voz do Bairro. O PostgreSQL `criar_banco` é a fonte oficial dos dados; não há integração com ManyChat, WhatsApp, Meta, SMS ou email.

## Tecnologias

- Node.js, Express 5 e CommonJS;
- PostgreSQL com `pg` e SQL parametrizado;
- bcrypt para senhas e jsonwebtoken para JWT;
- multer para upload em memória;
- ExcelJS para leitura de XLSX;
- sem TypeScript, ORM, Prisma ou Sequelize.

O código usa arquitetura modular por funcionalidade. O fluxo principal permanece `Route -> Controller -> Service -> Model -> PostgreSQL`.

## Instalação

Na pasta `backend`:

```bash
npm install
```

Copie `.env.example` para `.env`. É possível usar `DATABASE_URL`:

```env
PORTA=3000
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/criar_banco
FRONTEND_URL=http://localhost:5173
JWT_SECRET=uma_chave_secreta_grande
JWT_TEMPO_EXPIRACAO=8h
```

Ou as variáveis separadas `BANCO_HOST`, `BANCO_PORTA`, `BANCO_USUARIO`, `BANCO_SENHA` e `BANCO_NOME=criar_banco`. Os aliases existentes `JWT_SEGREDO` e `JWT_EXPIRACAO` também são aceitos.

Nunca versione o arquivo `.env`.

## Banco e migrations

O banco deve existir. Para executar somente migrations pendentes:

```bash
npm run banco:migrar
```

O runner:

- recusa banco diferente de `criar_banco` e schema diferente de `public`;
- usa advisory lock;
- executa cada arquivo em transação;
- registra nome, checksum SHA-256 e data em `schema_migrations`;
- aborta se uma migration executada for editada;
- nunca reaplica a migration `003`, registrada como baseline.

Ledger atual:

- `003_consentimentos_publicos_e_listagem.sql` — baseline;
- `004_criar_schema_migrations.sql`;
- `005_criar_origens_e_vincular_contatos.sql`;
- `006_adicionar_campos_publicos_contatos.sql`;
- `007_criar_historico_contatos.sql`;
- `008_privacidade_e_autorizacoes.sql`;
- `009_adicionar_origem_cadastro_manual.sql`;
- `010_criar_importacoes.sql`.

As tabelas originais `usuarios`, `contatos` e `consentimentos` foram preservadas. A migration `010` permite `NULL` em nome, bairro e categoria somente para suportar listas importadas com campos opcionais; os cadastros público e manual continuam exigindo esses campos no Service.

Estruturas adicionais:

- `schema_migrations`;
- `origens`;
- `historico_contatos`;
- `textos_formulario`;
- `aceites_privacidade`;
- `importacoes`;
- `importacao_linhas`.

Os oito registros legados `tratamento_dados` e `mensagens_whatsapp` não foram convertidos. O aceite do Aviso de Privacidade é registrado separadamente em `aceites_privacidade`. Autorizações novas usam `mensagens` e `ligacoes`, com estados `autorizado`, `recusado` e `revogado`; ausência de resposta é representada por nenhum evento, isto é, `nao_informado` na leitura.

Os textos provisórios ficam versionados em `textos_formulario` e são lidos do banco durante a transação. Eles não devem ser tratados como textos jurídicos definitivos.

## Executar

```bash
npm start
```

API padrão: `http://localhost:3000`.

## Criar administrador

```bash
npm run criar-admin -- "Administrador" "admin@email.com" "MinhaSenhaSegura"
```

O script normaliza o email, valida duplicidade e armazena somente o hash bcrypt.

## Rotas

| Método | Endpoint | Autenticação | Função |
| --- | --- | --- | --- |
| GET | `/api/teste` | Não | Valida API e PostgreSQL. |
| GET | `/api/publico/contatos/opcoes` | Não | Retorna o catálogo oficial de categorias. |
| POST | `/api/publico/contatos` | Não | Processa cadastro público. |
| POST | `/api/autenticacao/login` | Não | Valida bcrypt e retorna JWT. |
| GET | `/api/admin/contatos` | Bearer JWT | Lista, filtra, ordena e pagina. |
| POST | `/api/admin/contatos` | Bearer JWT | Cadastro manual ou atualização auditada. |
| GET | `/api/admin/contatos/:id` | Bearer JWT | Detalhes, origem, histórico, privacidade e autorizações. |
| GET | `/api/admin/origens` | Bearer JWT | Lista origens ativas. |
| POST | `/api/admin/importacoes/pre-visualizar` | Bearer JWT | Valida CSV/XLSX e cria pré-visualização. |
| POST | `/api/admin/importacoes/:id/confirmar` | Bearer JWT | Confirma a importação e retorna relatório. |
| GET | `/api/admin/relatorios/resumo` | Bearer JWT | Retorna agregações filtradas. |
| GET | `/api/admin/relatorios/exportar.csv` | Bearer JWT | Exporta contatos filtrados em CSV. |

### Cadastro público

```json
{
  "nome": "Maria da Silva",
  "telefone": "(21) 99999-9999",
  "idade": 35,
  "bairro": "Vila Kennedy",
  "problema": "Saúde",
  "descricaoProblema": "Descrição opcional",
  "participouEleicaoAnterior": "sim",
  "aceitePrivacidade": true,
  "autorizacaoMensagens": false,
  "autorizacaoLigacoes": false
}
```

Regras principais:

- idade obrigatória, inteira, de 16 a 120;
- telefone normalizado para 10 a 15 dígitos;
- categoria deve existir no catálogo central do backend;
- participação eleitoral aceita `sim`, `nao`, `prefiro_nao_informar` ou `null`;
- aceite de privacidade é obrigatório e não é consentimento de comunicação;
- checkboxes opcionais desmarcadas não criam evento de recusa;
- telefone existente não revela dados anteriores e não sobrescreve campos preenchidos;
- somente campos `NULL` ou vazios são complementados, com histórico;
- evento idêntico de privacidade ou autorização não é duplicado;
- contato, complementação, histórico, privacidade e autorizações são processados na mesma transação.

Resposta `201`:

```json
{
  "mensagem": "Cadastro realizado com sucesso. Obrigado por contribuir com o projeto A Voz do Bairro."
}
```

### Listagem administrativa

Parâmetros aceitos:

- `nome`, `telefone`, `bairro`, `problema`, `origem`, `status`;
- `idadeMinima`, `idadeMaxima`;
- `participouEleicaoAnterior`;
- `autorizacaoMensagens`, `autorizacaoLigacoes`;
- `dataInicial`, `dataFinal`;
- `ordenacao`: `mais_recentes`, `mais_antigos`, `nome_asc` ou `nome_desc`;
- `pagina` e `limite`, com limite máximo 100.

Os filtros legados `consentimentoWhatsapp` e `consentimentoLigacoes` continuam aceitos para compatibilidade. A API não retorna `telefone_normalizado` nem nomes em snake_case.

### Cadastro manual

Exige os campos do contato, `origemId` e `status`. `aceitePrivacidade` só é gravado quando expressamente verdadeiro. Mensagens e ligações aceitam `nao_informado`, `autorizado` ou `recusado`. Alterações em dados preenchidos registram valores anteriores, novos e o usuário responsável.

### Importação

O upload usa `multipart/form-data` com campos `arquivo` e `origem`:

- formatos `.csv` e `.xlsx`;
- máximo de 5 MB e 5000 linhas;
- telefone obrigatório; demais dados do contato opcionais;
- cabeçalhos aceitos incluem `telefone`, `nome`, `bairro`, `idade`, `categoria`, `descricao` e `eleicao`;
- a pré-visualização aponta linhas inválidas e duplicadas;
- a confirmação cria, complementa ou ignora sem sobrescrever;
- nenhum aceite ou autorização é presumido;
- o relatório retorna recebidos, criados, complementados, ignorados, duplicados, inválidos e erros por linha.

## Scripts e testes

| Comando | Resultado/uso |
| --- | --- |
| `npm test` | Executa toda a regressão integrada. |
| `npm run testar:fase1` | Banco oficial, ledger 003–010, constraints e legado. |
| `npm run testar:publico` | 22 verificações. |
| `npm run testar:admin` | 21 verificações. |
| `npm run testar:manual` | 16 verificações. |
| `npm run testar:importacoes` | 20 verificações CSV/XLSX. |
| `npm run testar:relatorios` | 15 verificações de agregação/CSV. |
| `npm audit` | 0 vulnerabilidades na validação final. |

Os testes usam a aplicação e o PostgreSQL reais, criam dados com telefones reservados para teste e os removem no `finally`.

## Limites desta entrega

Não existem envio de mensagens, campanhas, ManyChat, API do WhatsApp/Meta, webhook, SMS, email, chatbox ou automação. Estados `revogado` e fluxos de revogação permanecem preparados no banco, mas sem endpoint operacional nesta entrega.
