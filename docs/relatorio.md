# Relatório · Do Campo à Mesa

> Máximo de 20 páginas. Apagar as notas entre parênteses retos antes da entrega.

## 1. Introdução

[Objetivo e âmbito do trabalho.]

## 2. Arquitetura

[Diagrama de componentes: SPA, API REST, servidor de sockets, MongoDB, storage e serviços Cloud.]

## 3. Frontend e SPA

[Framework escolhida e porquê; componentes; gestão de estado; routing; abordagem Mobile First e breakpoints.]

## 4. API REST e documentação

A aplicação disponibiliza uma API REST desenvolvida com Node.js e Express, responsável pela comunicação entre o frontend React e a base de dados MongoDB Atlas. A API encontra-se organizada por recursos, utilizando os métodos HTTP GET, POST, PUT, PATCH e DELETE, conforme as operações disponibilizadas.

Foram definidos endpoints para autenticação, produtos, produtores, encomendas, leilões, avaliações e administração, bem como um endpoint de verificação do estado da API. Os pedidos e respostas utilizam maioritariamente o formato JSON.

As operações seguem os códigos de estado HTTP adequados a cada situação, incluindo 200 (sucesso), 201 (criação), 204 (operação concluída sem conteúdo), 400 (pedido inválido), 401 (autenticação necessária), 403 (acesso não autorizado), 404 (recurso não encontrado) e 409 (conflito). As funcionalidades ainda não implementadas são identificadas através do código 501.

### 4.1. Documentação com OpenAPI e Swagger UI

A API foi documentada através de uma especificação OpenAPI 3.0.3, definida no ficheiro `api/openapi.yaml` e disponibilizada através do Swagger UI, no endereço `http://localhost:3000/api-docs/` durante a execução local.

A documentação abrange 28 operações REST, incluindo os parâmetros de pesquisa, estruturas dos pedidos e respostas, códigos HTTP, schemas reutilizáveis e requisitos de autenticação JWT. Os endpoints ainda não implementados são identificados explicitamente, de modo a distinguir as funcionalidades disponíveis das previstas para etapas posteriores.

A especificação foi submetida à validação com Redocly CLI, não tendo sido identificados erros estruturais. Permaneceram oito avisos associados a aspetos de documentação e funcionalidades ainda em desenvolvimento.

### 4.2. Testes realizados

O funcionamento da documentação foi confirmado através do Swagger UI, com a execução de pedidos reais à API.

Foi testada a consulta pública de produtos através de `GET /api/products`, obtendo-se uma resposta HTTP 200 com produtos armazenados no MongoDB Atlas. Foi também testada a consulta autenticada de encomendas através de `GET /api/orders`, utilizando um token JWT, com resposta HTTP 200.

Estes testes permitiram confirmar a disponibilidade da interface Swagger, a comunicação com a API Express e o funcionamento da autenticação JWT na consulta de recursos protegidos.

## 5. Modelo de dados

A aplicação *Do Campo à Mesa* utiliza MongoDB Atlas como sistema de gestão de base de dados NoSQL, com Mongoose para definir os esquemas, as relações e as validações dos documentos.

O modelo de dados está organizado em seis coleções principais: `users`, `products`, `orders`, `reviews`, `auctions` e `bids`. A modelação combina documentos embebidos (*embedding*) e referências entre coleções (*referencing*), de acordo com a forma como os dados são consultados e atualizados.

### 5.1. Coleções e relações

A coleção `users` armazena os utilizadores da plataforma, distinguindo compradores, produtores e administradores através do campo `papel`. Os dados específicos da exploração agrícola, como o nome, a descrição e a localização, são incorporados no documento do produtor.

A coleção `products` contém os produtos disponibilizados pelos produtores, incluindo nome, categoria, preço, stock, certificação biológica e épocas de disponibilidade. Cada produto referencia o respetivo produtor através de um identificador `ObjectId`.

A coleção `orders` guarda as encomendas efetuadas pelos compradores. Cada encomenda referencia o comprador e o produtor e contém uma lista de linhas embebidas, com o produto, nome, preço unitário e quantidade adquirida.

A coleção `reviews` armazena as avaliações dos compradores, incluindo a classificação, comentário, número de denúncias e estado de visibilidade. Cada avaliação referencia o autor e o produtor, podendo também estar associada a um produto e a uma encomenda.

A coleção `auctions` contém os leilões, com informações sobre o lote, preço base, incremento mínimo, datas de início e fim, estado e licitação atual. Cada leilão referencia o produtor e, quando aplicável, o produto associado.

Por fim, a coleção `bids` regista individualmente as licitações, mantendo referências ao leilão e ao comprador, bem como o valor e a data de criação.

### 5.2. Decisões de embedding e referencing

A estratégia de modelação foi definida tendo em conta os padrões de acesso aos dados, a consistência da informação e o crescimento das coleções.

Os dados específicos da exploração agrícola são embebidos no documento do utilizador, porque pertencem ao perfil do produtor e são normalmente consultados em conjunto.

Nas encomendas, as linhas são igualmente embebidas, permitindo obter toda a informação necessária numa única consulta. O nome e o preço unitário são copiados no momento da compra, preservando o histórico mesmo que os dados do produto sejam alterados posteriormente. O comprador e o produtor são mantidos como referências, evitando a duplicação dos respetivos perfis.

As avaliações foram mantidas numa coleção independente, em vez de serem incorporadas nos documentos dos produtos ou produtores. Esta decisão permite consultar, denunciar e moderar cada avaliação individualmente, facilita a criação de índices e evita o crescimento contínuo dos documentos associados.

As licitações também são armazenadas numa coleção própria, uma vez que um leilão pode receber um elevado número de propostas. Esta separação permite consultar o histórico de licitações sem aumentar continuamente o tamanho do documento do leilão.


Os produtos mantêm uma referência ao respetivo produtor, em vez de incorporarem os seus dados. Esta decisão evita a duplicação de informação, uma vez que um produtor pode disponibilizar vários produtos. Assim, alterações aos dados da exploração não exigem a atualização de todos os produtos associados.

Nos leilões, a licitação atual é embebida no documento do próprio leilão, permitindo validar e atualizar o valor da proposta de forma atómica. Esta abordagem é fundamental para garantir a consistência das licitações concorrentes. O histórico completo permanece numa coleção independente (`bids`), evitando o crescimento ilimitado do documento do leilão.

### 5.3. Índices e otimização das consultas

Foram definidos 12 índices adicionais nos modelos Mongoose, distribuídos pelas coleções de produtos, encomendas, avaliações, leilões e licitações.

Nos produtos, os índices permitem apoiar consultas por produtor, categoria, preço e data de criação. Nas encomendas, foram criados índices compostos para consultar o histórico de cada comprador e as encomendas recebidas por cada produtor, ordenadas por data.

Nas avaliações, os índices combinam o produtor ou produto com a visibilidade e a data de criação. Foi também criado um índice único composto pelos campos `autor` e `encomenda`, com um filtro parcial para documentos que possuem uma referência válida à encomenda. Este índice impede que o mesmo comprador registe mais do que uma avaliação para a mesma encomenda, reforçando a integridade dos dados.

Nos leilões, os índices apoiam a consulta por estado, produtor e data de início. Nas licitações, um índice composto permite consultar as propostas de um leilão por ordem cronológica decrescente, utilizando o identificador como critério adicional de ordenação.

A criação dos índices foi confirmada no MongoDB Atlas através do separador *Indexes*. A sua existência não garante que sejam utilizados em todas as consultas, uma vez que o MongoDB seleciona o plano de execução de acordo com os dados disponíveis e as características da pesquisa.


### 5.4. Validação e consistência dos dados

Os esquemas Mongoose incluem validações para impedir valores inválidos, como preços negativos, quantidades não inteiras nas encomendas, classificações fora do intervalo de 1 a 5 e números de denúncias negativos.

Na criação de encomendas, a API valida as quantidades solicitadas e utiliza transações MongoDB para atualizar o stock e criar as encomendas de forma consistente. As linhas preservam o preço e o nome dos produtos no momento da compra.

Foram realizados 17 testes de validação dos modelos `Order`, `Review`, `Auction` e `Bid`, todos concluídos com sucesso. Estes testes foram executados em memória através do Mongoose, sem inserir documentos na base de dados.

Adicionalmente, foi confirmada a consulta autenticada das encomendas através da API REST, verificando a compatibilidade dos dados existentes com os modelos atualizados.

Foram também realizados testes de integração à criação de encomendas e à atualização do stock através da API REST. Numa encomenda válida, confirmou-se a redução do stock de 10 para 7 unidades após a compra de três unidades, bem como a criação da encomenda no estado `pendente`.

Para verificar a consistência transacional, foi simulada uma encomenda com dois produtos, em que o primeiro tinha stock suficiente e o segundo não. A API rejeitou a operação com HTTP 409 (`Stock insuficiente`) e a consulta posterior ao MongoDB confirmou que os stocks permaneceram inalterados e que não foi criada nenhuma encomenda adicional. Este resultado demonstrou o funcionamento do rollback no cenário testado.

Foram ainda verificadas as transições sequenciais dos estados das encomendas, a rejeição de transições inválidas e a proteção contra alterações efetuadas por produtores não associados à encomenda.


### 5.5. Exemplos de consultas MongoDB

As consultas à base de dados são realizadas através do Mongoose, permitindo aplicar filtros e ordenações.

**Consulta de produtos por categoria e preço:**

```javascript
Product.find({
  categoria: 'Fruta',
  preco: { $lte: 5 }
}).sort({ preco: 1 });
```

Esta consulta seleciona produtos da categoria Fruta com preço até 5 €, ordenados por preço crescente.

**Consulta das encomendas de um comprador:**

```javascript
Order.find({
  comprador: compradorId
}).sort({ createdAt: -1 });
```

Permite consultar o histórico de encomendas de um comprador, apresentando primeiro as mais recentes.

**Consulta das avaliações visíveis de um produtor:**

```javascript
Review.find({
  produtor: produtorId,
  visivel: true
}).sort({ createdAt: -1 });
```

Esta consulta devolve as avaliações públicas de um produtor, ordenadas por data de criação decrescente.

Estes exemplos ilustram como os índices definidos podem apoiar as operações de consulta da aplicação.


## 6. Segurança

A autenticação utiliza JSON Web Tokens (JWT). No início de sessão, a API valida as credenciais e emite um token assinado, com prazo de validade configurável. Os endpoints protegidos exigem o cabeçalho `Authorization: Bearer <token>`.

As passwords são armazenadas no MongoDB sob a forma de hashes bcrypt, com custo 12, não sendo guardadas em texto simples nem devolvidas nas respostas. O registo público permite apenas contas de comprador e produtor; a criação de administradores através deste endpoint é impedida. Os produtores recém-registados ficam pendentes de aprovação administrativa.

A autorização utiliza controlo de acesso baseado em papéis (*Role-Based Access Control*). O middleware consulta o utilizador no MongoDB em cada pedido autenticado, utilizando o papel atual da conta em vez de confiar exclusivamente no papel incluído no JWT. As operações protegidas verificam igualmente a propriedade dos recursos, como produtos e encomendas.

A criação de produtos e leilões exige que o produtor esteja aprovado. Esta exigência foi também aplicada à edição e eliminação de produtos. A atualização de encomendas existentes mantém a verificação de que o produtor é o responsável pela encomenda.

Foram realizados testes de autenticação e autorização, incluindo tokens inválidos, ausência do esquema Bearer, credenciais incorretas, tentativas de acesso administrativo por compradores, registo de administradores e operações proibidas a produtores não aprovados.

No frontend, as sessões são mantidas no `localStorage`, o que permite conservar a autenticação após atualizar a página, mas exige especial atenção à prevenção de ataques XSS. Os carrinhos foram separados por identificador de utilizador, impedindo que contas diferentes no mesmo navegador partilhem os produtos adicionados.

A política CORS está configurada na API Express e no servidor Socket.io através da variável de ambiente `CLIENT_URL`. Apenas a origem configurada é autorizada nas respostas CORS, incluindo os pedidos de preflight `OPTIONS` com os métodos e cabeçalhos necessários. A aplicação exige que `CLIENT_URL` esteja definida no arranque, evitando o uso de um fallback permissivo para qualquer origem. Esta política foi validada com testes de origem autorizada, origem não autorizada e preflight.

As credenciais e os segredos de configuração devem ser mantidos em variáveis de ambiente, fora do código versionado. O HTTPS deve ser utilizado no deployment para proteger a comunicação e os tokens em trânsito.

## 7. Tempo real e consistência dos leilões

[Salas, eventos, presença; como garantir que duas licitações simultâneas não são ambas aceites.]

## 8. Deployment na Cloud

[Fornecedor e serviços usados; modelo IaaS/PaaS/BaaS de cada um; custos estimados; URLs públicos.]

## 9. Dificuldades e trabalho futuro

## 10. Declaração de uso de ferramentas

[Bibliotecas e assistentes de IA utilizados, e para quê.]