
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Review = require('../models/Review');

const modelos = [User, Product, Order, Auction, Bid, Review];

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed de demonstração bloqueado em produção.');
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI não configurada no .env');
  }

  const nomeBD = decodeURIComponent(
    new URL(uri).pathname.replace(/^\//, '')
  );

  if (nomeBD !== 'do-campo-a-mesa') {
    throw new Error('A base de dados deve chamar-se do-campo-a-mesa');
  }

  await mongoose.connect(uri);

  console.log('MongoDB ligado:', mongoose.connection.name);

  // Criar as coleções e os índices definidos nos modelos.
  for (const Modelo of modelos) {
    await Modelo.init();
    await Modelo.createIndexes();
    console.log('Índices verificados:', Modelo.collection.name);
  }

  // Nunca apagar ou substituir dados já existentes.
  const contagens = await Promise.all(
    modelos.map((Modelo) => Modelo.countDocuments())
  );

  if (contagens.some((total) => total > 0)) {
    console.log('Já existem dados. Seed não executado.');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 12);
  const agora = Date.now();
  const minuto = 60 * 1000;

  // Transação: ou todos os dados são criados, ou nenhum.
  const sessao = await mongoose.startSession();

  try {
    await sessao.withTransaction(async () => {

      // 1. UTILIZADORES
      const [admin, horta, mel, tasca, ana] = await User.create([
        {
          nome: 'Administração',
          email: 'admin@exemplo.pt',
          passwordHash,
          papel: 'admin'
        },
        {
          nome: 'Horta da Ribeira',
          email: 'horta@exemplo.pt',
          passwordHash,
          papel: 'produtor',
          produtor: {
            nomeExploracao: 'Horta da Ribeira',
            descricao: 'Hortícolas e fruta de produção local.',
            localidade: 'Ponte de Lima',
            localizacao: { lat: 41.76744, lng: -8.58278 },
            validado: true
          }
        },
        {
          nome: 'Mel do Soajo',
          email: 'mel@exemplo.pt',
          passwordHash,
          papel: 'produtor',
          produtor: {
            nomeExploracao: 'Mel do Soajo',
            descricao: 'Mel da serra do Soajo.',
            localidade: 'Arcos de Valdevez',
            validado: true
          }
        },
        {
          nome: 'Tasca do Lima',
          email: 'tasca@exemplo.pt',
          passwordHash,
          papel: 'comprador'
        },
        {
          nome: 'Ana Ferreira',
          email: 'ana@exemplo.pt',
          passwordHash,
          papel: 'comprador'
        }
      ], { session: sessao, ordered: true });

      // 2. PRODUTOS
      const [kiwi, abobora, couve, melUrze, melCastanheiro] =
        await Product.create([
          {
            produtor: horta._id,
            nome: 'Kiwi Hayward',
            categoria: 'Fruta',
            preco: 2.40,
            unidade: 'kg',
            stock: 300,
            biologico: true,
            epocas: ['Outono', 'Inverno']
          },
          {
            produtor: horta._id,
            nome: 'Abóbora-menina',
            categoria: 'Hortícolas',
            preco: 1.20,
            unidade: 'kg',
            stock: 80,
            epocas: ['Outono']
          },
          {
            produtor: horta._id,
            nome: 'Couve-galega',
            categoria: 'Hortícolas',
            preco: 1.50,
            unidade: 'molho',
            stock: 40,
            biologico: true,
            epocas: ['Outono', 'Inverno']
          },
          {
            produtor: mel._id,
            nome: 'Mel de urze',
            categoria: 'Mel',
            preco: 7.50,
            unidade: '500 g',
            stock: 38
          },
          {
            produtor: mel._id,
            nome: 'Mel de castanheiro',
            categoria: 'Mel',
            preco: 7.00,
            unidade: '500 g',
            stock: 21
          }
        ], { session: sessao, ordered: true });

      // 3. ENCOMENDAS
      const [pedidoHorta, pedidoMel] = await Order.create([
        {
          comprador: tasca._id,
          produtor: horta._id,
          estado: 'entregue',
          linhas: [
            {
              produto: kiwi._id,
              nome: kiwi.nome,
              precoUnit: kiwi.preco,
              quantidade: 2
            },
            {
              produto: abobora._id,
              nome: abobora.nome,
              precoUnit: abobora.preco,
              quantidade: 1
            }
          ],
          entrega: { tipo: 'levantamento' }
        },
        {
          comprador: ana._id,
          produtor: mel._id,
          estado: 'entregue',
          linhas: [
            {
              produto: melUrze._id,
              nome: melUrze.nome,
              precoUnit: melUrze.preco,
              quantidade: 2
            }
          ],
          entrega: {
            tipo: 'entrega',
            morada: 'Rua de Exemplo, Ponte de Lima'
          }
        },
        {
          comprador: ana._id,
          produtor: horta._id,
          estado: 'pendente',
          linhas: [
            {
              produto: couve._id,
              nome: couve.nome,
              precoUnit: couve.preco,
              quantidade: 1
            }
          ],
          entrega: { tipo: 'levantamento' }
        }
      ], { session: sessao, ordered: true });

      // 4. AVALIAÇÕES
      await Review.create([
        {
          autor: tasca._id,
          produtor: horta._id,
          tipo: 'produtor',
          encomenda: pedidoHorta._id,
          classificacao: 5,
          comentario: 'Atendimento muito simpático.'
        },
        {
          autor: tasca._id,
          produtor: horta._id,
          tipo: 'produto',
          produto: kiwi._id,
          encomenda: pedidoHorta._id,
          classificacao: 5,
          comentario: 'Kiwis frescos e saborosos.'
        },
        {
          autor: ana._id,
          produtor: mel._id,
          tipo: 'produtor',
          encomenda: pedidoMel._id,
          classificacao: 4,
          comentario: 'Boa experiência de compra.'
        },
        {
          autor: ana._id,
          produtor: mel._id,
          tipo: 'produto',
          produto: melUrze._id,
          encomenda: pedidoMel._id,
          classificacao: 5,
          comentario: 'Mel excelente.'
        }
      ], { session: sessao, ordered: true });

      // 5. LEILÕES
      const [leilaoAtivo] = await Auction.create([
        {
          produtor: horta._id,
          produto: kiwi._id,
          lote: '200 kg de kiwi Hayward, calibre A',
          quantidade: '200 kg',
          precoBase: 200,
          incremento: 5,
          licitacaoAtual: {
            valor: 210,
            comprador: tasca._id,
            nome: tasca.nome,
            em: new Date(agora - 15000)
          },
          numLicitacoes: 2,
          iniciaEm: new Date(agora - minuto),
          terminaEm: new Date(agora + 30 * minuto),
          estado: 'ativo'
        },
        {
          produtor: mel._id,
          produto: melCastanheiro._id,
          lote: '20 frascos de mel de castanheiro',
          quantidade: '20 frascos',
          precoBase: 100,
          incremento: 5,
          licitacaoAtual: { valor: 100 },
          iniciaEm: new Date(agora + 60 * minuto),
          terminaEm: new Date(agora + 90 * minuto),
          estado: 'agendado'
        }
      ], { session: sessao, ordered: true });

      // 6. LICITAÇÕES
      await Bid.create([
        {
          leilao: leilaoAtivo._id,
          comprador: ana._id,
          nome: ana.nome,
          valor: 205
        },
        {
          leilao: leilaoAtivo._id,
          comprador: tasca._id,
          nome: tasca.nome,
          valor: 210
        }
      ], { session: sessao, ordered: true });

      console.log('Utilizador administrador:', admin.email);
    });

    console.log('Seed concluído com sucesso!');
    console.log('5 utilizadores');
    console.log('5 produtos');
    console.log('3 encomendas');
    console.log('4 avaliações');
    console.log('2 leilões');
    console.log('2 licitações');

  } finally {
    await sessao.endSession();
  }
}

seed()
  .catch((erro) => {
    console.error('Erro no seed:', erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
