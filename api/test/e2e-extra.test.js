// Testes E2E complementares — Do Campo à Mesa
// Executar apenas com MONGODB_URI_TEST apontada explicitamente a dcm_e2e_test.
require('dotenv').config();

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { io: connectSocket } = require('socket.io-client');

const app = require('../src/app');
const registarSockets = require('../src/sockets');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Review = require('../src/models/Review');
const Auction = require('../src/models/Auction');
const Bid = require('../src/models/Bid');

const DB_NAME = 'dcm_e2e_test';
const uri = process.env.MONGODB_URI_TEST;
if (!uri || !process.env.JWT_SECRET) {
  throw new Error('MONGODB_URI_TEST e JWT_SECRET são obrigatórias');
}
let parsed;
try { parsed = new URL(uri); } catch { throw new Error('MONGODB_URI_TEST inválida'); }
if (
  decodeURIComponent(parsed.pathname).slice(1) !== DB_NAME ||
  uri === process.env.MONGODB_URI
) {
  throw new Error('SEGURANÇA: base de testes não confirmada');
}

let server;
let io;
let apiURL;
const sockets = [];
const created = { users: [], products: [], orders: [], auctions: [] };
const ctx = {};

function token(user) {
  return jwt.sign({ id: user._id.toString(), papel: user.papel },
    process.env.JWT_SECRET, { expiresIn: '10m' });
}
async function request(method, path, actor, payload) {
  const response = await fetch(`${apiURL}/api${path}`, {
    method,
    headers: {
      ...(actor ? { Authorization: `Bearer ${token(actor)}` } : {}),
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
  });
  let data;
  if (response.status !== 204) {
    const text = await response.text();
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  }
  return { status: response.status, data, headers: response.headers };
}
async function makeUser(role, extra = {}) {
  const suffix = new mongoose.Types.ObjectId().toString();
  const user = await User.create({
    nome: `E2E ${role}`,
    email: `e2e-extra-${suffix}@example.invalid`,
    passwordHash: ctx.passwordHash,
    papel: role,
    ...extra
  });
  created.users.push(user._id);
  return user;
}
async function makeOrder(estado) {
  const order = await Order.create({
    comprador: ctx.buyer._id,
    produtor: ctx.producer._id,
    linhas: [{ produto: ctx.product._id, nome: ctx.product.nome, precoUnit: 3, quantidade: 1 }],
    estado,
    entrega: { tipo: 'levantamento' }
  });
  created.orders.push(order._id);
  return order;
}

before(async () => {
  await mongoose.connect(uri);
  if (mongoose.connection.name !== DB_NAME) throw new Error('Base de testes incorreta');
  ctx.passwordHash = await bcrypt.hash('E2E-Password-1234', 10);
  ctx.buyer = await makeUser('comprador');
  ctx.otherBuyer = await makeUser('comprador');
  ctx.producer = await makeUser('produtor', {
    produtor: { nomeExploracao: 'Quinta E2E', localidade: 'Barcelos', validado: true }
  });
  ctx.otherProducer = await makeUser('produtor', {
    produtor: { nomeExploracao: 'Outra Quinta E2E', localidade: 'Braga', validado: true }
  });
  ctx.pendingProducer = await makeUser('produtor', {
    produtor: { nomeExploracao: 'Pendente E2E', localidade: 'Braga', validado: false }
  });
  ctx.admin = await makeUser('admin');
  ctx.product = await Product.create({
    produtor: ctx.producer._id,
    nome: 'Maçã E2E', categoria: 'Fruta', preco: 3, stock: 3, biologico: true,
    visivel: true, epocas: ['Outono']
  });
  created.products.push(ctx.product._id);

  server = http.createServer(app);
  io = new Server(server, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' } });
  app.set('io', io);
  registarSockets(io);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  apiURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === DB_NAME) {
    // Remover apenas os documentos de teste registados neste ficheiro.
    if (created.orders.length) await Review.deleteMany({ encomenda: { $in: created.orders } });
    if (created.auctions.length) {
      await Bid.deleteMany({ leilao: { $in: created.auctions } });
      await Order.deleteMany({ leilao: { $in: created.auctions } });
      await Auction.deleteMany({ _id: { $in: created.auctions } });
    }
    if (created.orders.length) await Order.deleteMany({ _id: { $in: created.orders } });
    if (created.products.length) await Product.deleteMany({ _id: { $in: created.products } });
    if (created.users.length) await User.deleteMany({ _id: { $in: created.users } });
  }
  if (io) await new Promise(resolve => io.close(resolve));
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
});

test('Comprador não pode criar um produto (403)', async () => {
  const r = await request('POST', '/products', ctx.buyer, { nome: 'Produto proibido' });
  assert.equal(r.status, 403);
});

test('Produtor não validado não pode criar um produto (403)', async () => {
  const r = await request('POST', '/products', ctx.pendingProducer, {
    nome: 'Produto proibido', categoria: 'Fruta', preco: 1, stock: 1
  });
  assert.equal(r.status, 403);
});

test('Um produtor não pode alterar o produto de outro (404)', async () => {
  const r = await request('PUT', `/products/${ctx.product._id}`, ctx.otherProducer, { preco: 1 });
  assert.equal(r.status, 404);
  const product = await Product.findById(ctx.product._id);
  assert.equal(product.preco, 3);
});

test('Catálogo filtra categoria, preço máximo e biológico', async () => {
  const r = await request('GET', '/products?categoria=Fruta&precoMax=3&bio=true', null);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.data));
  assert.ok(r.data.some(p => p._id === String(ctx.product._id)));
});

test('Stock insuficiente devolve 409 e não altera stock', async () => {
  const r = await request('POST', '/orders', ctx.buyer, {
    linhas: [{ produto: String(ctx.product._id), quantidade: 10 }],
    entrega: { tipo: 'levantamento' }
  });
  assert.equal(r.status, 409);
  const product = await Product.findById(ctx.product._id);
  assert.equal(product.stock, 3);
});

test('Encomenda válida devolve 201 e reserva stock', async () => {
  const r = await request('POST', '/orders', ctx.buyer, {
    linhas: [{ produto: String(ctx.product._id), quantidade: 2 }],
    entrega: { tipo: 'levantamento' }
  });
  assert.equal(r.status, 201);
  assert.ok(Array.isArray(r.data) && r.data.length === 1);
  ctx.realOrder = r.data[0];
  created.orders.push(ctx.realOrder._id);
  const product = await Product.findById(ctx.product._id);
  assert.equal(product.stock, 1);
});

test('Comprador não pode mudar o estado da encomenda (403)', async () => {
  const order = ctx.realOrder || await makeOrder('pendente');
  const r = await request('PATCH', `/orders/${order._id}/estado`, ctx.buyer, { estado: 'confirmada' });
  assert.equal(r.status, 403);
});

test('Produtor não pode saltar ou recuar estados (409)', async () => {
  const order = await makeOrder('confirmada');
  const salto = await request('PATCH', `/orders/${order._id}/estado`, ctx.producer, { estado: 'entregue' });
  assert.equal(salto.status, 409);
  const recuo = await request('PATCH', `/orders/${order._id}/estado`, ctx.producer, { estado: 'pendente' });
  assert.equal(recuo.status, 409);
  assert.equal((await Order.findById(order._id)).estado, 'confirmada');
});

test('Avaliação antes da entrega é recusada (409)', async () => {
  const order = await makeOrder('pendente');
  const r = await request('POST', '/reviews', ctx.buyer, {
    encomenda: String(order._id), tipo: 'produtor', classificacao: 5
  });
  assert.equal(r.status, 409);
});

test('Avaliação duplicada da mesma encomenda é recusada (409)', async () => {
  const order = await makeOrder('entregue');
  const payload = {
    encomenda: String(order._id), tipo: 'produtor', classificacao: 5,
    comentario: 'Avaliação automatizada E2E'
  };
  const first = await request('POST', '/reviews', ctx.buyer, payload);
  assert.equal(first.status, 201);
  const second = await request('POST', '/reviews', ctx.buyer, payload);
  assert.equal(second.status, 409);
  const total = await Review.countDocuments({ encomenda: order._id, tipo: 'produtor' });
  assert.equal(total, 1);
});

test('Comprador não pode aceder às estatísticas administrativas (403)', async () => {
  const r = await request('GET', '/admin/estatisticas', ctx.buyer);
  assert.equal(r.status, 403);
});

test('Admin aprova produtor e impede decisão repetida', async () => {
  const r = await request('PATCH', `/admin/produtores/${ctx.pendingProducer._id}/validacao`,
    ctx.admin, { aprovado: true });
  assert.equal(r.status, 200);
  assert.equal(r.data.produtor.validado, true);
  const again = await request('PATCH', `/admin/produtores/${ctx.pendingProducer._id}/validacao`,
    ctx.admin, { aprovado: false });
  assert.equal(again.status, 409);
});

test('Licitação abaixo do mínimo é recusada sem alterar o histórico', { timeout: 15000 }, async () => {
  const leilao = await Auction.create({
    produtor: ctx.producer._id,
    lote: 'Lote E2E mínimo', quantidade: '1 kg', precoBase: 100, incremento: 5,
    licitacaoAtual: { valor: 100 }, estado: 'ativo', numLicitacoes: 0,
    iniciaEm: new Date(Date.now() - 10000), terminaEm: new Date(Date.now() + 60000)
  });
  created.auctions.push(leilao._id);
  const socket = connectSocket(apiURL, {
    auth: { token: token(ctx.buyer) },
    transports: ['websocket'], reconnection: false, autoConnect: false
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout socket')), 5000);
    socket.once('connect', () => { clearTimeout(timeout); resolve(); });
    socket.once('connect_error', error => { clearTimeout(timeout); reject(error); });
    socket.connect();
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout entrar')), 5000);
    socket.once('estado', () => { clearTimeout(timeout); resolve(); });
    socket.emit('entrar', String(leilao._id));
  });
  const recusada = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout da recusa')), 5000);
    socket.once('recusada', message => { clearTimeout(timeout); resolve(message); });
  });
  socket.emit('licitar', { leilaoId: String(leilao._id), valor: 104 });
  assert.equal(typeof await recusada, 'string');
  assert.equal((await Bid.countDocuments({ leilao: leilao._id })), 0);
  assert.equal((await Auction.findById(leilao._id)).numLicitacoes, 0);
});