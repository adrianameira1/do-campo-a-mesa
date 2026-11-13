// Encomendas
const router = require('express').Router();
const auth = require('../middleware/auth');
const { isValidObjectId } = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// POST /api/orders  (comprador)  -> 201


router.post('/', auth('comprador'), async (req, res, next) => {
  let session;

  try {
    const { linhas, entrega } = req.body || {};
    const tipoEntrega = entrega?.tipo ?? 'levantamento';

    // Validar o carrinho
    if (!Array.isArray(linhas) || linhas.length === 0) {
      return res.status(400).json({
        erro: 'A encomenda deve conter produtos'
      });
    }

    // Validar os dados de entrega
    if (
      entrega !== undefined &&
      (
        !entrega ||
        typeof entrega !== 'object' ||
        Array.isArray(entrega) ||
        !['levantamento', 'entrega'].includes(tipoEntrega)
        ||
        (
          tipoEntrega === 'entrega' &&
          (
            typeof entrega.morada !== 'string' ||
            !entrega.morada.trim()
          )
        )
      )
    ) {
      return res.status(400).json({
        erro: 'Dados de entrega inválidos'
      });
    }

    // Agrupar produtos repetidos e validar quantidades
    const quantidades = new Map();

    for (const linha of linhas) {
      if (
        !linha ||
        !mongoose.isValidObjectId(linha.produto) ||
        !Number.isSafeInteger(linha.quantidade) ||
        linha.quantidade < 1
      ) {
        return res.status(400).json({
          erro: 'Produto ou quantidade inválida'
        });
      }

      const id = String(linha.produto).toLowerCase();

      const total = (quantidades.get(id) || 0) +
        linha.quantidade;

      if (!Number.isSafeInteger(total)) {
        return res.status(400).json({
          erro: 'Quantidade inválida'
        });
      }

      quantidades.set(id, total);
    }

    session = await mongoose.startSession();

    // Todas as alterações são executadas na mesma transação
    const encomendas = await session.withTransaction(async () => {
      const grupos = new Map();

      for (const [id, quantidade] of quantidades) {
        // Reservar stock de forma atómica
        // Reservar stock apenas de produtos visíveis
        const produto = await Product.findOneAndUpdate(
          {
            _id: id,
            visivel: { $ne: false },
            stock: { $gte: quantidade }
          },
          {
            $inc: { stock: -quantidade }
          },
          {
            new: true,
            session
          }
        );


        if (!produto) {
          const existente = await Product.findById(id)
            .select('visivel stock')
            .session(session);

          let mensagem;
          let estadoHTTP;

          if (!existente) {
            mensagem = 'Produto não encontrado';
            estadoHTTP = 404;
          } else if (existente.visivel === false) {
            mensagem = 'Produto indisponível para compra';
            estadoHTTP = 409;
          } else {
            mensagem = 'Stock insuficiente';
            estadoHTTP = 409;
          }

          const erro = new Error(mensagem);
          erro.status = estadoHTTP;
          throw erro;
        }


        const produtorId = String(produto.produtor);

        if (!grupos.has(produtorId)) {
          grupos.set(produtorId, []);
        }

        grupos.get(produtorId).push({
          produto: produto._id,
          nome: produto.nome,
          precoUnit: produto.preco,
          quantidade
        });
      }

      // Preparar uma encomenda por produtor
      const documentos = [];

      for (const [produtorId, linhasProdutor] of grupos) {
        documentos.push({
          comprador: req.user.id,
          produtor: produtorId,
          linhas: linhasProdutor,
          estado: 'pendente',
          entrega: {
            tipo: tipoEntrega,
            ...(tipoEntrega === 'entrega'
              ? { morada: entrega.morada.trim() }
              : {})
          }
        });
      }

      // Criar as encomendas dentro da transação
      return await Order.create(documentos, {
        session,
        ordered: true
      });
    });

    // As encomendas já foram confirmadas no MongoDB.
    // Avisar cada produtor através da sua sala pessoal.
    const io = req.app.get('io');

    for (const encomenda of encomendas) {
      io?.to(`user:${encomenda.produtor}`).emit('nova-encomenda', {
        id: encomenda._id.toString(),
        total: encomenda.total,
        origem: 'loja'
      });
    }

    res.status(201).json(encomendas);

  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        erro: err.message
      });
    }

    next(err);

  } finally {
    if (session) {
      await session.endSession();
    }
  }
});



// GET /api/orders  -> 200 [encomendas do utilizador: como comprador ou como produtor]

router.get('/', auth(), async (req, res, next) => {
  try {
    let filtro;

    if (req.user.papel === 'comprador') {
      filtro = { comprador: req.user.id };
    } else if (req.user.papel === 'produtor') {
      filtro = { produtor: req.user.id };
    } else {
      return res.status(403).json({
        erro: 'Sem permissão'
      });
    }

    const encomendas = await Order.find(filtro)
      .sort({ createdAt: -1 })
      .populate('comprador', 'nome email')
      .populate(
        'produtor',
        'nome produtor.nomeExploracao'
      );

    res.status(200).json(encomendas);

  } catch (err) {
    next(err);
  }
});


// GET /api/orders/:id  -> 200 | 404

router.get('/:id', auth(), async (req, res, next) => {
  try {
    // Permitir acesso apenas ao comprador ou produtor da encomenda
    let filtro;

    if (req.user.papel === 'comprador') {
      filtro = {
        _id: req.params.id,
        comprador: req.user.id
      };
    } else if (req.user.papel === 'produtor') {
      filtro = {
        _id: req.params.id,
        produtor: req.user.id
      };
    } else {
      return res.status(403).json({
        erro: 'Sem permissão'
      });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        erro: 'Identificador de encomenda inválido'
      });
    }

    const encomenda = await Order.findOne(filtro)
      .populate('comprador', 'nome email')
      .populate('produtor', 'nome produtor.nomeExploracao');

    if (!encomenda) {
      return res.status(404).json({
        erro: 'Encomenda não encontrada'
      });
    }

    res.status(200).json(encomenda);

  } catch (err) {
    next(err);
  }
});


// PATCH /api/orders/:id/estado  (produtor)  -> 200
router.patch('/:id/estado', auth('produtor'), async (req, res, next) => {
  try {
    const { estado } = req.body || {};
    const estados = Order.ESTADOS;
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        erro: 'Identificador de encomenda inválido'
      });
    }

    if (!estados.includes(estado)) {
      return res.status(400).json({
        erro: 'Estado inválido'
      });
    }

    // Só o produtor associado pode alterar a encomenda
    const encomenda = await Order.findOne({
      _id: req.params.id,
      produtor: req.user.id
    });

    if (!encomenda) {
      return res.status(404).json({
        erro: 'Encomenda não encontrada'
      });
    }

    const indiceAtual = estados.indexOf(encomenda.estado);
    const indiceNovo = estados.indexOf(estado);

    // Permitir apenas a transição para o estado seguinte
    if (indiceNovo !== indiceAtual + 1) {
      return res.status(409).json({
        erro: 'Transição de estado não permitida'
      });
    }

    // Atualização condicional para evitar alterações concorrentes
    const atualizada = await Order.findOneAndUpdate(
      {
        _id: encomenda._id,
        produtor: req.user.id,
        estado: encomenda.estado
      },
      {
        $set: { estado }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!atualizada) {
      return res.status(409).json({
        erro: 'O estado da encomenda foi alterado entretanto'
      });
    }

    // Informar o comprador apenas após a atualização na BD.
    req.app.get('io')?.to(`user:${atualizada.comprador}`).emit(
      'encomenda-atualizada',
      {
        id: atualizada._id.toString(),
        estado: atualizada.estado,
        produtor: req.user.nome || 'O produtor'
      }
    );

    res.status(200).json(atualizada);

  } catch (err) {
    next(err);
  }
});


module.exports = router;
