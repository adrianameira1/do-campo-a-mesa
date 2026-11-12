const { Schema, model, Types } = require('mongoose');

const bidSchema = new Schema({
  leilao: { type: Types.ObjectId, ref: 'Auction', required: true },
  comprador: { type: Types.ObjectId, ref: 'User', required: true },
  valor: { type: Number, required: true }
}, { timestamps: true });

// Passo 4 — Índice para o histórico de licitações

// Consultar as licitações de um leilão, das mais recentes para as mais antigas
bidSchema.index({ leilao: 1, createdAt: -1, _id: -1 });

module.exports = model('Bid', bidSchema);
