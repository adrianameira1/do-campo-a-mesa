// Painel do administrador
const router = require('express').Router();
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');
const User = require('../models/User');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const { isValidObjectId } = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');

router.use(auth('admin'));

// GET /api/admin/estatisticas  -> 200 { utilizadores, produtores, encomendasHoje, leiloesAtivos }

router.get('/estatisticas', async (req, res, next) => {
  try {
    // Início e fim do dia atual em UTC
    const agora = new Date();

    const inicioDia = new Date(agora);
    inicioDia.setUTCHours(0, 0, 0, 0);

    const fimDia = new Date(inicioDia);
    fimDia.setUTCDate(fimDia.getUTCDate() + 1);

    // Consultar as quatro estatísticas
    const [
      utilizadores,
      produtores,
      encomendasHoje,
      leiloesAtivos
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({
        papel: 'produtor'
      }),

      Order.countDocuments({
        createdAt: {
          $gte: inicioDia,
          $lt: fimDia
        }
      }),

      Auction.countDocuments({
        estado: 'ativo',
        iniciaEm: { $lte: agora },
        terminaEm: { $gt: agora }
      })
    ]);

    return res.status(200).json({
      utilizadores,
      produtores,
      encomendasHoje,
      leiloesAtivos
    });

  } catch (err) {
    next(err);
  }
});


// GET /api/admin/produtores/pendentes  -> 200 [produtores por validar]

router.get('/produtores/pendentes', async (req, res, next) => {
  try {

      const produtores = await User.find({
        papel: 'produtor',
        'produtor.validado': false,
        'produtor.rejeitado': { $ne: true }
      })
      .select('nome email produtor createdAt')
      .sort({ createdAt: 1 });

    return res.status(200).json(produtores);

  } catch (err) {
    next(err);
  }
});



 // PATCH /api/admin/produtores/:id/validacao
 // Aprovar ou rejeitar um produtor pendente.

router.patch('/produtores/:id/validacao', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { aprovado } = req.body || {};

    // 1. Validar o identificador.
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    // 2. Validar a decisão.
    if (typeof aprovado !== 'boolean') {
      return res.status(400).json({
        erro: 'O campo aprovado deve ser true ou false'
      });
    }

    // 3. Procurar o produtor.
    const produtor = await User.findOne({
      _id: id,
      papel: 'produtor'
    });

    if (!produtor) {
      return res.status(404).json({
        erro: 'Produtor não encontrado'
      });
    }

    // 4. Impedir decisões repetidas.
    if (
      produtor.produtor.validado === true ||
      produtor.produtor.rejeitado === true
    ) {
      return res.status(409).json({
        erro: 'Este pedido de produtor já foi decidido'
      });
    }

    // 5. Guardar a decisão.
    produtor.produtor.validado = aprovado;
    produtor.produtor.rejeitado = !aprovado;

    await produtor.save();

    // 6. Notificar o produtor quando é aprovado.
    if (aprovado) {
      req.app.get('io')?.to(`user:${produtor._id}`).emit(
        'conta-validada',
        { id: produtor._id.toString() }
      );
    }

    // 7. Devolver a resposta de sucesso.
    return res.status(200).json({
      _id: produtor._id,
      nome: produtor.nome,
      email: produtor.email,
      produtor: produtor.produtor
    });

  } catch (err) {
    next(err);
  }
});



// GET /api/admin/reviews/denunciadas  -> 200

router.get('/reviews/denunciadas', async (req, res, next) => {
  try {
    // Consultar avaliações com pelo menos uma denúncia

    const avaliacoes = await Review.find({
      denuncias: { $gt: 0 },
      estadoModeracao: { $ne: 'resolvida' }
    })

      .populate('autor', 'nome')
      .populate('produtor', 'nome produtor.nomeExploracao')
      .populate('produto', 'nome')
      .sort({ denuncias: -1, createdAt: -1 });

    return res.status(200).json(avaliacoes);

  } catch (err) {
    next(err);
  }
});


 // GET /api/admin/reviews/resolvidas
 // Consultar o histórico de avaliações moderadas.

router.get('/reviews/resolvidas', async (req, res, next) => {
  try {
    const avaliacoes = await Review.find({
      denuncias: { $gt: 0 },
      estadoModeracao: 'resolvida'
    })
      .select('-denunciantes')
      .populate('autor', 'nome')
      .populate('produtor', 'nome produtor.nomeExploracao')
      .populate('produto', 'nome')
      .sort({ moderadoEm: -1, createdAt: -1 });

    return res.status(200).json(avaliacoes);
  } catch (err) {
    next(err);
  }
});



// PATCH /api/admin/reviews/:id  { visivel: false }  -> 200

router.patch('/reviews/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { visivel } = req.body || {};

    // Validar o identificador da avaliação
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    // Validar o campo visivel
    if (typeof visivel !== 'boolean') {
      return res.status(400).json({
        erro: 'O campo visivel deve ser true ou false'
      });
    }

    // Atualizar a visibilidade da avaliação

    const avaliacao = await Review.findByIdAndUpdate(
      id,
      {
        $set: {
          visivel,
          estadoModeracao: 'resolvida',
          moderadoEm: new Date()
        }
      },
      {
        new: true,
        runValidators: true
      }
    );


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


/**
 * GET /api/admin/products
 * Listar todos os produtos, incluindo os ocultos.
 */
router.get('/products', async (req, res, next) => {
  try {
    const produtos = await Product.find()
      .populate(
        'produtor',
        'nome produtor.nomeExploracao produtor.localidade'
      )
      .sort({ createdAt: -1 });

    return res.status(200).json(produtos);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/products/:id/visibilidade
 * Ocultar ou voltar a mostrar um produto.
 */
router.patch('/products/:id/visibilidade', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { visivel } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador de produto inválido'
      });
    }

    if (typeof visivel !== 'boolean') {
      return res.status(400).json({
        erro: 'O campo visivel deve ser true ou false'
      });
    }

    const produto = await Product.findByIdAndUpdate(
      id,
      { $set: { visivel } },
      {
        new: true,
        runValidators: true
      }
    ).populate(
      'produtor',
      'nome produtor.nomeExploracao'
    );

    if (!produto) {
      return res.status(404).json({
        erro: 'Produto não encontrado'
      });
    }

    return res.status(200).json(produto);
  } catch (err) {
    next(err);
  }
});



module.exports = router;
