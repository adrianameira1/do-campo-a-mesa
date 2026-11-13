// Passo 7: leilões em tempo real
// Eventos do cliente:   'entrar' (leilaoId), 'sair' (leilaoId), 'licitar' ({ leilaoId, valor })
// Eventos do servidor:  'estado' (leilão), 'presenca' (n.º), 'nova-licitacao', 'recusada' (mensagem)
const Auction = require('../models/Auction'); // eslint-disable-line no-unused-vars
const { registarLicitacao } = require('../services/licitacoes');

const sala = (leilaoId) => `leilao:${leilaoId}`;

function emitirPresenca(io, leilaoId) {
  const n = io.sockets.adapter.rooms.get(sala(leilaoId))?.size ?? 0;
  io.to(sala(leilaoId)).emit('presenca', n);
}

module.exports = (io, socket) => {
  // Responder com a hora oficial do servidor.
  socket.on('sincronizar-hora', (responder) => {
    if (typeof responder === 'function') {
      responder({ agora: Date.now() });
    }
  });

  socket.on('entrar', async (leilaoId) => {
    try {
      // Validar o identificador antes de entrar na sala
      if (!require('mongoose').isValidObjectId(leilaoId)) {
        return socket.emit('recusada', 'Identificador de leilão inválido');
      }

      const leilao = await Auction.findById(leilaoId);

      if (!leilao) {
        return socket.emit('recusada', 'Leilão não encontrado');
      }

      // Evitar entrar novamente na mesma sala
      socket.join(sala(leilaoId));

      // Enviar ao participante o estado atual do leilão
      socket.emit('estado', leilao);

      // Informar todos os participantes da presença atual
      emitirPresenca(io, leilaoId);

    } catch (err) {
      console.error('Erro ao entrar no leilão:', err);
      socket.emit('recusada', 'Não foi possível entrar no leilão');
    }
  });

  socket.on('sair', (leilaoId) => {
    socket.leave(sala(leilaoId));
    emitirPresenca(io, leilaoId);
  });

  socket.on('licitar', async (dados) => {
    try {
      if (!dados || typeof dados !== 'object') {
        return socket.emit('recusada', 'Dados da licitação inválidos');
      }

      const { leilaoId, valor } = dados;

      // Só permitir licitações de participantes da sala.
      if (
        typeof leilaoId !== 'string' ||
        !socket.rooms.has(sala(leilaoId))
      ) {
        return socket.emit(
          'recusada',
          'É necessário entrar na sala do leilão'
        );
      }

      // Validar e guardar na mesma transação MongoDB.
      const { leilao, licitacao } = await registarLicitacao({
        leilaoId,
        compradorId: socket.user.id,
        valor
      });

      // Emitir apenas depois da transação ser confirmada.
      io.to(sala(leilaoId)).emit('nova-licitacao', {
        leilaoId: leilao._id.toString(),
        licitacaoId: licitacao._id.toString(),
        comprador: socket.user.id,
        valor: licitacao.valor,
        terminaEm: leilao.terminaEm
      });

    } catch (err) {
      if (err.licitacaoRecusada) {
        return socket.emit('recusada', err.message);
      }

      console.error('Erro ao registar licitação:', err);

      socket.emit(
        'recusada',
        'Não foi possível processar a licitação'
      );
    }
  });

  // Atualizar a presença quando o utilizador fecha a página
  socket.on('disconnecting', () => {
    for (const s of socket.rooms) {
      if (s.startsWith('leilao:')) {
        setImmediate(() => emitirPresenca(io, s.slice('leilao:'.length)));
      }
    }
  });

  // TODO: fechar os leilões expirados (estado 'terminado') e avisar a sala e o vencedor
};
