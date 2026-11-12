
module.exports = (err, req, res, next) => {
  // Registar o erro no servidor para diagnóstico
  console.error(err);

  // Chave duplicada no MongoDB (índice unique)
  if (err.code === 11000) {
    return res.status(409).json({
      erro: 'Já existe um registo com estes dados'
    });
  }

  // Erros de validação do Mongoose
  if (err.name === 'ValidationError') {
    const detalhes = Object.values(err.errors).map(
      erro => erro.message
    );

    return res.status(400).json({
      erro: 'Dados inválidos',
      detalhes
    });
  }

  // Erros de conversão de tipos do Mongoose
  if (err.name === 'CastError') {
    if (err.kind === 'ObjectId') {
      return res.status(400).json({
        erro: 'Identificador inválido'
      });
    }

    return res.status(400).json({
      erro: 'Dados inválidos',
      detalhes: [
        `Formato inválido para o campo "${err.path}"`
      ]
    });
  }

  // JSON malformado enviado pelo cliente
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    'body' in err
  ) {
    return res.status(400).json({
      erro: 'JSON inválido'
    });
  }

  // Erros HTTP conhecidos
  const status = Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 500
      ? err.status
      : 500;

  // Não expor detalhes internos do servidor
  if (status === 500) {
    return res.status(500).json({
      erro: 'Erro interno do servidor'
    });
  }

  return res.status(status).json({
    erro: 'Pedido inválido'
  });
};
