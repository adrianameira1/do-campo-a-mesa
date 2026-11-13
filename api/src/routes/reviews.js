
const router = require('express').Router();
const auth = require('../middleware/auth');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { isValidObjectId } = require('mongoose');


// POST /api/reviews (comprador) -> 201
// Criar avaliação de um produtor ou de um produto.

router.post('/', auth('comprador'), async (req, res, next) => {
  try {
    const {
      encomenda,
      tipo,
      produto,
      classificacao,
      comentario
    } = req.body || {};

    // 1. Validar a encomenda.
    if (!isValidObjectId(encomenda)) {
      return res.status(400).json({
        erro: 'Identificador de encomenda inválido'
      });
    }

    // 2. Validar o tipo de avaliação.
    if (!['produtor', 'produto'].includes(tipo)) {
      return res.status(400).json({
        erro: 'Tipo de avaliação inválido'
      });
    }

    // 3. Validar a classificação.
    if (
      typeof classificacao !== 'number' ||
      !Number.isInteger(classificacao) ||
      classificacao < 1 ||
      classificacao > 5
    ) {
      return res.status(400).json({
        erro: 'A classificação deve ser um inteiro entre 1 e 5'
      });
    }

    // 4. Validar o comentário opcional.
    if (
      comentario !== undefined &&
      (
        typeof comentario !== 'string' ||
        comentario.length > 1000
      )
    ) {
      return res.status(400).json({
        erro: 'Comentário inválido (máximo 1000 caracteres)'
      });
    }

    // 5. Validar o produto quando se trata de uma
    // avaliação individual de produto.
    if (tipo === 'produto') {
      if (!isValidObjectId(produto)) {
        return res.status(400).json({
          erro: 'É necessário indicar um produto válido'
        });
      }
    } else if (
      produto !== undefined &&
      produto !== null &&
      produto !== ''
    ) {
      return res.status(400).json({
        erro: 'Uma avaliação de produtor não deve indicar um produto'
      });
    }

    // 6. Confirmar que a encomenda pertence ao comprador.
    const pedido = await Order.findOne({
      _id: encomenda,
      comprador: req.user.id
    });

    if (!pedido) {
      return res.status(404).json({
        erro: 'Encomenda não encontrada'
      });
    }

    // 7. Só permitir avaliações após a entrega.
    if (pedido.estado !== 'entregue') {
      return res.status(409).json({
        erro: 'A encomenda ainda não foi entregue'
      });
    }

    // 8. Confirmar que o produto pertence à encomenda.
    if (tipo === 'produto') {
      const pertenceEncomenda = pedido.linhas.some(
        linha =>
          linha.produto &&
          String(linha.produto) === String(produto)
      );

      if (!pertenceEncomenda) {
        return res.status(400).json({
          erro: 'O produto não pertence à encomenda'
        });
      }
    }

    // 9. Impedir avaliações duplicadas.
    // Uma avaliação do produtor por encomenda.
    // Uma avaliação por produto e encomenda.
    const filtroDuplicado = {
      autor: req.user.id,
      encomenda: pedido._id,
      tipo
    };

    if (tipo === 'produto') {
      filtroDuplicado.produto = produto;
    }

    const existente = await Review.findOne(filtroDuplicado);

    if (existente) {
      return res.status(409).json({
        erro: tipo === 'produtor'
          ? 'Já avaliou este produtor nesta encomenda'
          : 'Já avaliou este produto nesta encomenda'
      });
    }

    // 10. Criar a avaliação.
    const avaliacao = await Review.create({
      autor: req.user.id,
      produtor: pedido.produtor,
      tipo,
      ...(tipo === 'produto'
        ? { produto }
        : {}),
      encomenda: pedido._id,
      classificacao,
      comentario: comentario?.trim() || ''
    });

    return res
      .status(201)
      .location(`/api/reviews/${avaliacao._id}`)
      .json(avaliacao);

  } catch (err) {
    // Proteger também contra pedidos simultâneos duplicados.
    if (err.code === 11000) {
      return res.status(409).json({
        erro: 'Esta avaliação já foi submetida'
      });
    }

    next(err);
  }
});


// GET /api/reviews?produtor=&produto=&tipo=
// Consultar avaliações visíveis.

router.get('/', async (req, res, next) => {
  try {
    const { produtor, produto, tipo } = req.query;

    const filtro = {
      visivel: true
    };

    // Validar o tipo.
    if (
      tipo &&
      !['produtor', 'produto'].includes(tipo)
    ) {
      return res.status(400).json({
        erro: 'Tipo de avaliação inválido'
      });
    }

    // Filtrar por produtor.
    if (produtor) {
      if (!isValidObjectId(produtor)) {
        return res.status(400).json({
          erro: 'Identificador de produtor inválido'
        });
      }

      filtro.produtor = produtor;
    }

    // Filtrar por produto.
    if (produto) {
      if (!isValidObjectId(produto)) {
        return res.status(400).json({
          erro: 'Identificador de produto inválido'
        });
      }

      if (tipo && tipo !== 'produto') {
        return res.status(400).json({
          erro: 'Filtro incompatível com o produto'
        });
      }

      filtro.produto = produto;
      filtro.tipo = 'produto';

    } else if (tipo) {
      filtro.tipo = tipo;

    } else if (produtor) {
      // Por defeito, mostrar avaliações do produtor,
      // não avaliações individuais dos seus produtos.
      filtro.tipo = 'produtor';
    }

    const avaliacoes = await Review.find(filtro)
      .select('-denunciantes')
      .populate('autor', 'nome')
      .populate('produtor', 'nome produtor.nomeExploracao')
      .populate('produto', 'nome')
      .sort({ createdAt: -1, _id: -1 });

    return res.status(200).json(avaliacoes);

  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/encomenda/:id/minhas
// Consultar as avaliações do comprador numa encomenda.

router.get(
  '/encomenda/:id/minhas',
  auth('comprador'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          erro: 'Identificador de encomenda inválido'
        });
      }

      // Confirmar que a encomenda pertence ao comprador.
      const pedido = await Order.findOne({
        _id: id,
        comprador: req.user.id
      });

      if (!pedido) {
        return res.status(404).json({
          erro: 'Encomenda não encontrada'
        });
      }


      // Devolver apenas as avaliações do próprio comprador,
      // sem revelar os identificadores dos denunciantes.
      const avaliacoes = await Review.find({
        autor: req.user.id,
        encomenda: pedido._id
      })
        .select('-denunciantes')
        .sort({ createdAt: -1 });


      return res.status(200).json(avaliacoes);

    } catch (err) {
      next(err);
    }
  }
);


// GET /api/reviews/:id -> 200 | 404
// Consultar uma avaliação individual.

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    const avaliacao = await Review.findOne({
      _id: id,
      visivel: true
    })
      .select('-denunciantes')
      .populate('autor', 'nome')
      .populate('produtor', 'nome produtor.nomeExploracao')
      .populate('produto', 'nome');

    if (!avaliacao) {
      return res.status(404).json({
        erro: 'Avaliação não encontrada'
      });
    }

    return res.status(200).json(avaliacao);

  } catch (err) {
    next(err);
  }
});


// POST /api/reviews/:id/denuncia -> 204
// Denunciar uma avaliação.


router.post('/:id/denuncia', auth(), async (req, res, next) => {
  try {
    const { id } = req.params;
    const utilizadorId = req.user.id;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    const avaliacao = await Review.findById(id);

    if (!avaliacao || !avaliacao.visivel) {
      return res.status(404).json({
        erro: 'Avaliação não encontrada'
      });
    }

    // Impedir denúncia da própria avaliação.
    if (String(avaliacao.autor) === String(utilizadorId)) {
      return res.status(403).json({
        erro: 'Não podes denunciar a tua própria avaliação'
      });
    }

    // Impedir denúncias repetidas pelo mesmo utilizador.
    // A condição é verificada também na atualização atómica.
    const atualizada = await Review.findOneAndUpdate(
      {
        _id: id,
        visivel: true,
        denunciantes: { $ne: utilizadorId }
      },
      {
        $addToSet: {
          denunciantes: utilizadorId
        },
        $inc: {
          denuncias: 1
        },
        $set: {
          estadoModeracao: 'pendente'
        }
      },

      {
        new: true,
        runValidators: true
      }
    );

    if (!atualizada) {
      return res.status(409).json({
        erro: 'Já denunciaste esta avaliação'
      });
    }

    return res.status(204).send();

  } catch (err) {
    next(err);
  }
});



module.exports = router;
