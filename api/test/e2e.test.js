
require('dotenv').config();

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { io: clienteSocket } = require('socket.io-client');

const app = require('../src/app');
const registarSockets = require('../src/sockets');
const sincronizarLeiloes = require('../src/services/estadoLeiloes');

const User = require('../src/models/User');
const Auction = require('../src/models/Auction');
const Bid = require('../src/models/Bid');
const Order = require('../src/models/Order');

const NOME_BD = 'dcm_e2e_test';
const uri = process.env.MONGODB_URI_TEST;

if (!uri || !process.env.JWT_SECRET) {
  throw new Error('Configurar MONGODB_URI_TEST e JWT_SECRET');
}

if (
  decodeURIComponent(new URL(uri).pathname).replace(/^\//, '') !== NOME_BD ||
  uri === process.env.MONGODB_URI
) {
  throw new Error('Seguranca: URI de testes invalida');
}

let servidor;
let io;
let baseURL;
let socket1;
let socket2;
let leilaoId;
const utilizadores = [];

const esperar = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

async function esperarAte(condicao, limite = 10000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    if (await condicao()) return;
    await esperar(100);
  }
  throw new Error('Tempo limite excedido');
}

function ligarSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = clienteSocket(baseURL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
      autoConnect: false
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
    socket.connect();
  });
}

function entrar(socket, id) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Sem resposta ao entrar')),
      5000
    );
    socket.once('estado', estado => {
      clearTimeout(timer);
      resolve(estado);
    });
    socket.emit('entrar', id);
  });
}

before(async () => {
  await mongoose.connect(uri);

  if (mongoose.connection.name !== NOME_BD) {
    throw new Error('Ligacao fora da base de testes');
  }

  await Order.init();

  servidor = http.createServer(app);
  io = new Server(servidor, {
    cors: { origin: process.env.CLIENT_URL }
  });

  app.set('io', io);
  registarSockets(io);

  await new Promise(resolve =>
    servidor.listen(0, '127.0.0.1', resolve)
  );

  baseURL = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  socket1?.disconnect();
  socket2?.disconnect();

  // Eliminar apenas os documentos criados pelo teste.
  if (leilaoId) {
    await Bid.deleteMany({ leilao: leilaoId });
    await Order.deleteMany({ leilao: leilaoId });
    await Auction.deleteOne({ _id: leilaoId });
  }

  if (utilizadores.length) {
    await User.deleteMany({ _id: { $in: utilizadores } });
  }

  if (io) await new Promise(resolve => io.close(resolve));
  if (servidor?.listening) {
    await new Promise(resolve => servidor.close(resolve));
  }
  await mongoose.disconnect();
});

test('API responde ao health check', async () => {
  const resposta = await fetch(`${baseURL}/api/health`);
  assert.equal(resposta.status, 200);
  assert.equal((await resposta.json()).estado, 'ok');
});

test('Login incorreto devolve 401', async () => {
  const resposta = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'inexistente-e2e@example.invalid',
      password: 'PasswordErrada123'
    })
  });

  assert.equal(resposta.status, 401);
});

test('Duas licitacoes simultaneas nao podem ser ambas aceites',
  { timeout: 30000 },
  async () => {
    const marcador = new mongoose.Types.ObjectId().toString();
    const passwordHash = await bcrypt.hash('TesteSeguro123!', 10);

    const compradores = await User.create([
      {
        nome: 'Comprador E2E A',
        email: `e2e-a-${marcador}@example.invalid`,
        passwordHash,
        papel: 'comprador'
      },
      {
        nome: 'Comprador E2E B',
        email: `e2e-b-${marcador}@example.invalid`,
        passwordHash,
        papel: 'comprador'
      }
    ]);

    const produtor = await User.create({
      nome: 'Produtor E2E',
      email: `e2e-p-${marcador}@example.invalid`,
      passwordHash,
      papel: 'produtor',
      produtor: {
        nomeExploracao: 'Exploracao de Testes',
        localidade: 'Barcelos',
        validado: true
      }
    });

    utilizadores.push(
      ...compradores.map(c => c._id),
      produtor._id
    );

    const inicio = new Date(Date.now() - 10000);
    const fim = new Date(Date.now() + 60000);

    const leilao = await Auction.create({
      produtor: produtor._id,
      lote: `Lote E2E ${marcador}`,
      quantidade: '1 kg',
      precoBase: 100,
      incremento: 5,
      licitacaoAtual: { valor: 100 },
      iniciaEm: inicio,
      terminaEm: fim,
      estado: 'ativo'
    });

    leilaoId = leilao._id;

    const tokens = compradores.map(comprador =>
      jwt.sign(
        { id: comprador._id.toString(), papel: 'comprador' },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      )
    );

    socket1 = await ligarSocket(tokens[0]);
    socket2 = await ligarSocket(tokens[1]);

    await entrar(socket1, leilaoId.toString());
    await entrar(socket2, leilaoId.toString());

    const recebidas = [];
    const recusadas = [];

    socket1.on('nova-licitacao', dados => recebidas.push(dados));
    socket2.on('nova-licitacao', dados => recebidas.push(dados));

    socket1.on('recusada', mensagem => recusadas.push(mensagem));
    socket2.on('recusada', mensagem => recusadas.push(mensagem));

    // Enviar as duas ofertas sem aguardar pela primeira.
    socket1.emit('licitar', {
      leilaoId: leilaoId.toString(),
      valor: 105
    });

    socket2.emit('licitar', {
      leilaoId: leilaoId.toString(),
      valor: 105
    });

    await esperarAte(
      () => recebidas.length >= 1 && recusadas.length >= 1
    );

    const atualizado = await Auction.findById(leilaoId);
    const historico = await Bid.find({ leilao: leilaoId });

    assert.equal(atualizado.licitacaoAtual.valor, 105);
    assert.equal(atualizado.numLicitacoes, 1);
    assert.equal(historico.length, 1);
    assert.equal(historico[0].valor, 105);

    // Terminar o leilao e criar a encomenda do vencedor.
    await Auction.updateOne(
      { _id: leilaoId },
      { $set: { terminaEm: new Date(Date.now() - 1000) } }
    );

    await sincronizarLeiloes(io);
    await sincronizarLeiloes(io);

    const terminado = await Auction.findById(leilaoId);
    const encomendas = await Order.find({ leilao: leilaoId });

    assert.equal(terminado.estado, 'terminado');
    assert.equal(encomendas.length, 1);
    assert.equal(encomendas[0].origem, 'leilao');
    assert.equal(encomendas[0].total, 105);
  }
);


test('Rajada de 10 licitacoes mantém o leilao consistente',
  { timeout: 45000 },
  async () => {
    const marcador = new mongoose.Types.ObjectId().toString();
    const passwordHash = await bcrypt.hash('TesteSeguro123!', 10);

    let leilao;
    let compradores = [];
    let produtor;
    const sockets = [];

    try {
      // Criar dois compradores independentes.
      compradores = await User.create([
        {
          nome: 'Comprador Rajada A',
          email: `rajada-a-${marcador}@example.invalid`,
          passwordHash,
          papel: 'comprador'
        },
        {
          nome: 'Comprador Rajada B',
          email: `rajada-b-${marcador}@example.invalid`,
          passwordHash,
          papel: 'comprador'
        }
      ]);

      // Criar um produtor validado.
      produtor = await User.create({
        nome: 'Produtor Rajada',
        email: `rajada-p-${marcador}@example.invalid`,
        passwordHash,
        papel: 'produtor',
        produtor: {
          nomeExploracao: 'Exploracao Rajada',
          localidade: 'Barcelos',
          validado: true
        }
      });

      // Criar um leilão exclusivamente para este teste.
      leilao = await Auction.create({
        produtor: produtor._id,
        lote: `Lote Rajada ${marcador}`,
        quantidade: '1 kg',
        precoBase: 100,
        incremento: 5,
        licitacaoAtual: { valor: 100 },
        numLicitacoes: 0,
        iniciaEm: new Date(Date.now() - 10000),
        terminaEm: new Date(Date.now() + 120000),
        estado: 'ativo'
      });

      const id = leilao._id.toString();

      // Autenticar os dois compradores.
      for (const comprador of compradores) {
        const token = jwt.sign(
          {
            id: comprador._id.toString(),
            papel: 'comprador'
          },
          process.env.JWT_SECRET,
          { expiresIn: '10m' }
        );

        const socket = await ligarSocket(token);
        sockets.push(socket);
        await entrar(socket, id);
      }

      const aceites = [];
      const recusadas = [];

      // Registar notificações dos dois clientes.
      for (const socket of sockets) {
        socket.on('nova-licitacao', dados => {
          aceites.push(dados);
        });

        socket.on('recusada', mensagem => {
          recusadas.push(mensagem);
        });
      }

      // Enviar 10 licitações quase simultâneas.
      // Todas têm exatamente o mesmo valor.
      for (let i = 0; i < 10; i++) {
        sockets[i % 2].emit('licitar', {
          leilaoId: id,
          valor: 105
        });
      }

      // Aguardar as respostas do servidor.
      await esperarAte(
        () => recusadas.length >= 9 && aceites.length >= 2,
        25000
      );

      // Consultar os dados persistidos no MongoDB.
      const atualizado = await Auction.findById(id);

      const historico = await Bid.find({
        leilao: leilao._id
      });

      // Apenas uma oferta pode ganhar.
      assert.equal(atualizado.licitacaoAtual.valor, 105);
      assert.equal(atualizado.numLicitacoes, 1);
      assert.equal(historico.length, 1);
      assert.equal(historico[0].valor, 105);

      // Os restantes nove pedidos devem ser recusados.
      assert.equal(recusadas.length, 9);

      // O evento aceite é transmitido aos dois clientes.
      assert.equal(aceites.length, 2);

      // Confirmar que ambas as notificações têm o mesmo valor.
      assert.ok(aceites.every(dados => dados.valor === 105));

      console.log(
        'Rajada: 10 enviadas, 1 aceite, 9 recusadas'
      );
      console.log(
        'MongoDB: 1 licitacao, contador = 1'
      );

    } finally {
      // Desligar as ligações abertas neste teste.
      for (const socket of sockets) {
        socket.disconnect();
      }

      // Eliminar apenas os dados criados neste teste.
      if (leilao) {
        await Bid.deleteMany({ leilao: leilao._id });
        await Order.deleteMany({ leilao: leilao._id });
        await Auction.deleteOne({ _id: leilao._id });
      }

      if (produtor) {
        await User.deleteOne({ _id: produtor._id });
      }

      if (compradores.length) {
        await User.deleteMany({
          _id: { $in: compradores.map(c => c._id) }
        });
      }
    }
  }
);

