// Passo 7: autenticação dos sockets com JWT e dados atuais do MongoDB.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const registarLeiloes = require('./leiloes');

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (typeof token !== 'string' || !token) {
        return next(new Error('não autorizado'));
      }

      const dadosToken = jwt.verify(token, process.env.JWT_SECRET);

      if (!dadosToken.id) {
        return next(new Error('não autorizado'));
      }

      const utilizador = await User.findById(dadosToken.id);

      if (!utilizador) {
        return next(new Error('não autorizado'));
      }

      socket.user = {
        id: utilizador._id.toString(),
        papel: utilizador.papel
      };

      next();
    } catch (err) {
      if (
        err.name === 'JsonWebTokenError' ||
        err.name === 'TokenExpiredError' ||
        err.name === 'NotBeforeError' ||
        err.name === 'CastError'
      ) {
        return next(new Error('não autorizado'));
      }

      next(err);
    }
  });


  io.on('connection', (socket) => {
    // Sala pessoal do utilizador autenticado.
    socket.join(`user:${socket.user.id}`);

    // Sala exclusiva para administradores.
    if (socket.user.papel === 'admin') {
      socket.join('administradores');
    }

    // Eventos dos leilões.
    registarLeiloes(io, socket);
  });

};
