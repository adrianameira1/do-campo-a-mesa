
require('dotenv').config();

const mongoose = require('mongoose');

// Verificação sem criação automática de índices.
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

const modelos = [
  require('../models/User'),
  require('../models/Product'),
  require('../models/Order'),
  require('../models/Auction'),
  require('../models/Bid'),
  require('../models/Review')
];

async function verificarBD() {
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('\nBASE DE DADOS:', mongoose.connection.name);
  console.log('====================================');

  let problemas = 0;

  for (const Modelo of modelos) {
    const nome = Modelo.collection.name;

    const total = await Modelo.countDocuments();

    console.log(`\nColeção: ${nome}`);
    console.log(`Documentos: ${total}`);

    try {
      const indices = await Modelo.collection.indexes();

      console.log(`Índices existentes: ${indices.length}`);

      for (const indice of indices) {
        console.log(
          `  - ${indice.name}` +
          (indice.unique ? ' (UNIQUE)' : '')
        );
      }

      // Comparar os índices do Atlas com os do schema.
      // Não altera a base de dados.
      const diferencas = await Modelo.diffIndexes();

      if (diferencas.toCreate.length > 0) {
        console.log('ATENÇÃO: existem índices em falta!');
        console.log(diferencas.toCreate);
        problemas++;
      } else {
        console.log('Índices do modelo confirmados!');
      }

      if (diferencas.toDrop.length > 0) {
        console.log(
          'Nota: índices adicionais:',
          diferencas.toDrop
        );
      }

    } catch (erro) {
      console.log('Erro ao verificar coleção:', erro.message);
      problemas++;
    }
  }

  // Verificar as relações essenciais.
  console.log('\nVERIFICAÇÃO DAS RELAÇÕES');
  console.log('====================================');

  const [User, Product, Order, Auction, Bid, Review] =
    modelos;

  const [
    users,
    products,
    orders,
    auctions,
    bids,
    reviews
  ] = await Promise.all(
    modelos.map((Modelo) => Modelo.find().lean())
  );

  const ids = (docs) =>
    new Set(docs.map((doc) => String(doc._id)));

  const idsUsers = ids(users);
  const idsProducts = ids(products);
  const idsOrders = ids(orders);
  const idsAuctions = ids(auctions);

  const verificar = (id, conjunto, descricao) => {
    if (id && !conjunto.has(String(id))) {
      console.log('Referência inválida:', descricao);
      problemas++;
    }
  };

  for (const p of products) {
    verificar(p.produtor, idsUsers, 'Produto → Produtor');
  }

  for (const o of orders) {
    verificar(o.comprador, idsUsers, 'Encomenda → Comprador');
    verificar(o.produtor, idsUsers, 'Encomenda → Produtor');

    for (const linha of o.linhas || []) {
      verificar(
        linha.produto,
        idsProducts,
        'Encomenda → Produto'
      );
    }

    verificar(o.leilao, idsAuctions, 'Encomenda → Leilão');
  }

  for (const a of auctions) {
    verificar(a.produtor, idsUsers, 'Leilão → Produtor');
    verificar(a.produto, idsProducts, 'Leilão → Produto');
    verificar(a.encomenda, idsOrders, 'Leilão → Encomenda');

    verificar(
      a.licitacaoAtual?.comprador,
      idsUsers,
      'Leilão → Comprador'
    );
  }

  for (const b of bids) {
    verificar(b.leilao, idsAuctions, 'Licitação → Leilão');
    verificar(b.comprador, idsUsers, 'Licitação → Comprador');
  }

  for (const r of reviews) {
    verificar(r.autor, idsUsers, 'Avaliação → Autor');
    verificar(r.produtor, idsUsers, 'Avaliação → Produtor');
    verificar(r.produto, idsProducts, 'Avaliação → Produto');
    verificar(r.encomenda, idsOrders, 'Avaliação → Encomenda');
  }

  // Confirmar dados essenciais para autenticação.
  const administradores = await User.countDocuments({
    papel: 'admin'
  });

  const produtores = await User.countDocuments({
    papel: 'produtor'
  });

  const compradores = await User.countDocuments({
    papel: 'comprador'
  });

  console.log('\nUTILIZADORES');
  console.log('Administradores:', administradores);
  console.log('Produtores:', produtores);
  console.log('Compradores:', compradores);

  const semHash = await User.countDocuments({
    $or: [
      { passwordHash: { $exists: false } },
      { passwordHash: null },
      { passwordHash: '' }
    ]
  });

  if (semHash > 0 || administradores === 0) {
    console.log('ATENÇÃO: verificar credenciais e administradores.');
    problemas++;
  }

  console.log('\n====================================');

  if (problemas === 0) {
    console.log('Verificação concluída sem problemas detetados!');
  } else {
    console.log(`Verificação: ${problemas} problema(s).`);
    process.exitCode = 1;
  }
}

verificarBD()
  .catch((erro) => {
    console.error('Erro:', erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
