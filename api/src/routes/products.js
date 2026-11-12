// Passo 3: recurso /api/products
const router = require('express').Router();
const multer = require('multer');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');
const User = require('../models/User');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/products?q=&categoria=&precoMax=&bio=&epoca=  -> 200 [produtos]



const escaparRegex = (texto) =>
  texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


const ORDENACAO = {
  recentes: { createdAt: -1 },
  preco_asc: { preco: 1 },
  preco_desc: { preco: -1 }
};

// GET /api/products - pesquisa, filtros e ordenação
router.get('/', async (req, res, next) => {
  try {
    const {
      q,
      categoria,
      precoMax,
      bio,
      epoca,
      produtor,
      ordenar
    } = req.query;

    const filtro = {};

    // Pesquisa pelo nome
    if (q) {
      filtro.nome = {
        $regex: escaparRegex(String(q)),
        $options: 'i'
      };
    }

    // Categoria
    if (categoria && categoria !== 'Todos') {
      filtro.categoria = categoria;
    }

    // Preço máximo
    if (precoMax !== undefined && precoMax !== '') {
      const valor = Number(precoMax);

      if (!Number.isFinite(valor) || valor < 0) {
        return res.status(400).json({
          erro: 'Preço máximo inválido'
        });
      }

      filtro.preco = { $lte: valor };
    }

    // Produtos biológicos
    if (bio === 'true') {
      filtro.biologico = true;
    }

    // Época do ano
    if (epoca) {
      filtro.epocas = { $in: [epoca] };
    }

    // Produtor
    if (produtor) {
      filtro.produtor = produtor;
    }

    // Consultar a base de dados
    const lista = await Product.find(filtro)
      .sort(ORDENACAO[ordenar] || ORDENACAO.recentes)
      .populate(
        'produtor',
        'nome produtor.localidade produtor.nomeExploracao'
      );

    res.json(lista);

  } catch (err) {
    next(err);
  }
});


// GET /api/products/:id  -> 200 | 404

router.get('/:id', async (req, res, next) => {
  try {
    const produto = await Product.findById(req.params.id)
      .populate(
        'produtor',
        'nome produtor.localidade produtor.nomeExploracao'
      );

    if (!produto) {
      return res.status(404).json({
        erro: 'Produto não encontrado'
      });
    }

    res.json(produto);
  } catch (err) {
    next(err);
  }
});


// POST /api/products  (produtor)  -> 201 + Location

router.post('/', auth('produtor'), async (req, res, next) => {
  try {
    // Confirmar que o produtor existe e está validado
    const produtor = await User.findById(req.user.id);

    if (!produtor || produtor.papel !== 'produtor') {
      return res.status(403).json({
        erro: 'Utilizador não é produtor'
      });
    }

    if (!produtor.produtor?.validado) {
      return res.status(403).json({
        erro: 'Produtor ainda não validado pelo administrador'
      });
    }

    // Apenas campos permitidos podem vir do pedido
    const {
      nome,
      categoria,
      preco,
      unidade,
      stock,
      biologico,
      epocas
    } = req.body;

    const produto = await Product.create({
      produtor: produtor._id,
      nome,
      categoria,
      preco,
      unidade,
      stock,
      biologico,
      epocas
    });

    // Devolver 201 Created e o endereço do novo recurso
    res
      .status(201)
      .location(`/api/products/${produto._id}`)
      .json(produto);

  } catch (err) {
    next(err);
  }
});


// PUT /api/products/:id  (produtor dono)  -> 200 | 404

router.put('/:id', auth('produtor'), async (req, res, next) => {
  try {
    // Campos que podem ser atualizados
    const camposPermitidos = [
      'nome',
      'descricao',
      'categoria',
      'preco',
      'unidade',
      'stock',
      'biologico',
      'epocas'
    ];

    const dados = {};

    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        dados[campo] = req.body[campo];
      }
    }

    // Atualizar apenas se o produto pertencer ao produtor
    const produto = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        produtor: req.user.id
      },
      dados,
      {
        new: true,
        runValidators: true
      }
    );

    if (!produto) {
      return res.status(404).json({
        erro: 'Produto não encontrado'
      });
    }

    res.json(produto);

  } catch (err) {
    next(err);
  }
});


// DELETE /api/products/:id  (produtor dono)  -> 204 | 404

router.delete('/:id', auth('produtor'), async (req, res, next) => {
  try {
    // Eliminar apenas produtos do produtor autenticado
    const resultado = await Product.deleteOne({
      _id: req.params.id,
      produtor: req.user.id
    });

    if (!resultado.deletedCount) {
      return res.status(404).json({
        erro: 'Produto não encontrado'
      });
    }

    // Eliminação bem-sucedida, sem corpo na resposta
    res.status(204).end();

  } catch (err) {
    next(err);
  }
});


// POST /api/products/:id/imagem  (multipart, campo "imagem")  -> 200 { imagemUrl }
// TODO (Passo 8): usar services/imagens.js para enviar req.file para o storage da Cloud
router.post('/:id/imagem', auth('produtor'), upload.single('imagem'), porFazer('Upload da imagem do produto'));

module.exports = router;
