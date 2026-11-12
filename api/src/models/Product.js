const { Schema, model, Types } = require('mongoose');

const productSchema = new Schema({
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  nome: { type: String, required: true, trim: true },
  descricao: { type: String, trim: true },
  ingredientes: [{
    type: String,
    trim: true
  }],
  categoria: {
    type: String,
    enum: ['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'],
    required: true
  },
  preco: { type: Number, required: true, min: 0 },
  unidade: { type: String, default: 'kg' }, // kg, unid., garrafa, 500 g…
  stock: { type: Number, default: 0, min: 0 },
  biologico: { type: Boolean, default: false },
  epocas: [{ type: String, enum: ['Primavera', 'Verão', 'Outono', 'Inverno'] }],
  imagemUrl: String // Passo 8: URL da imagem no storage da Cloud
  // TODO (Passo 4): avaliação média? índices para pesquisa?
}, { timestamps: true });



// Passo 4 — Índices para otimizar as consultas do catálogo

// Produtos de um produtor, ordenados dos mais recentes para os mais antigos
productSchema.index({ produtor: 1, createdAt: -1 });

// Filtrar por categoria e preço
productSchema.index({ categoria: 1, preco: 1 });

// Listagem dos produtos mais recentes
productSchema.index({ createdAt: -1 });

// Ordenação e filtros por preço
productSchema.index({ preco: 1 });

module.exports = model('Product', productSchema);
