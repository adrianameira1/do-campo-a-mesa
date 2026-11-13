const router = require('express').Router();
const User = require('../models/User');
const porFazer = require('./_naoImplementado');
const { isValidObjectId } = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');
const auth = require('../middleware/auth');

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

/**
 * GET /api/producers/me
 * Consultar o perfil da própria exploração.
 */
router.get('/me', auth('produtor'), async (req, res, next) => {
  try {
    const utilizador = await User.findOne({
      _id: req.user.id,
      papel: 'produtor'
    }).select('nome email produtor');

    if (!utilizador) {
      return res.status(404).json({
        erro: 'Produtor não encontrado'
      });
    }

    return res.status(200).json(utilizador);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/producers/me
 * Atualizar o perfil da própria exploração.
 */
router.patch('/me', auth('produtor'), async (req, res, next) => {
  try {
    const dados = req.body || {};
    const permitidos = [
      'nomeExploracao',
      'descricao',
      'localidade',
      'localizacao'
    ];

    if (
      typeof dados !== 'object' ||
      Array.isArray(dados) ||
      Object.keys(dados).some(
        (campo) => !permitidos.includes(campo)
      )
    ) {
      return res.status(400).json({
        erro: 'Campos de atualização inválidos'
      });
    }

    const alteracoes = {};

    for (const campo of [
      'nomeExploracao',
      'descricao',
      'localidade'
    ]) {
      if (dados[campo] === undefined) continue;

      if (typeof dados[campo] !== 'string') {
        return res.status(400).json({
          erro: `${campo} deve ser texto`
        });
      }

      const valor = dados[campo].trim();

      if (
        campo !== 'descricao' &&
        valor.length === 0
      ) {
        return res.status(400).json({
          erro: `${campo} é obrigatório`
        });
      }

      const limite = campo === 'descricao' ? 1000 : 150;

      if (valor.length > limite) {
        return res.status(400).json({
          erro: `${campo} excede ${limite} caracteres`
        });
      }

      alteracoes[`produtor.${campo}`] = valor;
    }

    if (dados.localizacao !== undefined) {
      const { localizacao } = dados;

      if (
        localizacao === null ||
        typeof localizacao !== 'object' ||
        Array.isArray(localizacao) ||
        Object.keys(localizacao).some(
          (campo) => !['lat', 'lng'].includes(campo)
        )
      ) {
        return res.status(400).json({
          erro: 'Localização inválida'
        });
      }

      const lat = localizacao.lat;
      const lng = localizacao.lng;

      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return res.status(400).json({
          erro: 'Coordenadas inválidas'
        });
      }

      alteracoes['produtor.localizacao'] = { lat, lng };
    }

    if (Object.keys(alteracoes).length === 0) {
      return res.status(400).json({
        erro: 'Não foram enviadas alterações'
      });
    }

    const produtor = await User.findOneAndUpdate(
      {
        _id: req.user.id,
        papel: 'produtor'
      },
      { $set: alteracoes },
      {
        new: true,
        runValidators: true
      }
    ).select('nome email produtor');

    if (!produtor) {
      return res.status(404).json({
        erro: 'Produtor não encontrado'
      });
    }

    return res.status(200).json(produtor);
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
      produtor: produtor._id,
      visivel: { $ne: false }
    })


    // Obter apenas avaliações visíveis dirigidas ao produtor
    const filtroAvaliacoes = {
      produtor: produtor._id,
      tipo: 'produtor',
      visivel: true
    };

    // Consultar a média e as avaliações individuais
    const [resumoAvaliacoes, avaliacoes] = await Promise.all([

      Review.aggregate([
        {
          $match: filtroAvaliacoes
        },
        {
          $group: {
            _id: null,
            media: { $avg: '$classificacao' },
            total: { $sum: 1 }
          }
        }
      ]),

      Review.find(filtroAvaliacoes)
        .select('autor classificacao comentario createdAt')
        .populate('autor', 'nome')
        .sort({ createdAt: -1 })
        .lean()

    ]);


    const avaliacaoMedia = resumoAvaliacoes.length
      ? Number(resumoAvaliacoes[0].media.toFixed(2))
      : null;

    res.status(200).json({
      produtor,
      produtos,
      avaliacaoMedia,
      totalAvaliacoes: resumoAvaliacoes.length
        ? resumoAvaliacoes[0].total
        : 0,
      avaliacoes
    });

  } catch (err) {
    next(err);
  }
});


module.exports = router;
