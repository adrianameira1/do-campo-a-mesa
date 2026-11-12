// Painel do administrador
const router = require('express').Router();
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');
const User = require('../models/User');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const { isValidObjectId } = require('mongoose');
const Review = require('../models/Review');

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
      'produtor.validado': false
    })
      .select('nome email produtor createdAt')
      .sort({ createdAt: 1 });

    return res.status(200).json(produtores);

  } catch (err) {
    next(err);
  }
});


// PATCH /api/admin/produtores/:id/validacao  { aprovado: true|false }  -> 200

router.patch('/produtores/:id/validacao', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { aprovado } = req.body || {};

    // 1. Validar o identificador do produtor
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    // 2. Validar o valor recebido
    if (typeof aprovado !== 'boolean') {
      return res.status(400).json({
        erro: 'O campo aprovado deve ser true ou false'
      });
    }

    // 3. Procurar o produtor
    const produtor = await User.findOne({
      _id: id,
      papel: 'produtor'
    });

    if (!produtor) {
      return res.status(404).json({
        erro: 'Produtor não encontrado'
      });
    }

    // 4. Atualizar o estado de validação
    produtor.produtor.validado = aprovado;

    await produtor.save();

    // 5. Devolver o produtor atualizado
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
      denuncias: { $gt: 0 }
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
      { $set: { visivel } },
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


module.exports = router;
