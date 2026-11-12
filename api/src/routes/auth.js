// Passo 6: registo e login
const router = require('express').Router();
const bcrypt = require('bcryptjs'); // eslint-disable-line no-unused-vars
const jwt = require('jsonwebtoken'); // eslint-disable-line no-unused-vars
const User = require('../models/User'); // eslint-disable-line no-unused-vars
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');

// POST /api/auth/registo  -> 201 { id }
// TODO: validar dados, fazer hash da password com bcrypt (custo 12) e criar o utilizador.
//       Um produtor fica com produtor.validado = false até o administrador aprovar.
router.post('/registo', porFazer('Registar utilizador (comprador ou produtor)'));

// POST /api/auth/login  -> 200 { token, utilizador }
// TODO: procurar pelo email (com .select('+passwordHash')), comparar com bcrypt.compare
//       e devolver um JWT com { id, papel } assinado com process.env.JWT_SECRET.

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validar os campos obrigatórios
    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        erro: 'Email e password são obrigatórios'
      });
    }

    // Procurar o utilizador, incluindo o hash da password
    const utilizador = await User.findOne({
      email: email.trim().toLowerCase()
    }).select('+passwordHash');

    if (!utilizador) {
      return res.status(401).json({
        erro: 'Credenciais inválidas'
      });
    }

    // Verificar a password
    const passwordCorreta = await bcrypt.compare(
      password,
      utilizador.passwordHash
    );

    if (!passwordCorreta) {
      return res.status(401).json({
        erro: 'Credenciais inválidas'
      });
    }

    // Gerar o token JWT
    const token = jwt.sign(
      {
        id: utilizador._id.toString(),
        papel: utilizador.papel
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '2h'
      }
    );

    // Devolver apenas os dados públicos necessários
    res.status(200).json({
      token,
      utilizador: {
        _id: utilizador._id,
        nome: utilizador.nome,
        email: utilizador.email,
        papel: utilizador.papel,
        produtor: utilizador.produtor
      }
    });

  } catch (err) {
    next(err);
  }
});


// GET /api/auth/eu  -> 200 dados do utilizador autenticado
router.get('/eu', auth(), porFazer('Devolver o utilizador autenticado'));

module.exports = router;
