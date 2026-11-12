// Passo 6: autenticação JWT e autorização com o papel atual do utilizador.
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = (...papeis) => async (req, res, next) => {
  const autorizacao = req.headers.authorization || '';
  const partes = autorizacao.split(' ');

  if (
    partes.length !== 2 ||
    partes[0] !== 'Bearer' ||
    !partes[1]
  ) {
    return res.status(401).json({
      erro: 'Token inválido ou em falta'
    });
  }

  try {
    const dadosToken = jwt.verify(partes[1], process.env.JWT_SECRET);

    if (!dadosToken.id) {
      return res.status(401).json({
        erro: 'Token inválido'
      });
    }

    const utilizador = await User.findById(dadosToken.id);

    if (!utilizador) {
      return res.status(401).json({
        erro: 'Utilizador não encontrado ou sessão inválida'
      });
    }

    req.user = {
      id: utilizador._id.toString(),
      papel: utilizador.papel
    };

    if (papeis.length && !papeis.includes(utilizador.papel)) {
      return res.status(403).json({
        erro: 'Sem permissão'
      });
    }

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' ||
        err.name === 'TokenExpiredError' ||
        err.name === 'NotBeforeError' ||
        err.name === 'CastError') {
      return res.status(401).json({
        erro: 'Token inválido ou expirado'
      });
    }

    next(err);
  }
};
