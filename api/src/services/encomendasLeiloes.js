const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Order = require('../models/Order');

// Criar uma encomenda para o vencedor de um leilão terminado.
// O índice único em Order.leilao impede encomendas duplicadas.
async function criarEncomendaVencedor(leilaoId) {
  if (!mongoose.isValidObjectId(leilaoId)) {
    throw new Error('Identificador de leilão inválido');
  }

  const leilao = await Auction.findById(leilaoId);

  if (!leilao) {
    throw new Error('Leilão não encontrado');
  }

  if (
    leilao.estado !== 'terminado' ||
    leilao.terminaEm > new Date()
  ) {
    throw new Error('O leilão ainda não terminou');
  }

  const compradorId = leilao.licitacaoAtual?.comprador;

  // Um leilão sem licitações não tem vencedor.
  if (!compradorId) {
    return { encomenda: null, criada: false };
  }

  // Verificar se a encomenda já foi criada anteriormente.
  const existente = await Order.findOne({
    leilao: leilao._id
  });

  if (existente) {
    return { encomenda: existente, criada: false };
  }

  const dados = {
    comprador: compradorId,
    produtor: leilao.produtor,

    linhas: [{
      ...(leilao.produto
        ? { produto: leilao.produto }
        : {}),
      nome: `Lote: ${leilao.lote}`,
      precoUnit: leilao.licitacaoAtual.valor,
      quantidade: 1
    }],

    estado: 'confirmada',

    entrega: {
      tipo: 'levantamento'
    },

    origem: 'leilao',
    leilao: leilao._id
  };

  try {
    const encomenda = await Order.create(dados);

    return { encomenda, criada: true };
  } catch (erro) {
    // Se outro processo criou a encomenda ao mesmo tempo,
    // recuperar o documento existente em vez de duplicar.
    if (
      erro.code === 11000 &&
      erro.keyPattern?.leilao
    ) {
      const encomenda = await Order.findOne({
        leilao: leilao._id
      });

      if (encomenda) {
        return { encomenda, criada: false };
      }
    }

    throw erro;
  }
}

module.exports = { criarEncomendaVencedor };
