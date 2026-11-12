// Leilões (a parte REST; as licitações em direto são feitas por Socket.io)
const router = require('express').Router();
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');
const { isValidObjectId } = require('mongoose');

// GET /api/auctions?estado=ativo  -> 200 [leilões]

router.get('/', async (req, res, next) => {
  try {
    const { estado } = req.query;

    const estadosPermitidos = [
      'agendado',
      'ativo',
      'terminado'
    ];

    // Validar o filtro de estado
    if (estado && !estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        erro: 'Estado de leilão inválido'
      });
    }

    const filtro = {};

    if (estado) {
      filtro.estado = estado;
    }

    const leiloes = await Auction.find(filtro)
      .populate(
        'produtor',
        'nome produtor.nomeExploracao produtor.localidade'
      )
      .populate(
        'produto',
        'nome categoria preco imagemUrl'
      )
      .sort({ iniciaEm: -1 });

    res.status(200).json(leiloes);

  } catch (err) {
    next(err);
  }
});


// GET /api/auctions/:id  -> 200 leilão + últimas licitações

router.get('/:id', async (req, res, next) => {
  try {
    const leilao = await Auction.findById(req.params.id)
      .populate(
        'produtor',
        'nome produtor.nomeExploracao produtor.localidade'
      )
      .populate(
        'produto',
        'nome categoria preco imagemUrl'
      );

    if (!leilao) {
      return res.status(404).json({
        erro: 'Leilão não encontrado'
      });
    }

    // Obter as 10 licitações mais recentes
    const licitacoes = await Bid.find({
      leilao: leilao._id
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('comprador', 'nome');

    res.status(200).json({
      leilao,
      licitacoes
    });

  } catch (err) {
    next(err);
  }
});


// POST /api/auctions  (produtor)  -> 201
// TODO: definir licitacaoAtual.valor = precoBase e terminaEm = iniciaEm + duração

router.post('/', auth('produtor'), async (req, res, next) => {
  try {
    const {
      produto,
      lote,
      quantidade,
      precoBase,
      incremento,
      iniciaEm,
      duracaoMinutos
    } = req.body || {};

    // Confirmar que o produtor foi aprovado
    const produtor = await User.findOne({
      _id: req.user.id,
      papel: 'produtor',
      'produtor.validado': true
    });

    if (!produtor) {
      return res.status(403).json({
        erro: 'Produtor não validado'
      });
    }

    // Validar os dados obrigatórios
    const inicio = new Date(iniciaEm);
    const preco = Number(precoBase);
    const passo = Number(incremento);
    const duracao = Number(duracaoMinutos);

    if (
      typeof lote !== 'string' ||
      !lote.trim() ||
      precoBase === undefined ||
      precoBase === null ||
      !Number.isFinite(preco) ||
      preco < 0 ||
      incremento === undefined ||
      incremento === null ||
      !Number.isFinite(passo) ||
      passo < 0.01 ||
      !iniciaEm ||
      Number.isNaN(inicio.getTime()) ||
      duracaoMinutos === undefined ||
      duracaoMinutos === null ||
      !Number.isSafeInteger(duracao) ||
      duracao <= 0
    ) {
      return res.status(400).json({
        erro: 'Dados do leilão inválidos'
      });
    }

    // Não permitir datas de início no passado
    if (inicio.getTime() <= Date.now()) {
      return res.status(400).json({
        erro: 'A data de início deve ser futura'
      });
    }

    // Impedir associar produtos de outros produtores
    if (produto !== undefined && produto !== null && produto !== '') {
      if (!isValidObjectId(produto)) {
        return res.status(400).json({
          erro: 'Identificador de produto inválido'
        });
      }

      const Product = require('../models/Product');

      const pertenceAoProdutor = await Product.exists({
        _id: produto,
        produtor: req.user.id
      });

      if (!pertenceAoProdutor) {
        return res.status(404).json({
          erro: 'Produto não encontrado'
        });
      }
    }

    // Calcular automaticamente a data de fim
    const terminaEm = new Date(
      inicio.getTime() + duracao * 60 * 1000
    );

    if (Number.isNaN(terminaEm.getTime())) {
      return res.status(400).json({
        erro: 'Duração do leilão inválida'
      });
    }

    // Criar o leilão
    const leilao = await Auction.create({
      produtor: req.user.id,
      produto: produto || undefined,
      lote: lote.trim(),
      quantidade,
      precoBase: preco,
      incremento: passo,
      licitacaoAtual: {
        valor: preco
      },
      iniciaEm: inicio,
      terminaEm,
      estado: 'agendado'
    });

    res
      .status(201)
      .location(`/api/auctions/${leilao._id}`)
      .json(leilao);

  } catch (err) {
    next(err);
  }
});


// GET /api/auctions/:id/bids  -> 200 [licitações]

router.get('/:id/bids', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validar o identificador do leilão
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    // Confirmar que o leilão existe
    const leilao = await Auction.findById(id);

    if (!leilao) {
      return res.status(404).json({
        erro: 'Leilão não encontrado'
      });
    }

    // Consultar as licitações por ordem decrescente
    const licitacoes = await Bid.find({
      leilao: leilao._id
    })
      .sort({ createdAt: -1, _id: -1 })
      .populate('comprador', 'nome');

    res.status(200).json(licitacoes);

  } catch (err) {
    next(err);
  }
});

module.exports = router;
