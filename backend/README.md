# Backend — Central de Comunicação

API do projeto **A Voz do Bairro**, construída com Node.js, Express, PostgreSQL, CommonJS e `pg`, sem ORM. A arquitetura é modular por funcionalidade e mantém o fluxo `Routes → Controller → Service → Model → PostgreSQL`.

## Funcionalidades

- cadastro público transacional com telefone normalizado, idade, bairro e categoria;
- catálogo persistido com os 166 bairros oficiais do município do Rio de Janeiro;
- validação e escrita canônica do bairro no cadastro público, manual e nas importações;
- aceite de privacidade separado das autorizações de comunicação;
- autorizações independentes para mensagens e ligações, nunca presumidas;
- tratamento seguro de telefone existente, sem revelar ou sobrescrever dados preenchidos;
- login JWT com bcrypt, auditoria, limite de tentativas e bloqueio temporário;
- perfis `administrador` e `operador`;
- gestão de usuários e perfis somente por administradores;
- redefinição administrativa da senha de operadores e de outros administradores;
- listagem, filtros, ordenação, paginação e detalhe de contatos;
- cadastro manual, edição e histórico por operador ou administrador;
- telefone e origem protegidos contra alteração na edição comum;
- importação CSV/XLSX com pré-visualização e confirmação;
- resumo administrativo e exportação CSV;
- revogação de mensagens, ligações ou ambas;
- motivo opcional da revogação com até 500 caracteres;
- registro de responsável, data e hora;
- pedido de exclusão sem apagamento imediato;
- bloqueio de mensagens, ligações e campanhas após pedido de exclusão.

O backend ainda não envia campanhas nem se comunica com o ManyChat.

## Tecnologias e dependências

| Dependência | Função |
| --- | --- |
| Node.js | Runtime do backend. |
| Express | API HTTP e rotas. |
| PostgreSQL | Persistência relacional. |
| `pg` | Pool e SQL parametrizado. |
| `bcrypt` | Hash e comparação de senhas. |
| `jsonwebtoken` | Emissão e validação do JWT. |
| `cors` | Restrição da origem do frontend. |
| `helmet` | Cabeçalhos HTTP de segurança. |
| `dotenv` | Variáveis locais de ambiente. |
| `multer` | Upload controlado de planilhas. |
| `exceljs` | Leitura de XLSX. |

Todo o código usa CommonJS, `require`, `module.exports` e funções tradicionais.

## Criar um banco novo

O nome oficial é `criar_banco`. O arquivo [database/criar_banco.sql](database/criar_banco.sql) contém toda a estrutura atual.

No PowerShell, dentro de `backend`:

```powershell
createdb criar_banco
psql --set ON_ERROR_STOP=1 --dbname criar_banco --file database/criar_banco.sql
```

O script deve ser executado **somente em banco vazio**. Ele recusa a execução ao encontrar tabelas do projeto.

- banco novo e vazio: executar `database/criar_banco.sql` uma única vez;
- banco já publicado ou com dados: nunca executar o script final;
- mudanças futuras: criar migrations incrementais novas, partindo desta versão.

As migrations antigas foram consolidadas e não fazem mais parte do fluxo principal. Não existe comando `banco:migrar` nesta versão.

## Configurar o ambiente

```powershell
npm install
Copy-Item .env.example .env
```

Conexão por variáveis separadas:

```env
PORTA=3000
BANCO_NOME=criar_banco
BANCO_HOST=localhost
BANCO_PORTA=5432
BANCO_USUARIO=postgres
BANCO_SENHA=SENHA_LOCAL
BANCO_SSL=false
BANCO_SSL_REJEITAR_NAO_AUTORIZADO=true
FRONTEND_URL=http://localhost:5173
JWT_SECRET=SEGREDO_GRANDE_E_ALEATORIO
JWT_TEMPO_EXPIRACAO=8h
```

Em ambiente gerenciado, `DATABASE_URL` pode substituir as variáveis `BANCO_*`. Para PostgreSQL com TLS, use a URL fornecida pelo provedor com `sslmode=require`. O `.env` contém segredos e permanece ignorado pelo Git.

As variáveis `MANYCHAT_API_TOKEN` e `MANYCHAT_WEBHOOK_SECRET` aparecem somente comentadas no exemplo: ainda não são usadas e deverão ficar no ambiente, nunca no banco.

## Primeiro administrador

Não existe senha padrão no SQL. Depois de criar o banco:

```powershell
npm run criar-admin -- "Administrador" "admin@email.com" "SenhaCom12OuMais"
```

A senha precisa ter pelo menos 12 caracteres e é salva somente como hash bcrypt. Depois do primeiro acesso, o administrador pode criar operadores e outros administradores pela interface.

## Iniciar e testar conexão

```powershell
npm start
```

Abra `http://localhost:3000/api/teste`. A resposta `200` confirma que a API iniciou e consultou o PostgreSQL.

## Permissões

- `operador`: contatos, edição, cadastro manual, importação, relatórios, revogações e pedidos de exclusão;
- `administrador`: todas as permissões do operador, gestão de usuários/perfis e redefinição da senha de outro usuário.

As rotas administrativas exigem JWT. As rotas de usuários também exigem o middleware de administrador.

## Rotas

| Método | Rota | Acesso | Função |
| --- | --- | --- | --- |
| GET | `/api/teste` | Público | Testa API e banco. |
| GET | `/api/publico/contatos/opcoes` | Público | Lista bairros ativos e categorias. |
| POST | `/api/publico/contatos` | Público | Cadastra ou complementa campos vazios. |
| POST | `/api/autenticacao/login` | Público | Retorna JWT e usuário. |
| GET | `/api/admin/contatos` | JWT | Lista e filtra contatos. |
| POST | `/api/admin/contatos` | JWT | Cadastra ou edita contato. |
| GET | `/api/admin/contatos/:id` | JWT | Retorna detalhes e históricos. |
| POST | `/api/admin/contatos/:id/revogar-consentimentos` | JWT | Revoga mensagens, ligações ou ambas. |
| POST | `/api/admin/contatos/:id/solicitacao-exclusao` | JWT | Registra pedido e bloqueios. |
| GET | `/api/admin/origens` | JWT | Lista origens ativas. |
| POST | `/api/admin/importacoes/pre-visualizar` | JWT | Valida CSV/XLSX. |
| POST | `/api/admin/importacoes/:id/confirmar` | JWT | Confirma importação. |
| GET | `/api/admin/relatorios/resumo` | JWT | Retorna agregações. |
| GET | `/api/admin/relatorios/exportar.csv` | JWT | Exporta CSV filtrado. |
| GET | `/api/admin/usuarios` | Administrador | Lista usuários. |
| POST | `/api/admin/usuarios` | Administrador | Cria operador ou administrador. |
| PATCH | `/api/admin/usuarios/:id/senha` | Administrador | Redefine a senha de outro usuário. |

Exemplo de revogação:

```json
{
  "tipo": "ambos",
  "motivo": "Solicitação feita pela própria pessoa."
}
```

`tipo` aceita `mensagens`, `ligacoes` ou `ambos`. A operação é idempotente.

Redefinição administrativa de senha:

```json
{
  "novaSenha": "NovaSenhaCom12OuMais"
}
```

Somente administradores acessam essa rota. Eles podem redefinir a senha de operadores e de outros administradores, mas não a própria senha por esse endpoint. A senha deve ter entre 12 caracteres e 72 bytes, é armazenada somente como hash bcrypt e nunca aparece na resposta. A redefinição também limpa bloqueios e tentativas de login do usuário-alvo.

## Estrutura do banco

O script cria 17 tabelas:

- operação atual: `usuarios`, `tentativas_login`, `bairros`, `contatos`, `consentimentos`, `aceites_privacidade`, `origens`, `historico_contatos`, `textos_formulario`, `importacoes` e `importacao_linhas`;
- preparação ManyChat: `campanhas`, `campanha_contatos`, `envios_campanha`, `respostas_campanha`, `eventos_manychat` e `sincronizacoes_manychat`.

Também cria índices, constraints, relacionamentos, a função de atualização automática, triggers de auditoria e validações de elegibilidade.

### Catálogo de bairros

`bairros` é a fonte única para os 166 bairros. A carga inicial usa a camada [Limite de Bairros da Prefeitura do Rio](https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Hosted/LimitedeBairroshosted/FeatureServer/0) e inclui **Argentino**, criado pela Lei Municipal nº 8.020/2025 como o 166º bairro. O nome atual usado para São Cristóvão segue a camada oficial.

`contatos.bairro` possui chave estrangeira para `bairros.nome`. A API aceita diferenças de maiúsculas, minúsculas e acentuação, mas grava sempre o nome canônico. Bairro inexistente retorna `400`; uma escrita direta inválida também é recusada pelo PostgreSQL. A mesma regra vale para formulário público, cadastro manual e bairros informados em CSV/XLSX. Importações continuam permitindo bairro vazio, mas nunca um bairro preenchido fora do catálogo.

### Base preparada para ManyChat

Já está pronto no banco:

- `manychat_contact_id` único e opcional no contato;
- campanhas e participação única por contato/campanha;
- tentativas, status, erros, entrega, leitura e resposta;
- respostas vinculadas ao contato e à campanha;
- evento externo com identificador único para rejeitar webhook duplicado;
- controle de sincronizações e tentativas;
- bloqueio de inclusão e de novo envio sem consentimento ativo;
- bloqueio após revogação ou pedido de exclusão;
- participação única que impede reinserir o mesmo fluxo após recusa ou conclusão.

Ainda depende da contratação e configuração do ManyChat:

- token e segredo de webhook;
- API de envio;
- endpoint de webhook e validação da assinatura;
- processamento de eventos e retentativas;
- mapeamento dos status reais oferecidos pelo plano contratado;
- telas e rotas de campanhas.

Nenhuma credencial do ManyChat é armazenada no PostgreSQL.

## Produção

Em um banco gerenciado novo e vazio, execute uma única vez:

```powershell
psql --set ON_ERROR_STOP=1 --dbname "SUA_DATABASE_URL" --file database/criar_banco.sql
```

Depois configure o backend, crie o primeiro administrador e teste `/api/teste`. Quando o sistema já possuir dados reais, faça backup antes de qualquer mudança e aplique apenas migrations incrementais novas. Nunca reaplique `criar_banco.sql`.

O passo a passo de DigitalOcean e Vercel está no [README principal](../README.md#publicação-passo-a-passo).

## Testes

```powershell
npm test
npm audit
```

`npm test` cobre estrutura do banco, catálogo e relacionamento de bairros, regras preparatórias do ManyChat, cadastro público, administração, edição, importação, relatórios, autenticação, perfis, revogações e exclusão.

Última execução: **233 verificações aprovadas**. O build do frontend e as auditorias são registrados no README principal.
