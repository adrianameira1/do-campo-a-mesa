const Auction = require('../models/Auction');
const { criarEncomendaVencedor } = require('./encomendasLeiloes');

// Recuperar encomendas de leilões terminados, incluindo após reinícios.
async function processarEncomendasPendentes(io) {
  const pendentes = await Auction.find({
    estado: 'terminado',
    'licitacaoAtual.comprador': { $type: 'objectId' },
    encomenda: { $exists: false }
  }).select('_id lote produtor licitacaoAtual');

  for (const leilao of pendentes) {
    try {
      const { encomenda, criada } = await criarEncomendaVencedor(
        leilao._id
      );

      if (!encomenda) continue;

      // Guardar a referência apenas depois de existir a encomenda.
      await Auction.updateOne(
        {
          _id: leilao._id,
          encomenda: { $exists: false }
        },
        {
          $set: { encomenda: encomenda._id }
        }
      );

      if (criada) {
        const leilaoId = leilao._id.toString();
        const encomendaId = encomenda._id.toString();
        const compradorId =
          leilao.licitacaoAtual.comprador.toString();
        const produtorId = leilao.produtor.toString();

        const valor = leilao.licitacaoAtual.valor;

        // Avisar exclusivamente o comprador vencedor.
        io.to(`user:${compradorId}`).emit('leilao-ganho', {
          leilaoId,
          lote: leilao.lote,
          valor,
          encomenda: encomendaId
        });

        // Informar o produtor do resultado do leilão.
        io.to(`user:${produtorId}`).emit('leilao-terminado', {
          leilaoId,
          lote: leilao.lote,
          valor,
          vencedor: compradorId,
          encomenda: encomendaId
        });

        // Informar o produtor da encomenda recebida.
        io.to(`user:${produtorId}`).emit('nova-encomenda', {
          id: encomendaId,
          total: encomenda.total,
          origem: 'leilao',
          leilaoId
        });

        console.log(
          `Encomenda ${encomendaId} criada e notificações emitidas`
        );
      }
    } catch (err) {
      // Um erro num leilão não impede a recuperação dos restantes.
      // O leilão permanece pendente para uma nova tentativa.
      console.error(
        `Erro ao criar encomenda do leilão ${leilao._id}:`,
        err
      );
    }
  }
}

// Atualizar automaticamente os estados dos leilões.
async function sincronizarEstadosLeiloes(io) {
  const agora = new Date();

  const transicoes = [
    {
      filtro: {
        estado: { $in: ['agendado', 'ativo'] },
        terminaEm: { $lte: agora }
      },
      novoEstado: 'terminado'
    },
    {
      filtro: {
        estado: 'agendado',
        iniciaEm: { $lte: agora },
        terminaEm: { $gt: agora }
      },
      novoEstado: 'ativo'
    }
  ];

  for (const { filtro, novoEstado } of transicoes) {
    while (true) {
      // A alteração de estado é atómica.
      const leilao = await Auction.findOneAndUpdate(
        filtro,
        { $set: { estado: novoEstado } },
        { new: true }
      );

      if (!leilao) break;


      const sala = `leilao:${leilao._id}`;

      // Comunicar o estado atualizado aos participantes.
      io.to(sala).emit('estado', leilao);

      // Informar os administradores quando um leilão
      // passa para ativo ou terminado.
      io.to('administradores').emit('leilao-atualizado', {
        id: leilao._id.toString(),
        estado: novoEstado,
        iniciaEm: leilao.iniciaEm,
        terminaEm: leilao.terminaEm
      });

      if (novoEstado === 'terminado') {
        io.to(sala).emit('leilao-terminado', {
          leilaoId: leilao._id.toString(),
          vencedor: leilao.licitacaoAtual?.comprador || null,
          valor: leilao.licitacaoAtual?.valor ?? leilao.precoBase
        });
      }

      console.log(
        `Leilão ${leilao._id}: ${novoEstado}`
      );
    }
  }

  // Criar ou recuperar encomendas após atualizar os estados.
  await processarEncomendasPendentes(io);
}

module.exports = sincronizarEstadosLeiloes;
