// As avaliações são armazenadas numa coleção independente.
// Referencing permite consultar e moderar avaliações individualmente,
// evitando o crescimento ilimitado dos documentos de produtos/produtores.
const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema({
  autor: { type: Types.ObjectId, ref: 'User', required: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  produto: { type: Types.ObjectId, ref: 'Product' },
  encomenda: { type: Types.ObjectId, ref: 'Order' },
  classificacao: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: 'A classificação deve ser um número inteiro.'
    }
  },
  comentario: { type: String, trim: true },

  denuncias: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'O número de denúncias deve ser inteiro.'
    }
  },
  visivel: { type: Boolean, default: true }
}, { timestamps: true });

// Passo 4 — Índices para consultas de avaliações

// Avaliações visíveis de um produtor, ordenadas por data
reviewSchema.index({ produtor: 1, visivel: 1, createdAt: -1 });

// Avaliações de um produto
reviewSchema.index({ produto: 1, visivel: 1, createdAt: -1 });

// Impedir avaliações duplicadas da mesma encomenda
reviewSchema.index(
  { autor: 1, encomenda: 1 },
  {
    unique: true,
    partialFilterExpression: {
      encomenda: { $type: 'objectId' }
    }
  }
);

module.exports = model('Review', reviewSchema);
