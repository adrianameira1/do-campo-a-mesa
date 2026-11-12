// Passo 6: registo e login
const router = require('express').Router();
const bcrypt = require('bcryptjs'); // eslint-disable-line no-unused-vars
const jwt = require('jsonwebtoken'); // eslint-disable-line no-unused-vars
const User = require('../models/User'); // eslint-disable-line no-unused-vars
const auth = require('../middleware/auth');

// POST /api/auth/registo  -> 201 { id }
router.post('/registo', async (req, res, next) => {
  try {
    const {
      nome,
      email,
      password,
      papel = 'comprador',
      produtor
    } = req.body || {};

    // Validar os campos obrigatórios
    if (
      typeof nome !== 'string' ||
      !nome.trim() ||
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return res.status(400).json({
        erro: 'Nome, email válido e password com pelo menos 8 caracteres são obrigatórios'
      });
    }

    // Impedir o registo público de administradores
    if (!['comprador', 'produtor'].includes(papel)) {
      return res.status(400).json({
        erro: 'Tipo de conta inválido'
      });
    }

    // Validar dados específicos dos produtores
    if (
      papel === 'produtor' &&
      (
        !produtor ||
        typeof produtor.nomeExploracao !== 'string' ||
        !produtor.nomeExploracao.trim() ||
        typeof produtor.localidade !== 'string' ||
        !produtor.localidade.trim()
      )
    ) {
      return res.status(400).json({
        erro: 'Nome da exploração e localidade são obrigatórios para produtores'
      });
    }

    const emailNormalizado = email.trim().toLowerCase();

    // Confirmar se já existe um utilizador com este email
    const existente = await User.exists({
      email: emailNormalizado
    });

    if (existente) {
      return res.status(409).json({
        erro: 'Este email já está registado'
      });
    }

    // Nunca guardar a password em texto simples
    const passwordHash = await bcrypt.hash(password, 12);

    const dadosUtilizador = {
      nome: nome.trim(),
      email: emailNormalizado,
      passwordHash,
      papel
    };

    if (papel === 'produtor') {
      dadosUtilizador.produtor = {
        nomeExploracao: produtor.nomeExploracao.trim(),
        localidade: produtor.localidade.trim(),
        validado: false
      };
    }

    const utilizador = await User.create(dadosUtilizador);

    return res.status(201).json({
      id: utilizador._id
    });

  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login  -> 200 { token, utilizador }

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
router.get('/eu', auth(), async (req, res, next) => {
  try {
    const utilizador = await User.findById(req.user.id);

    if (!utilizador) {
      return res.status(401).json({
        erro: 'Utilizador não encontrado ou sessão inválida'
      });
    }

    return res.status(200).json({
      _id: utilizador._id,
      nome: utilizador.nome,
      email: utilizador.email,
      papel: utilizador.papel,
      produtor: utilizador.produtor
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
