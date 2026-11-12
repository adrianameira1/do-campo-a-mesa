// Encomendas
const router = require('express').Router();
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');
const { isValidObjectId } = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// POST /api/orders  (comprador)  -> 201
// TODO: copiar nome e preço de cada produto para as linhas e validar o stock


router.post('/', auth('comprador'), async (req, res, next) => {
  let session;

  try {
    const { linhas, entrega } = req.body || {};

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
        !['levantamento', 'entrega'].includes(
          entrega.tipo || 'levantamento'
        ) ||
        (
          entrega.tipo === 'entrega' &&
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
        const produto = await Product.findOneAndUpdate(
          {
            _id: id,
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
          const existe = await Product.exists({
            _id: id
          }).session(session);

          const erro = new Error(
            existe
              ? 'Stock insuficiente'
              : 'Produto não encontrado'
          );

          erro.status = existe ? 409 : 404;
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
          entrega: entrega || {
            tipo: 'levantamento'
          }
        });
      }

      // Criar as encomendas dentro da transação
        return await Order.create(documentos, {
        session,
        ordered: true
        });
    });

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
// TODO (Passo 7): depois de gravar, notificar o comprador em tempo real:
//   req.app.get('io').to(`user:${encomenda.comprador}`)
//     .emit('encomenda-atualizada', { id: encomenda._id, estado: encomenda.estado });

router.patch('/:id/estado', auth('produtor'), async (req, res, next) => {
  try {
    const { estado } = req.body || {};
    const estados = Order.ESTADOS;

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

    res.status(200).json(atualizada);

    // TODO (Passo 7): emitir evento Socket.io
    // 'encomenda-atualizada' para o comprador

  } catch (err) {
    next(err);
  }
});


module.exports = router;
