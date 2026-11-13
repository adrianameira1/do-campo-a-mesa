
// Leilões — API REST
// As licitações em direto são processadas através do Socket.io.

const router = require('express').Router();
const auth = require('../middleware/auth');

const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');
const Product = require('../models/Product');

const { isValidObjectId } = require('mongoose');

// Estados permitidos
const ESTADOS = ['agendado', 'ativo', 'terminado'];

// Converter valores numéricos recebidos pela API
function converterNumero(valor) {
  if (
    typeof valor !== 'number' &&
    typeof valor !== 'string'
  ) {
    return NaN;
  }

  if (typeof valor === 'string' && !valor.trim()) {
    return NaN;
  }

  return Number(
    typeof valor === 'string'
      ? valor.trim().replace(',', '.')
      : valor
  );
}


// GET /api/auctions?estado=ativo
// Listar leilões, opcionalmente filtrados por estado.

router.get('/', async (req, res, next) => {
  try {
    const { estado } = req.query;

    if (
      estado !== undefined &&
      !ESTADOS.includes(estado)
    ) {
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

    return res.status(200).json(leiloes);

  } catch (err) {
    next(err);
  }
});


// POST /api/auctions
// Criar um leilão (apenas produtores validados).

router.post('/', auth('produtor'), async (req, res, next) => {
  try {
    const {
      produto,
      lote,
      descricao,
      quantidade,
      precoBase,
      incremento,
      iniciaEm,
      duracaoMinutos
    } = req.body || {};

    // Confirmar que o produtor está aprovado.
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

    // Normalizar os dados.
    const loteTexto =
      typeof lote === 'string' ? lote.trim() : '';

    const descricaoTexto =
      typeof descricao === 'string'
        ? descricao.trim()
        : '';

    const quantidadeTexto =
      typeof quantidade === 'number' ||
      typeof quantidade === 'string'
        ? String(quantidade).trim()
        : '';

    const quantidadeMatch = quantidadeTexto.match(
      /^(\d+(?:[.,]\d+)?)(?:\s*[a-zA-ZÀ-ÿ].*)?$/
    );

    const quantidadeNumero = quantidadeMatch
      ? Number(quantidadeMatch[1].replace(',', '.'))
      : NaN;

    const preco = converterNumero(precoBase);
    const passo = converterNumero(incremento);
    const duracao = converterNumero(duracaoMinutos);

    const inicio = iniciaEm
      ? new Date(iniciaEm)
      : null;

    // Validar o lote.
    if (
      !loteTexto ||
      loteTexto.length > 150
    ) {
      return res.status(400).json({
        erro: 'O lote é obrigatório e não pode exceder 150 caracteres'
      });
    }

    // Validar a descrição (opcional).
    if (
      descricao !== undefined &&
      descricao !== null &&
      typeof descricao !== 'string'
    ) {
      return res.status(400).json({
        erro: 'Descrição inválida'
      });
    }

    if (descricaoTexto.length > 1000) {
      return res.status(400).json({
        erro: 'A descrição não pode exceder 1000 caracteres'
      });
    }

    // Validar a quantidade.
    if (
      !quantidadeTexto ||
      !Number.isFinite(quantidadeNumero) ||
      quantidadeNumero <= 0
    ) {
      return res.status(400).json({
        erro: 'A quantidade deve ser superior a zero'
      });
    }

    // Validar o preço base.
    if (
      !Number.isFinite(preco) ||
      preco < 0
    ) {
      return res.status(400).json({
        erro: 'Preço base inválido'
      });
    }

    // Validar o incremento mínimo.
    if (
      !Number.isFinite(passo) ||
      passo < 0.01
    ) {
      return res.status(400).json({
        erro: 'O incremento mínimo deve ser de pelo menos 0,01 €'
      });
    }

    // Validar a data de início.
    if (
      !inicio ||
      Number.isNaN(inicio.getTime())
    ) {
      return res.status(400).json({
        erro: 'Data de início inválida'
      });
    }

    if (inicio.getTime() <= Date.now()) {
      return res.status(400).json({
        erro: 'A data de início deve ser futura'
      });
    }

    // Validar a duração.
    if (
      !Number.isSafeInteger(duracao) ||
      duracao <= 0
    ) {
      return res.status(400).json({
        erro: 'A duração deve ser um número inteiro superior a zero'
      });
    }

    // Verificar se o produto pertence ao produtor.
    if (
      produto !== undefined &&
      produto !== null &&
      produto !== ''
    ) {
      if (!isValidObjectId(produto)) {
        return res.status(400).json({
          erro: 'Identificador de produto inválido'
        });
      }

      const pertenceAoProdutor = await Product.exists({
        _id: produto,
        produtor: req.user.id,
        visivel: { $ne: false }
      });

      if (!pertenceAoProdutor) {
        return res.status(404).json({
          erro: 'Produto não encontrado'
        });
      }
    }

    // Calcular automaticamente a data de término.
    const terminaEm = new Date(
      inicio.getTime() + duracao * 60 * 1000
    );

    if (
      Number.isNaN(terminaEm.getTime()) ||
      terminaEm <= inicio
    ) {
      return res.status(400).json({
        erro: 'Data de término inválida'
      });
    }

    // Criar o leilão.
    const leilao = await Auction.create({
      produtor: req.user.id,
      produto: produto || undefined,

      lote: loteTexto,
      descricao: descricaoTexto || undefined,
      quantidade: quantidadeTexto,

      precoBase: preco,
      incremento: passo,

      licitacaoAtual: {
        valor: preco
      },

      numLicitacoes: 0,

      iniciaEm: inicio,
      terminaEm,

      estado: 'agendado'
    });



    // Notificar apenas os administradores após guardar o leilão.
    const io = req.app.get('io');

    io?.to('administradores').emit('leilao-criado', {
      id: leilao._id.toString(),
      estado: leilao.estado,
      iniciaEm: leilao.iniciaEm,
      terminaEm: leilao.terminaEm
    });



    return res
      .status(201)
      .location(`/api/auctions/${leilao._id}`)
      .json(leilao);


  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auctions/mine
 * Lista os leilões criados pelo produtor autenticado.
 */
router.get('/mine', auth('produtor'), async (req, res, next) => {
  try {
    const leiloes = await Auction.find({
      produtor: req.user.id
    })
      .populate(
        'produto',
        'nome categoria preco imagemUrl'
      )
      .populate(
        'licitacaoAtual.comprador',
        'nome'
      )
      .populate(
        'encomenda',
        'estado origem linhas'
      )
      .sort({ iniciaEm: -1 });

    return res.status(200).json(leiloes);
  } catch (err) {
    next(err);
  }
});


// GET /api/auctions/:id/bids
// Consultar o histórico de licitações de um leilão.

router.get('/:id/bids', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    const leilao = await Auction.findById(id);

    if (!leilao) {
      return res.status(404).json({
        erro: 'Leilão não encontrado'
      });
    }

    const licitacoes = await Bid.find({
      leilao: leilao._id
    })
      .sort({ createdAt: -1, _id: -1 })
      .populate('comprador', 'nome');

    return res.status(200).json(licitacoes);

  } catch (err) {
    next(err);
  }
});


// GET /api/auctions/:id
// Consultar um leilão e as suas últimas 10 licitações.

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    const leilao = await Auction.findById(id)
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

    const licitacoes = await Bid.find({
      leilao: leilao._id
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(10)
      .populate('comprador', 'nome');

    return res.status(200).json({
      leilao,
      licitacoes
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
