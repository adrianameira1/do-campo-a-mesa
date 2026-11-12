// Leilão em direto. As licitações ficam numa coleção própria (Bid): podem ser centenas.
const { Schema, model, Types } = require('mongoose');

const auctionSchema = new Schema({
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  produto: { type: Types.ObjectId, ref: 'Product' },
  lote: {
  type: String,
  required: true,
  trim: true
  },        // "200 kg de kiwi Hayward, calibre A"
  quantidade: String,
  precoBase: { type: Number, required: true, min: 0 },
  incremento: { type: Number, required: true, min: 0.01 },
  // Começa com valor = precoBase; a 1.ª licitação tem de ser >= precoBase + incremento
  licitacaoAtual: {
  valor: { type: Number, min: 0 },
  comprador: { type: Types.ObjectId, ref: 'User' }
  },
  iniciaEm: { type: Date, required: true },
  terminaEm: { type: Date, required: true },
  estado: { type: String, enum: ['agendado', 'ativo', 'terminado'], default: 'agendado' }
}, { timestamps: true });

// Passo 4 — Índices para consultas de leilões

// Listar leilões por estado, ordenados pela data de início
auctionSchema.index({ estado: 1, iniciaEm: -1 });

// Consultar os leilões criados por um produtor
auctionSchema.index({ produtor: 1, iniciaEm: -1 });

module.exports = model('Auction', auctionSchema);
