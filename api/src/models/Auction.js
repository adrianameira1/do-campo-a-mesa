
const { Schema, model, Types } = require('mongoose');

const auctionSchema = new Schema({
  produtor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  produto: {
    type: Types.ObjectId,
    ref: 'Product'
  },

  lote: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },

  descricao: {
    type: String,
    maxlength: 1000
  },

  quantidade: String,

  precoBase: {
    type: Number,
    required: true,
    min: 0
  },

  incremento: {
    type: Number,
    required: true,
    min: 0.01
  },

  // Licitação atual embebida no leilão
  licitacaoAtual: {
    valor: {
      type: Number,
      min: 0
    },
    comprador: {
      type: Types.ObjectId,
      ref: 'User'
    },
    nome: String,
    em: Date
  },

  // Contador de licitações
  numLicitacoes: {
    type: Number,
    default: 0,
    min: 0
  },

  iniciaEm: {
    type: Date,
    required: true
  },

  terminaEm: {
    type: Date,
    required: true,
    index: true
  },

  estado: {
    type: String,
    enum: ['agendado', 'ativo', 'terminado'],
    default: 'agendado',
    index: true
  },

  encomenda: {
    type: Types.ObjectId,
    ref: 'Order'
  }

}, { timestamps: true });

// Índices para consultas
auctionSchema.index({ estado: 1, iniciaEm: -1 });
auctionSchema.index({ produtor: 1, iniciaEm: -1 });
auctionSchema.index({ estado: 1, terminaEm: 1 });

module.exports = model('Auction', auctionSchema);
