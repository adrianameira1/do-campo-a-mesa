# Do Campo à Mesa

**Mercado digital de produtores locais com leilões em tempo real**  
Trabalho prático individual de **Desenvolvimento Web e Cloud** — Mestrado em Engenharia Informática, ESTG–IPVC (2026/2027).

O **Do Campo à Mesa** liga produtores agrícolas locais a compradores, permitindo consultar produtos, realizar encomendas, avaliar produtos e produtores e participar em leilões em direto. Inclui áreas distintas para visitantes, compradores, produtores e administradores.

## Aplicação publicada

| Serviço | Endereço |
|---|---|
| Aplicação web (React) | https://nice-smoke-032946d03.4.azurestaticapps.net |
| API REST (Express) | https://dcm-adriana-api.onrender.com/api |
| Documentação Swagger UI | https://dcm-adriana-api.onrender.com/api-docs |
| Verificação da API | https://dcm-adriana-api.onrender.com/api/health |

> **Nota:** a API está alojada num serviço Render gratuito, que pode demorar a responder ao primeiro pedido após um período de inatividade. As URLs devem permanecer acessíveis até à defesa do projeto.

## Funcionalidades principais

| Perfil | Funcionalidades |
|---|---|
| **Visitante** | Consultar o catálogo; pesquisar e filtrar produtos; consultar detalhes, produtores, avaliações e leilões; registar-se ou iniciar sessão. |
| **Comprador** | Gerir carrinho; criar e acompanhar encomendas; escolher levantamento ou entrega; licitar em leilões ativos; receber notificações; avaliar produtos e produtores após entrega. |
| **Produtor** | Gerir produtos, preços, stock e fotografias; editar os dados da exploração; gerir encomendas; criar e acompanhar leilões; consultar indicadores de atividade. |
| **Administrador** | Consultar estatísticas globais; aprovar ou rejeitar produtores; moderar avaliações denunciadas; ocultar ou restaurar produtos. |

Os leilões utilizam **Socket.io** para atualizar ofertas, participantes e estado em tempo real. O servidor valida as licitações e regista a licitação aceite e o respetivo histórico através de operações MongoDB transacionais. Quando um leilão termina com vencedor, o sistema cria uma encomenda associada ao lote.

## Arquitetura e tecnologias

```text
Navegador
    |
    | HTTPS (REST/JSON) e Socket.io
    v
React + Vite — Azure Static Web Apps
    |
    v
Node.js + Express + Socket.io — Render
    |                          |
    v                          v
MongoDB Atlas              Azure Blob Storage
(dados da aplicação)       (imagens dos produtos)
```

- **Frontend:** React 18, Vite 5, React Router 6, Bootstrap 5 e SASS, com abordagem *Mobile First* e breakpoints de **768, 1024 e 1280 px**.
- **Backend:** Node.js (20 ou superior), Express 4, API REST, Socket.io 4 e Swagger/OpenAPI 3.0.3.
- **Dados:** MongoDB Atlas e Mongoose; coleções para utilizadores, produtos, encomendas, leilões, licitações e avaliações.
- **Segurança:** autenticação JWT, passwords com hash bcrypt, autorização por papel e validações de dados no servidor.
- **Cloud:** frontend em Azure Static Web Apps, API em Render, base de dados no MongoDB Atlas e imagens em Azure Blob Storage.

A documentação detalhada das decisões de arquitetura, modelação e deployment encontra-se em [`docs/relatorio.md`](docs/relatorio.md) (relatório técnico do projeto).

## Organização do repositório

```text
do-campo-a-mesa/
├── api/
│   ├── openapi.yaml                 # Especificação OpenAPI
│   ├── src/
│   │   ├── app.js                  # Middleware, rotas e Swagger UI
│   │   ├── server.js               # HTTP, Socket.io e ciclo dos leilões
│   │   ├── config/                 # Ligação ao MongoDB
│   │   ├── middleware/             # Autenticação, autorização e erros
│   │   ├── models/                 # Modelos Mongoose
│   │   ├── routes/                 # Endpoints REST
│   │   ├── services/               # Licitações, encomendas, imagens, etc.
│   │   ├── sockets/                # Eventos Socket.io e salas
│   │   └── seed/                   # Dados de demonstração e verificações
│   ├── test/
│   │   ├── e2e.test.js             # API, concorrência e fecho do leilão
│   │   └── e2e-extra.test.js       # Permissões, stock, avaliações e estados
│   └── package.json
├── web/
│   ├── src/
│   │   ├── api/                    # Cliente HTTP
│   │   ├── components/             # Componentes reutilizáveis
│   │   ├── context/                # Sessão, carrinho e Socket.io
│   │   ├── hooks/                  # Hooks React reutilizáveis
│   │   ├── pages/                  # Páginas públicas e por perfil
│   │   ├── styles/                 # SASS e estilos responsivos
│   │   ├── App.jsx                 # Rotas da SPA
│   │   └── main.jsx                # Providers e arranque React
│   └── package.json
├── docs/
├── relatorio.md
└── imagens/
    ├── arquitetura.png
    ├── mongodb.png
    ├── catalogo-desktop.png
    ├── catalogo-mobile.png
    ├── swagger.png
    ├── testes.png
    ├── azure-deployment.png
    └── render-deployment.png
└── README.md
```

## Requisitos para execução local

- **Node.js 20 ou superior**, npm e Git.
- Acesso a uma instância MongoDB compatível com transações (por exemplo, MongoDB Atlas).
- Credenciais de acesso ao MongoDB e um segredo JWT definido pelo responsável pela instalação.
- Para **upload de imagens**, uma conta e um contentor Azure Blob Storage configurados.

### 1. Clonar e configurar a API

```bash
git clone https://github.com/adrianameira1/do-campo-a-mesa.git
cd do-campo-a-mesa/api
npm ci
cp .env.example .env
```

Editar `api/.env` de acordo com o exemplo incluído no repositório. As configurações usadas pelo backend incluem:

```dotenv
PORT=3000
MONGODB_URI=mongodb+srv://UTILIZADOR:PASSWORD@CLUSTER/BASE_DE_DADOS
JWT_SECRET=DEFINIR_UM_SEGREDO_FORTE
JWT_EXPIRES_IN=2h
CLIENT_URL=http://localhost:5173
# Para upload de imagens, configurar também as variáveis
# STORAGE_CONN e STORAGE_CONTAINER conforme o .env.example.
```

> Os valores acima são **apenas exemplos**, não credenciais reais. Não publicar `.env`, passwords, chaves de armazenamento nem tokens. Não executar scripts de *seed* numa base com dados que se pretendam conservar.

Iniciar a API:

```bash
npm run dev
```

A API fica, por defeito, em `http://localhost:3000`. A documentação local fica em `http://localhost:3000/api-docs` e o endpoint de diagnóstico em `http://localhost:3000/api/health`.

### 2. Instalar e iniciar a SPA

Noutro terminal:

```bash
cd do-campo-a-mesa/web
npm ci
cp .env.example .env
```

Para ligar ao backend local, usar no `web/.env`:

```dotenv
VITE_API_URL=http://localhost:3000
VITE_USAR_DADOS_SIMULADOS=false
```

Depois:

```bash
npm run dev
```

Abrir o endereço indicado pelo Vite (habitualmente `http://localhost:5173`). A configuração de produção do frontend está em `web/.env.production` e aponta para a API pública do Render.

### 3. Dados de demonstração (opcional)

```bash
cd api
npm run seed
```

**Atenção:** consultar previamente [`api/src/seed/seed.js`](api/src/seed/seed.js) para compreender que coleções são modificadas. Executar apenas numa base de dados descartável/de desenvolvimento; não executar em produção ou na base dos testes E2E.

## API REST e Swagger

A especificação [`api/openapi.yaml`](api/openapi.yaml) contém **37 operações REST documentadas**, incluindo autenticação, catálogo, produtores, encomendas, leilões, avaliações, administração e upload de imagens.

- **Swagger UI público:** https://dcm-adriana-api.onrender.com/api-docs
- **Health check:** `GET /api/health`
- **Produtos:** `GET /api/products`
- **Leilões:** `GET /api/auctions`
- **Autenticação:** `POST /api/auth/login` e `POST /api/auth/registo`

As rotas protegidas exigem `Authorization: Bearer <token>`, conforme documentado no esquema `bearerAuth` do OpenAPI.

A especificação foi validada com **Redocly CLI**, sem erros estruturais; subsistem quatro avisos não bloqueantes. Para repetir a validação:

```bash
npx --yes @redocly/cli@1 lint api/openapi.yaml
```

## Testes automatizados

Na pasta `api/`, executar:

```bash
npm test
```

O projeto inclui **17 testes automatizados E2E** da API e do Socket.io, usando o test runner do Node.js e `socket.io-client`. A última execução registada passou com **17 aprovados e 0 falhados**.

Os cenários incluem: autenticação e permissões; catálogo; reserva e insuficiência de stock; criação e progressão de encomendas; avaliações; aprovação administrativa; validação das licitações; concorrência entre dois compradores; rajada de dez licitações; e criação de uma única encomenda para o vencedor.

### Isolamento da base de testes

Antes de executar os testes, configurar no ficheiro local `api/.env` uma **URI exclusiva para testes**:

```dotenv
MONGODB_URI_TEST=mongodb+srv://UTILIZADOR:PASSWORD@CLUSTER/dcm_e2e_test?retryWrites=true&w=majority
```

O código dos testes verifica explicitamente o nome `dcm_e2e_test` e rejeita a mesma URI utilizada em `MONGODB_URI`. Os testes criam dados temporários e removem os documentos próprios. **Não apontar `MONGODB_URI_TEST` para a base de produção.**

## Notas de segurança e deployment

- As credenciais e cadeias de ligação pertencem às variáveis de ambiente dos serviços, nunca ao repositório.
- As variáveis `VITE_` da SPA são incorporadas na compilação e **não devem conter segredos**.
- As permissões são verificadas no backend, não apenas pelas rotas protegidas do React.
- A API gratuita no Render pode entrar em suspensão e demorar a reativar.
- O frontend e a API são serviços PaaS separados; o MongoDB Atlas é um serviço gerido e as imagens são guardadas em armazenamento de objetos na Cloud.

## Entrega e demonstração

O trabalho inclui código-fonte no GitHub, aplicação pública, Swagger UI, testes automatizados, relatório técnico (máximo de **20 páginas**) e vídeo demonstrativo (máximo de **5 minutos**). A defesa individual prevê apresentação e discussão do projeto.

A utilização de ferramentas e assistentes de IA deve ser declarada no relatório, conforme o enunciado da unidade curricular.
