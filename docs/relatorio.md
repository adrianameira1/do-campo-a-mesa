# Relatório · Do Campo à Mesa

> Máximo de 20 páginas. Apagar as notas entre parênteses retos antes da entrega.

## 1. Introdução

[Objetivo e âmbito do trabalho.]

## 2. Arquitetura

[Diagrama de componentes: SPA, API REST, servidor de sockets, MongoDB, storage e serviços Cloud.]

## 3. Frontend e SPA

[Framework escolhida e porquê; componentes; gestão de estado; routing; abordagem Mobile First e breakpoints.]

## 4. API REST e documentação

[Recursos, verbos e códigos de estado; ligação para a Swagger UI.]

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

[JWT, papéis, hash de passwords, HTTPS, gestão de segredos.]

## 7. Tempo real e consistência dos leilões

[Salas, eventos, presença; como garantir que duas licitações simultâneas não são ambas aceites.]

## 8. Deployment na Cloud

[Fornecedor e serviços usados; modelo IaaS/PaaS/BaaS de cada um; custos estimados; URLs públicos.]

## 9. Dificuldades e trabalho futuro

## 10. Declaração de uso de ferramentas

[Bibliotecas e assistentes de IA utilizados, e para quê.]