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
      localidade,
      categoria,
      precoMax,
      bio,
      epoca,
      produtor,
      ordenar
    } = req.query;

    const filtro = {
      visivel: { $ne: false }
    };

    // Pesquisa pelo nome do produto, ingrediente ou produtor
    if (typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escaparRegex(q.trim()), 'i');

      const produtoresEncontrados = await User.find({
        papel: 'produtor',
        'produtor.validado': true,
        $or: [
          { nome: regex },
          { 'produtor.nomeExploracao': regex }
        ]
      }).distinct('_id');

      filtro.$or = [
        { nome: regex },
        { ingredientes: regex },
        { produtor: { $in: produtoresEncontrados } }
      ];
    }

    // Filtrar produtos pela localidade do produtor.
    if (localidade !== undefined) {
      if (typeof localidade !== 'string' || localidade.length > 100) {
        return res.status(400).json({
          erro: 'Localidade inválida'
        });
      }

      const termo = localidade.trim();

      if (termo) {
        const produtoresLocais = await User.find({
          papel: 'produtor',
          'produtor.validado': true,
          'produtor.localidade': {
            $regex: escaparRegex(termo),
            $options: 'i'
          }
        }).distinct('_id');

        // Combinar com os outros filtros existentes.
        filtro.$and = [
          { produtor: { $in: produtoresLocais } }
        ];
      }
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

/**
 * GET /api/products/mine
 * Consultar os produtos do produtor autenticado,
 * incluindo os ocultados pela administração.
 */
router.get('/mine', auth('produtor'), async (req, res, next) => {
  console.log('ENTROU EM PRODUCTS/MINE');
  console.log('ID AUTENTICADO:', req.user?.id);

  try {
    const produtos = await Product.find({
      produtor: req.user.id
    })
      .sort({ createdAt: -1 })
      .populate(
        'produtor',
        'nome produtor.nomeExploracao produtor.localidade'
      );

    return res.status(200).json(produtos);
  } catch (err) {
    next(err);
  }
});


// GET /api/products/:id  -> 200 | 404

router.get('/:id', async (req, res, next) => {
  try {
    const produto = await Product.findOne({
      _id: req.params.id,
      visivel: { $ne: false }
    })
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
      descricao,
      ingredientes,
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
      descricao,
      ingredientes,
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
    // Apenas produtores aprovados podem gerir o catálogo
    const produtor = await User.findOne({
      _id: req.user.id,
      papel: 'produtor',
      'produtor.validado': true
    });

    if (!produtor) {
      return res.status(403).json({
        erro: 'Produtor não validado'
      });
    }

    // Campos que podem ser atualizados
    const camposPermitidos = [
      'nome',
      'descricao',
      'ingredientes',
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
    // Apenas produtores aprovados podem gerir o catálogo
    const produtor = await User.findOne({
      _id: req.user.id,
      papel: 'produtor',
      'produtor.validado': true
    });

    if (!produtor) {
      return res.status(403).json({
        erro: 'Produtor não validado'
      });
    }

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
