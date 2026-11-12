const router = require('express').Router();
const User = require('../models/User');
const porFazer = require('./_naoImplementado');
const { isValidObjectId } = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');

// GET /api/producers?localidade=
// Listar apenas produtores validados
router.get('/', async (req, res, next) => {
  try {
    const { localidade } = req.query;

    const filtro = {
      papel: 'produtor',
      'produtor.validado': true
    };

    // Filtrar por localidade, se indicada
    if (localidade) {
      const texto = String(localidade)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      filtro['produtor.localidade'] = {
        $regex: texto,
        $options: 'i'
      };
    }

    const produtores = await User.find(filtro)
      .select('nome email produtor.nomeExploracao produtor.descricao produtor.localidade produtor.localizacao')
      .sort({ nome: 1 });

    res.status(200).json(produtores);

  } catch (err) {
    next(err);
  }
});

// GET /api/producers/:id
// Implementaremos depois de testar a listagem

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validar o identificador
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    // Procurar apenas produtores aprovados
    const produtor = await User.findOne({
      _id: id,
      papel: 'produtor',
      'produtor.validado': true
    }).select(
      'nome produtor.nomeExploracao produtor.descricao ' +
      'produtor.localidade produtor.localizacao'
    );

    if (!produtor) {
      return res.status(404).json({
        erro: 'Produtor não encontrado'
      });
    }

    // Obter os produtos deste produtor
    const produtos = await Product.find({
      produtor: produtor._id
    }).sort({ createdAt: -1 });

    // Calcular a média das avaliações visíveis
    const avaliacoes = await Review.aggregate([
      {
        $match: {
          produtor: produtor._id,
          visivel: true
        }
      },
      {
        $group: {
          _id: null,
          media: { $avg: '$classificacao' },
          total: { $sum: 1 }
        }
      }
    ]);

    const avaliacaoMedia = avaliacoes.length
      ? Number(avaliacoes[0].media.toFixed(2))
      : null;

    res.status(200).json({
      produtor,
      produtos,
      avaliacaoMedia
    });

  } catch (err) {
    next(err);
  }
});


module.exports = router;
