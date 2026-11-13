// Encomenda: as LINHAS são embebidas (lidas sempre com a encomenda);
// comprador e produtor são REFERENCIADOS.
const { Schema, model, Types } = require('mongoose');

const ESTADOS = ['pendente', 'confirmada', 'pronta', 'entregue'];

const orderSchema = new Schema({
  comprador: { type: Types.ObjectId, ref: 'User', required: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true },

  linhas: {
    type: [{
      produto: { type: Types.ObjectId, ref: 'Product' },

      // Dados preservados no momento da compra
      nome: { type: String, required: true, trim: true },
      precoUnit: { type: Number, required: true, min: 0 },
      quantidade: {
        type: Number,
        required: true,
        min: 1,
        validate: {
          validator: Number.isInteger,
          message: 'A quantidade deve ser um número inteiro.'
        }
      }
    }],
    validate: {
      validator: (linhas) => Array.isArray(linhas) && linhas.length > 0,
      message: 'A encomenda deve conter pelo menos um produto.'
    }
  },

  estado: { type: String, enum: ESTADOS, default: 'pendente' },
  entrega: {
    tipo: { type: String, enum: ['levantamento', 'entrega'], default: 'levantamento' },
    morada: String
  },

  // Identificar a origem da encomenda.
  origem: {
    type: String,
    enum: ['loja', 'leilao'],
    default: 'loja'
  },

  // Referência ao leilão quando a encomenda resulta de uma vitória.
  leilao: {
    type: Types.ObjectId,
    ref: 'Auction',
    required: function () {
      return this.origem === 'leilao';
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Total calculado a partir das linhas, sem duplicar dados na BD
orderSchema.virtual('total').get(function () {
  return Math.round(
    (this.linhas || []).reduce(
      (total, linha) =>
        total + linha.precoUnit * linha.quantidade,
      0
    ) * 100
  ) / 100;
});

orderSchema.statics.ESTADOS = ESTADOS;

// Passo 4 — Índices para consultas de encomendas

// Histórico de encomendas de um comprador
orderSchema.index({ comprador: 1, createdAt: -1 });

// Encomendas recebidas por um produtor
orderSchema.index({ produtor: 1, createdAt: -1 });

// Um leilão só pode originar uma encomenda.
orderSchema.index(
  { leilao: 1 },
  {
    unique: true,
    partialFilterExpression: {
      leilao: { $type: 'objectId' }
    }
  }
);

module.exports = model('Order', orderSchema);
