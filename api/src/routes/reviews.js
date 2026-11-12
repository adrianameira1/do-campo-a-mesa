const router = require('express').Router();
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');
const Review = require('../models/Review');
const { isValidObjectId } = require('mongoose');
const Order = require('../models/Order');

// POST /api/reviews  (comprador, só após encomenda entregue)  -> 201

router.post('/', auth('comprador'), async (req, res, next) => {
  try {
    const {
      encomenda,
      produto,
      classificacao,
      comentario
    } = req.body || {};

    // 1. Validar o identificador da encomenda
    if (!encomenda || !isValidObjectId(encomenda)) {
      return res.status(400).json({
        erro: 'Identificador de encomenda inválido'
      });
    }

    // 2. Validar a classificação (1 a 5 estrelas)
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

    // 3. Validar o comentário opcional
    if (
      comentario !== undefined &&
      typeof comentario !== 'string'
    ) {
      return res.status(400).json({
        erro: 'Comentário inválido'
      });
    }

    // 4. Confirmar que a encomenda pertence ao comprador
    const pedido = await Order.findOne({
      _id: encomenda,
      comprador: req.user.id
    });

    if (!pedido) {
      return res.status(404).json({
        erro: 'Encomenda não encontrada'
      });
    }

    // 5. Só permitir avaliações após a entrega
    if (pedido.estado !== 'entregue') {
      return res.status(409).json({
        erro: 'A encomenda ainda não foi entregue'
      });
    }

    // 6. Validar o produto, caso seja indicado
    if (produto !== undefined && produto !== null) {
      if (!isValidObjectId(produto)) {
        return res.status(400).json({
          erro: 'Identificador de produto inválido'
        });
      }

      const pertenceEncomenda = pedido.linhas.some(
        linha => linha.produto?.toString() === produto.toString()
      );

      if (!pertenceEncomenda) {
        return res.status(400).json({
          erro: 'O produto não pertence à encomenda'
        });
      }
    }

    // 7. Impedir avaliações duplicadas da mesma encomenda
    const existente = await Review.findOne({
      autor: req.user.id,
      encomenda: pedido._id
    });

    if (existente) {
      return res.status(409).json({
        erro: 'Esta encomenda já foi avaliada'
      });
    }

    // 8. Criar a avaliação
    const avaliacao = await Review.create({
      autor: req.user.id,
      produtor: pedido.produtor,
      produto: produto || undefined,
      encomenda: pedido._id,
      classificacao,
      comentario: comentario?.trim() || '',
      denuncias: 0,
      visivel: true
    });

    return res
      .status(201)
      .location(`/api/reviews/${avaliacao._id}`)
      .json(avaliacao);

  } catch (err) {
    next(err);
  }
});

// GET /api/reviews?produtor=&produto=  -> 200 [avaliações visíveis]

router.get('/', async (req, res, next) => {
  try {
    const { produtor, produto } = req.query;

    const filtro = {
      visivel: true
    };

    // Filtrar por produtor
    if (produtor) {
      if (!isValidObjectId(produtor)) {
        return res.status(400).json({
          erro: 'Identificador de produtor inválido'
        });
      }

      filtro.produtor = produtor;
    }

    // Filtrar por produto
    if (produto) {
      if (!isValidObjectId(produto)) {
        return res.status(400).json({
          erro: 'Identificador de produto inválido'
        });
      }

      filtro.produto = produto;
    }

    const avaliacoes = await Review.find(filtro)
      .populate('autor', 'nome')
      .populate('produtor', 'nome produtor.nomeExploracao')
      .populate('produto', 'nome')
      .sort({ createdAt: -1, _id: -1 });

    return res.status(200).json(avaliacoes);

  } catch (err) {
    next(err);
  }
});


// POST /api/reviews/:id/denuncia  -> 204

router.post('/:id/denuncia', auth(), async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Validar o identificador
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    // 2. Incrementar o número de denúncias
    const avaliacao = await Review.findByIdAndUpdate(
      id,
      { $inc: { denuncias: 1 } },
      {
        new: true,
        runValidators: true
      }
    );

    // 3. Confirmar que a avaliação existe
    if (!avaliacao) {
      return res.status(404).json({
        erro: 'Avaliação não encontrada'
      });
    }

    // 4. Responder sem conteúdo
    return res.status(204).send();

  } catch (err) {
    next(err);
  }
});


module.exports = router;
