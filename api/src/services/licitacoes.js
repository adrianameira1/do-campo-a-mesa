
const mongoose = require('mongoose');

const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');

// Criar erro específico para licitações recusadas.
function recusar(mensagem) {
  const erro = new Error(mensagem);
  erro.licitacaoRecusada = true;
  return erro;
}

async function registarLicitacao({
  leilaoId,
  compradorId,
  valor
}) {

  // 1. Validar os identificadores.
  if (!mongoose.isValidObjectId(leilaoId)) {
    throw recusar('Identificador de leilão inválido');
  }

  if (!mongoose.isValidObjectId(compradorId)) {
    throw recusar('Identificador de comprador inválido');
  }

  // 2. Validar o valor da licitação.
  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    valor <= 0
  ) {
    throw recusar('Valor da licitação inválido');
  }

  // Aceitar apenas valores com até 2 casas decimais.
  const centimos = Math.round(valor * 100);

  if (
    !Number.isSafeInteger(centimos) ||
    Math.abs(valor * 100 - centimos) > 1e-7
  ) {
    throw recusar(
      'A licitação deve ter no máximo 2 casas decimais'
    );
  }

  const valorNormalizado = centimos / 100;

  // 3. Iniciar transação MongoDB.
  const session = await mongoose.startSession();

  try {
    let resultado;

    await session.withTransaction(async () => {

      // 4. Confirmar que o utilizador continua a ser comprador.
      const comprador = await User.findOne({
        _id: compradorId,
        papel: 'comprador'
      }).session(session);

      if (!comprador) {
        throw recusar(
          'Apenas compradores podem licitar'
        );
      }

      const agora = new Date();

      // 5. Atualização atómica do leilão.
      // Só aceita a licitação se cumprir todas as condições.
      const leilao = await Auction.findOneAndUpdate(
        {
          _id: leilaoId,

          estado: 'ativo',

          iniciaEm: {
            $lte: agora
          },

          terminaEm: {
            $gt: agora
          },

          // Validar o incremento mínimo.
          $expr: {
            $gte: [
              valorNormalizado,
              {
                $round: [
                  {
                    $add: [
                      {
                        $ifNull: [
                          '$licitacaoAtual.valor',
                          '$precoBase'
                        ]
                      },
                      '$incremento'
                    ]
                  },
                  2
                ]
              }
            ]
          }
        },

        {
          $set: {
            'licitacaoAtual.valor': valorNormalizado,
            'licitacaoAtual.comprador': compradorId,
            'licitacaoAtual.nome': comprador.nome,
            'licitacaoAtual.em': agora
          },

          $inc: {
            numLicitacoes: 1
          }
        },

        {
          new: true,
          session
        }
      );

      // Se nenhuma condição for satisfeita, recusar.
      if (!leilao) {
        throw recusar(
          'Leilão indisponível ou valor inferior ao mínimo permitido'
        );
      }

      // 6. Guardar o histórico da licitação.
      // A operação pertence à mesma transação.
      const [licitacao] = await Bid.create(
        [
          {
            leilao: leilao._id,
            comprador: compradorId,
            nome: comprador.nome,
            valor: valorNormalizado
          }
        ],
        {
          session
        }
      );

      // 7. Devolver o resultado atualizado.
      resultado = {
        leilao,
        licitacao
      };
    });

    return resultado;

  } finally {
    // Encerrar sempre a sessão.
    await session.endSession();
  }
}

module.exports = {
  registarLicitacao
};
