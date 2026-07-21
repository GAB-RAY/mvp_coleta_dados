# Frontend — A Voz do Bairro

Interface React do MVP de participação cidadã. Permite enviar demandas pelo formulário público, entrar na área administrativa e consultar contatos reais do backend. Não há dados simulados.

## Tecnologias

- React 19 e React DOM;
- React Router DOM;
- Vite;
- JavaScript;
- Fetch nativo;
- CSS tradicional;
- `localStorage` somente para o JWT administrativo.

Não são usados TypeScript, Axios, Redux, Tailwind ou biblioteca visual externa.

## Funcionalidades

### Formulário público

A rota `/` apresenta o projeto **A VOZ DO BAIRRO**, identifica Diogo Ventura como responsável pela iniciativa e pelo tratamento dos dados e mantém o formulário em uma coluna.

Campos:

- nome completo;
- telefone ou WhatsApp;
- bairro;
- principal necessidade;
- consentimento obrigatório para tratamento dos dados;
- consentimento opcional para mensagens pelo WhatsApp;
- consentimento opcional para ligações.

Todos os checkboxes são controlados pelo React, começam desmarcados e voltam a ficar desmarcados depois de um cadastro bem-sucedido. Nenhum consentimento é presumido.

O formulário:

- bloqueia envio sem o tratamento dos dados;
- permite envio com WhatsApp e ligações desmarcados;
- envia os opcionais desmarcados como `false`, pois as opções foram apresentadas;
- desabilita campos e botão durante a requisição;
- mostra `Enviando...` durante o envio;
- não recarrega a página;
- apresenta sucesso e erros da API na própria tela;
- limpa os dados depois do sucesso;
- informa o direito de solicitar correção, exclusão e revogação.

#### Validações no navegador

- nome obrigatório com no mínimo 2 caracteres;
- telefone obrigatório com 10 a 15 dígitos;
- bairro precisa ser pesquisado e confirmado no catálogo;
- principal necessidade precisa ser selecionada;
- tratamento dos dados precisa ser autorizado.

O backend continua sendo a validação definitiva.

#### Bairros

O catálogo em `src/data/opcoesFormulario.js` possui 166 bairros do município do Rio de Janeiro. A fonte usada foi a [camada Limite de Bairros da Prefeitura do Rio](https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Cartografia/Limites_administrativos/FeatureServer/4).

O campo:

- pesquisa sem diferenciar acentos ou maiúsculas;
- mostra até 8 sugestões;
- aceita mouse e teclado;
- responde a seta para baixo, seta para cima, Enter e Escape;
- exige seleção de um valor do catálogo;
- não envia texto livre não confirmado.

Ao digitar `vila kennedy`, por exemplo, a pessoa pode selecionar `Vila Kennedy`.

#### Categorias de problema

O problema é uma seleção fechada, não um texto livre:

- Saneamento básico;
- Saúde;
- Educação;
- Segurança pública;
- Iluminação pública;
- Limpeza urbana e coleta de lixo;
- Pavimentação e buracos;
- Transporte e mobilidade;
- Enchentes e drenagem;
- Moradia;
- Áreas de lazer e esporte;
- Assistência social;
- Meio ambiente;
- Outro.

#### Consentimentos apresentados

Os textos ficam centralizados em `src/data/textosConsentimento.js`.

Tratamento dos dados, obrigatório:

> Li o aviso de privacidade e autorizo o armazenamento e o tratamento dos dados informados neste formulário para o registro da minha participação e para a análise das demandas apresentadas pelos moradores.

Mensagens pelo WhatsApp, opcional:

> Autorizo o recebimento de futuras mensagens pelo WhatsApp sobre ações sociais, projetos comunitários, pesquisas, conteúdos de cunho político, eventos e iniciativas relacionadas à melhoria dos bairros.

Ligações, opcional:

> Autorizo o recebimento de futuras ligações sobre ações sociais, projetos comunitários, pesquisas, conteúdos de cunho político, eventos e iniciativas relacionadas à melhoria dos bairros.

Payload atual:

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

O backend usa suas próprias constantes oficiais para gravar texto e versão no histórico; não depende do texto enviado pelo navegador.

#### Identidade e privacidade

- nome e símbolo simples do projeto no topo;
- subtítulo e apresentação curta;
- identificação de Diogo Ventura;
- Laranja Neon `#FF5C00` como cor principal do formulário;
- fundo pastel e formulário em uma coluna;
- uma seção curta de Aviso de Privacidade após o formulário;
- rodapé com o projeto e o responsável.

Não foi inventado email ou telefone para direitos dos titulares. Um canal real precisa ser definido antes da produção.

### Login administrativo

A rota `/login`:

- exige email e senha;
- desabilita o formulário durante a requisição;
- mostra `Entrando...`;
- salva o JWT apenas após resposta válida;
- redireciona para `/admin/contatos`;
- exibe mensagens da API sem detalhes técnicos;
- redireciona quem já possui token para a área administrativa.

### Área administrativa

A rota `/admin/contatos` usa a API real e possui:

- listagem e total de contatos;
- filtros por nome, telefone, bairro e problema;
- filtros de WhatsApp e ligações com Todos, Sim, Não e Não informado;
- filtros por origem e status;
- combinação de filtros;
- busca somente ao enviar o formulário;
- limpeza dos filtros;
- paginação de 20 registros;
- manutenção dos filtros ao trocar de página;
- estados de carregamento, vazio e erro;
- nova tentativa;
- logout.

#### Tabela administrativa

Colunas:

- Nome;
- WhatsApp;
- Bairro;
- Principal problema;
- Tratamento de dados;
- Mensagens no WhatsApp;
- Ligações;
- Origem;
- Status;
- Data de cadastro.

Os consentimentos sempre aparecem com texto:

- `true`: badge **Sim**;
- `false`: badge **Não**;
- `null` ou `undefined`: badge **Não informado**.

Telefone e data são formatados para leitura. A tabela não mostra `telefone_normalizado` nem campos internos. Em telas estreitas, há rolagem horizontal.

### Sessão expirada e logout

Uma resposta administrativa `401` remove o token, redireciona para `/login` e exibe:

```text
Sua sessão expirou. Faça login novamente.
```

O logout local remove o token e redireciona. O MVP não possui revogação de JWT no backend.

### Falhas e página inexistente

Falha de conexão mostra:

```text
Não foi possível conectar ao servidor. Tente novamente em alguns instantes.
```

Respostas sem JSON são tratadas sem quebrar a interface. Rotas desconhecidas exibem uma página 404 com retorno ao formulário.

## Rotas da interface

| Rota | Acesso | Função |
| --- | --- | --- |
| `/` | Público | Formulário. |
| `/login` | Público | Login administrativo. |
| `/admin` | Redirecionamento | Envia para `/admin/contatos`. |
| `/admin/contatos` | Protegido | Listagem, filtros e paginação. |
| `*` | Público | Página não encontrada. |

## APIs consumidas

| Método e endpoint | Uso |
| --- | --- |
| `POST /api/publico/contatos` | Cadastro público. |
| `POST /api/autenticacao/login` | Login. |
| `GET /api/admin/contatos` | Listagem protegida. |

O serviço compartilhado:

- lê a URL em `VITE_API_URL`;
- remove barras finais;
- envia JSON quando existe corpo;
- adiciona `Authorization: Bearer TOKEN` em chamadas protegidas;
- interpreta JSON com fallback seguro;
- utiliza a mensagem do backend nos erros;
- inclui `statusHttp` no erro;
- reconhece cancelamento por `AbortController`.

## Filtros administrativos enviados

O frontend usa `URLSearchParams` e inclui somente valores preenchidos:

- `nome`;
- `telefone`;
- `bairro`;
- `problema`;
- `consentimentoWhatsapp`;
- `consentimentoLigacoes`;
- `origem`;
- `status`;
- `pagina`;
- `limite`.

Exemplo:

```text
/api/admin/contatos?bairro=campo+grande&consentimentoWhatsapp=false&pagina=1&limite=20
```

## Token administrativo

O token usa a chave `tokenAdministrativo` no `localStorage`. O acesso fica centralizado em `src/utils/armazenamentoToken.js` por `salvarToken`, `obterToken` e `removerToken`.

O token não é impresso no console nem distribuído entre componentes.

## Estrutura

```text
frontend/
  public/
    favicon.svg
  src/
    components/
      CabecalhoAdministrativo.jsx
      CampoFormulario.jsx
      CampoSelecao.jsx
      CampoSelecaoPesquisavel.jsx
      Carregando.jsx
      MensagemRetorno.jsx
      Paginacao.jsx
      RotaProtegida.jsx
      TabelaContatos.jsx
    data/
      opcoesFormulario.js
      textosConsentimento.js
    pages/
      ContatosAdministrativos.jsx
      FormularioPublico.jsx
      Login.jsx
      PaginaNaoEncontrada.jsx
    services/
      api.js
      autenticacaoService.js
      contatoService.js
    styles/
      administrativo.css
      formulario.css
      global.css
      login.css
    utils/
      armazenamentoToken.js
      formatarTelefone.js
    App.jsx
    main.jsx
  .env.example
  index.html
  package.json
  vite.config.js
  README.md
```

## Instalação e ambiente

Requisito do Vite instalado: Node.js `^20.19.0` ou `>=22.12.0`.

```bash
npm install
```

Crie `.env` com:

```env
VITE_API_URL=http://localhost:3000
```

No backend, a origem precisa corresponder:

```env
FRONTEND_URL=http://localhost:5173
```

`localhost` e `127.0.0.1` são origens diferentes para CORS. Reinicie o Vite depois de alterar `.env`.

## Executar

```bash
npm run dev -- --host localhost --port 5173 --strictPort
```

Acesse `http://localhost:5173`.

Build e preview:

```bash
npm run build
npm run preview
```

O build fica em `dist/`.

## Fluxo manual completo

1. Inicie PostgreSQL e execute `npm run banco:migrar` no backend.
2. Inicie o backend com `npm start`.
3. Inicie o frontend na porta `5173`.
4. Abra `http://localhost:5173`.
5. Preencha os quatro campos e confirme o bairro na lista.
6. Marque o tratamento dos dados.
7. Escolha livremente WhatsApp e ligações; ambos podem ficar desmarcados.
8. Envie e confirme a mensagem de sucesso.
9. Abra `Acesso administrativo`.
10. Entre com um administrador criado pelo backend.
11. Confirme o contato, os três consentimentos, a origem, o status e a data.
12. Teste filtros, paginação, limpeza e logout.

## Acessibilidade e responsividade

- labels associadas aos controles;
- campos obrigatórios identificados;
- foco visível;
- mensagens com `role` e `aria-live`;
- combobox de bairros com ARIA e teclado;
- tabela identificada e navegável;
- paginação com `nav`;
- respeito a `prefers-reduced-motion`;
- formulário em uma coluna;
- botão em largura total no celular;
- quebras seguras nos textos longos de consentimento;
- filtros administrativos em 4, 2 ou 1 coluna conforme a largura;
- tabela com rolagem horizontal no celular.

## Verificações executadas

| Verificação | Resultado observado |
| --- | --- |
| Build de produção | Aprovado com Vite. |
| Preview da página pública | HTTP `200`. |
| Viewport de 375 px | Sem overflow: `innerWidth` e `scrollWidth` iguais a `375`. |
| Console da página pública | Nenhum erro. |
| Checkboxes iniciais | Três estados controlados começam em `false`. |
| Tratamento obrigatório | Fluxo real bloqueado no frontend quando desmarcado. |
| WhatsApp e ligações desmarcados | Cadastro real aprovado. |
| WhatsApp e ligações marcados | Cadastro real aprovado. |
| Telefone duplicado | Mensagem `409` apresentada na interface. |
| Payload | Três nomes atuais enviados separadamente. |
| Tabela com dados reais | Exibe Sim, Não e Não informado com texto. |
| Filtros | Oito filtros de negócio mais paginação. |
| Catálogo de bairros | 166 itens, sem duplicidade e com Vila Kennedy. |
| Catálogo de problemas | 14 categorias. |
| Arrow functions em `src` | Nenhuma encontrada. |
| TypeScript em `src` | Nenhum arquivo. |
| URL HTTP fixa em `src` | Nenhuma encontrada. |

## Limites atuais

O frontend não implementa:

- envio real de WhatsApp ou ligações;
- chat, campanhas ou webhook;
- atualização e revogação de consentimentos;
- detalhe e histórico do contato;
- importação, exportação ou cadastro manual;
- exclusão física;
- relatórios e gráficos;
- recuperação de senha;
- canal real para solicitações dos titulares;
- dados simulados.
