
// As avaliações são armazenadas numa coleção independente.
// Permitem consultar e moderar avaliações individualmente.

const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema({

  autor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },

  produtor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Distinguir avaliação do produtor e do produto.
  tipo: {
    type: String,
    enum: ['produtor', 'produto'],
    required: true
  },

  produto: {
    type: Types.ObjectId,
    ref: 'Product',
    required: function () {
      return this.tipo === 'produto';
    }
  },

  // Associar a avaliação à encomenda entregue.
  encomenda: {
    type: Types.ObjectId,
    ref: 'Order',
    required: true
  },

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

  comentario: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  denuncias: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'O número de denúncias deve ser inteiro.'
    }
  },

  // Utilizadores que já denunciaram esta avaliação.
  denunciantes: {
    type: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: [],
    select: false
  },



  // Define se a avaliação aparece publicamente.
  visivel: {
    type: Boolean,
    default: true
  },

  // Estado da análise das denúncias pelo administrador.
  estadoModeracao: {
    type: String,
    enum: ['pendente', 'resolvida'],
    default: 'pendente'
  },

  // Data da última decisão administrativa.
  moderadoEm: {
    type: Date,
    default: null
  }


}, { timestamps: true });


// Índices para consultar avaliações de produtores.
reviewSchema.index({
  produtor: 1,
  visivel: 1,
  createdAt: -1
});


// Índices para consultar avaliações de produtos.
reviewSchema.index({
  produto: 1,
  visivel: 1,
  createdAt: -1
});


// Um comprador só pode avaliar uma vez o produtor
// relativamente à mesma encomenda.
reviewSchema.index(
  { autor: 1, encomenda: 1 },
  {
    unique: true,
    partialFilterExpression: {
      tipo: 'produtor',
      encomenda: { $type: 'objectId' }
    }
  }
);


// Um comprador só pode avaliar uma vez cada produto
// relativamente à mesma encomenda.
reviewSchema.index(
  { autor: 1, encomenda: 1, produto: 1 },
  {
    unique: true,
    partialFilterExpression: {
      tipo: 'produto',
      encomenda: { $type: 'objectId' },
      produto: { $type: 'objectId' }
    }
  }
);


module.exports = model('Review', reviewSchema);
