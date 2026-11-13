
const { BlobServiceClient } = require('@azure/storage-blob');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const PASTA_UPLOADS = path.join(__dirname, '../../uploads');
const LIMITE = 5 * 1024 * 1024;

const TIPOS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

let container;

function obterContainer() {
  if (!container) {
    if (!process.env.STORAGE_CONN) {
      throw new Error('STORAGE_CONN não está definida');
    }

    container = BlobServiceClient
      .fromConnectionString(process.env.STORAGE_CONN)
      .getContainerClient(
        process.env.STORAGE_CONTAINER || 'produtos'
      );
  }

  return container;
}

// Verificar se o conteúdo corresponde ao formato declarado.
function formatoValido(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer)) return false;

  if (mimetype === 'image/jpeg') {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  }

  if (mimetype === 'image/png') {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );
  }

  if (mimetype === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
  }

  return false;
}

async function guardarImagem(ficheiro, req) {
  if (!ficheiro || !ficheiro.buffer) {
    const erro = new Error('Nenhuma imagem foi enviada');
    erro.status = 400;
    throw erro;
  }

  const extensao = TIPOS[ficheiro.mimetype];

  if (!extensao || !formatoValido(
    ficheiro.buffer,
    ficheiro.mimetype
  )) {
    const erro = new Error(
      'Formato inválido. Utiliza JPEG, PNG ou WebP'
    );
    erro.status = 400;
    throw erro;
  }

  if (ficheiro.buffer.length > LIMITE) {
    const erro = new Error('A imagem não pode exceder 5 MB');
    erro.status = 413;
    throw erro;
  }

  const nome = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extensao}`;

  // Produção: armazenamento Azure Blob Storage.
  if (process.env.STORAGE_CONN) {
    const blob = obterContainer().getBlockBlobClient(nome);

    await blob.uploadData(ficheiro.buffer, {
      blobHTTPHeaders: {
        blobContentType: ficheiro.mimetype
      }
    });

    return blob.url;
  }

  // Desenvolvimento: armazenamento local.
  await fs.mkdir(PASTA_UPLOADS, { recursive: true });

  await fs.writeFile(
    path.join(PASTA_UPLOADS, nome),
    ficheiro.buffer
  );

  return `${req.protocol}://${req.get('host')}/uploads/${nome}`;
}

module.exports = { guardarImagem };
