// Ponto de entrada: servidor HTTP partilhado pela API REST e pelo Socket.io
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { ligarBD } = require('./config/db');
const registarSockets = require('./sockets');
const sincronizarEstadosLeiloes = require('./services/estadoLeiloes');

const PORT = process.env.PORT || 3000;

async function iniciar() {
  if (!process.env.CLIENT_URL) {
    throw new Error('CLIENT_URL é obrigatória para configurar o CORS');
  }

  await ligarBD();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL }
  });

  // Disponibiliza o io às rotas (ex.: notificar o comprador quando a encomenda muda)
  app.set('io', io);
  registarSockets(io);

  // Verificar periodicamente o início e o fim dos leilões.
  let sincronizacaoEmCurso = false;

  async function atualizarLeiloes() {
    if (sincronizacaoEmCurso) return;

    sincronizacaoEmCurso = true;

    try {
      await sincronizarEstadosLeiloes(io);
    } catch (err) {
      console.error('Erro ao atualizar estados dos leilões:', err);
    } finally {
      sincronizacaoEmCurso = false;
    }
  }

  // Corrigir estados desatualizados ao arrancar.
  await atualizarLeiloes();

  // Continuar a verificar enquanto o servidor está ativo.
  setInterval(atualizarLeiloes, 5000);

  server.listen(PORT, () => {
    console.log(`API em http://localhost:${PORT}`);
    console.log(`Documentação em http://localhost:${PORT}/api-docs`);
  });
}

iniciar().catch((err) => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});
