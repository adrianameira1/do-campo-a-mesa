
import produtos from './produtos.json';

const kiwi = produtos.find((p) => p._id === 'p1');

const agora = Date.now();

const leiloesSimulados = [
  {
    _id: 'leilao-simulado-1',
    produto: kiwi._id,
    produtor: kiwi.produtor,
    lote: '200 kg de kiwi Hayward, calibre A',
    quantidade: '200 kg',
    precoBase: 200,
    incremento: 5,
    licitacaoAtual: {
      valor: 200,
      comprador: null
    },
    iniciaEm: new Date(agora).toISOString(),
    terminaEm: new Date(agora + 30 * 60 * 1000).toISOString(),
    estado: 'ativo'
  }
];

export default leiloesSimulados;
