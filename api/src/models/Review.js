// TODO (Passo 4): decidir se as avaliações ficam embebidas no produto/produtor
// ou numa coleção própria, e justificar a decisão no relatório.
const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema({
  autor: { type: Types.ObjectId, ref: 'User', required: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  produto: { type: Types.ObjectId, ref: 'Product' },
  encomenda: { type: Types.ObjectId, ref: 'Order' },
  classificacao: { type: Number, min: 1, max: 5, required: true },
  comentario: String,
  denuncias: { type: Number, default: 0 },
  visivel: { type: Boolean, default: true }
}, { timestamps: true });

// Passo 4 — Índices para consultas de avaliações

// Avaliações visíveis de um produtor, ordenadas por data
reviewSchema.index({ produtor: 1, visivel: 1, createdAt: -1 });

// Avaliações de um produto
reviewSchema.index({ produto: 1, visivel: 1, createdAt: -1 });

module.exports = model('Review', reviewSchema);
