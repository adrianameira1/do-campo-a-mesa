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
  }
  // TODO (Passo 4): total calculado? histórico de mudanças de estado?
}, { timestamps: true });

orderSchema.statics.ESTADOS = ESTADOS;

// Passo 4 — Índices para consultas de encomendas

// Histórico de encomendas de um comprador
orderSchema.index({ comprador: 1, createdAt: -1 });

// Encomendas recebidas por um produtor
orderSchema.index({ produtor: 1, createdAt: -1 });

module.exports = model('Order', orderSchema);
