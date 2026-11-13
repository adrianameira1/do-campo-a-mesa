const { Schema, model, Types } = require('mongoose');

const bidSchema = new Schema({
  leilao: {
    type: Types.ObjectId,
    ref: 'Auction',
    required: true,
  },
  comprador: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  nome: String,
  valor: {
    type: Number,
    required: true,
    min: 0
  }
}, { timestamps: true });

// Índice para consultar o histórico de licitações
bidSchema.index({ leilao: 1, createdAt: -1, _id: -1 });

module.exports = model('Bid', bidSchema);