import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useEventoSocket } from '../../context/SocketContext.jsx';
import PerfilExploracao from './PerfilExploracao.jsx';
import MeusLeiloes from './MeusLeiloes.jsx';

const PROXIMO_ESTADO = {
  pendente: {
    estado: 'confirmada',
    texto: 'Confirmar encomenda'
  },
  confirmada: {
    estado: 'pronta',
    texto: 'Marcar como pronta'
  },
  pronta: {
    estado: 'entregue',
    texto: 'Marcar como entregue'
  }
};

const euro = (valor) =>
  Number(valor || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

function totalEncomenda(encomenda) {
  return (encomenda.linhas || []).reduce(
    (total, linha) =>
      total + Number(linha.precoUnit || 0) * Number(linha.quantidade || 0),
    0
  );
}

export default function PainelProdutor() {
  const { token, utilizador } = useAuth();

  const [produtos, setProdutos] = useState([]);
  const [encomendas, setEncomendas] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);

  const [aCarregar, setACarregar] = useState(true);
  const [aAtualizar, setAAtualizar] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregarDados = useCallback(async () => {
    if (!token || !utilizador?._id) {
      setErro('É necessário iniciar sessão como produtor.');
      setACarregar(false);
      return;
    }

    setACarregar(true);
    setErro('');

    try {
      const [listaProdutos, listaEncomendas, listaAvaliacoes] =
        await Promise.all([
          api('/products/mine', { token }),
          api('/orders', { token }),
          api(`/reviews?produtor=${utilizador._id}`)
        ]);

      setProdutos(listaProdutos);
      setEncomendas(listaEncomendas);
      setAvaliacoes(listaAvaliacoes);
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar o painel.');
    } finally {
      setACarregar(false);
    }
  }, [token, utilizador?._id]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Atualizar automaticamente a lista quando chegar uma encomenda.
  const atualizarEncomendas = useCallback(async () => {
    if (!token) return;

    try {
      const lista = await api('/orders', { token });
      setEncomendas(lista);
    } catch (err) {
      setErro(
        err.message || 'Não foi possível atualizar as encomendas.'
      );
    }
  }, [token]);

  useEventoSocket('nova-encomenda', atualizarEncomendas);

  async function mudarEstado(encomenda) {
    const proximo = PROXIMO_ESTADO[encomenda.estado];

    if (!proximo || aAtualizar !== null) return;

    setAAtualizar(encomenda._id);
    setErro('');
    setMensagem('');

    try {
      await api(`/orders/${encomenda._id}/estado`, {
        metodo: 'PATCH',
        corpo: { estado: proximo.estado },
        token
      });

      await carregarDados();
      setMensagem('Estado da encomenda atualizado com sucesso!');
    } catch (err) {
      setErro(err.message || 'Não foi possível atualizar a encomenda.');
    } finally {
      setAAtualizar(null);
    }
  }

  const encomendasEntregues = encomendas.filter(
    (encomenda) => encomenda.estado === 'entregue'
  );

  const vendasConcluidas = encomendasEntregues.reduce(
    (total, encomenda) => total + totalEncomenda(encomenda),
    0
  );

  const encomendasPorTratar = encomendas.filter(
    (encomenda) => encomenda.estado !== 'entregue'
  ).length;

  const avaliacaoMedia = avaliacoes.length
    ? (
        avaliacoes.reduce(
          (total, avaliacao) => total + avaliacao.classificacao,
          0
        ) / avaliacoes.length
      ).toFixed(1)
    : '—';

  const stockBaixo = produtos.filter(
    (produto) => produto.stock <= 5
  );

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <h1 className="mb-0">Painel do produtor</h1>

        <div className="d-flex flex-wrap gap-2">
          <Link
            to="/produtor/produtos"
            className="btn btn-outline-success"
          >
            Gerir produtos
          </Link>

          <Link
            to="/produtor/leiloes/novo"
            className="btn btn-success"
          >
            Criar leilão
          </Link>
        </div>
      </div>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="alert alert-success" role="status">
          {mensagem}
        </div>
      )}

      <div className="mb-4">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={carregarDados}
          disabled={aCarregar || aAtualizar !== null}
        >
          Atualizar dados
        </button>
      </div>

      {aCarregar ? (
        <p className="texto-secundario">A carregar painel...</p>
      ) : (
        <>
          <PerfilExploracao />
          <section className="mb-5" aria-labelledby="titulo-indicadores">
            <h2 id="titulo-indicadores" className="h4 mb-3">
              Resumo da atividade
            </h2>

            <div className="row g-3">
              {[
                ['Vendas concluídas', euro(vendasConcluidas)],
                ['Encomendas por tratar', encomendasPorTratar],
                ['Avaliação média', avaliacaoMedia === '—'
                  ? '—'
                  : `${avaliacaoMedia}/5`],
                ['Produtos no catálogo', produtos.length]
              ].map(([titulo, valor]) => (
                <div key={titulo} className="col-6 col-lg-3">
                  <div className="card p-3 h-100">
                    <p className="texto-secundario mb-2">{titulo}</p>
                    <strong className="fs-3">{valor}</strong>
                  </div>
                </div>
              ))}
            </div>

            <p className="texto-secundario small mt-2">
              As vendas concluídas correspondem ao total das
              encomendas com estado entregue. A avaliação média
              considera as avaliações públicas visíveis.
            </p>
          </section>

          <section className="mb-5" aria-labelledby="titulo-stock">
            <h2 id="titulo-stock" className="h4 mb-3">
              Alertas de stock baixo ({stockBaixo.length})
            </h2>

            {stockBaixo.length === 0 ? (
              <p className="texto-secundario">
                Não existem produtos com stock baixo.
              </p>
            ) : (
              <div className="alert alert-warning">
                <p className="fw-bold mb-2">
                  Produtos com 5 ou menos unidades:
                </p>

                <ul className="mb-3">
                  {stockBaixo.map((produto) => (
                    <li key={produto._id}>
                      {produto.nome} — {produto.stock} {produto.unidade}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/produtor/produtos"
                  className="btn btn-outline-dark btn-sm"
                >
                  Gerir stock
                </Link>
              </div>
            )}
          </section>

          <section className="mb-4" aria-labelledby="titulo-encomendas">
            <h2 id="titulo-encomendas" className="h4 mb-3">
              Encomendas recebidas ({encomendas.length})
            </h2>

            {encomendas.length === 0 ? (
              <p className="texto-secundario">
                Ainda não existem encomendas recebidas.
              </p>
            ) : (
              <div className="row g-3">
                {encomendas.map((encomenda) => {
                  const proximo = PROXIMO_ESTADO[encomenda.estado];

                  return (
                    <div
                      key={encomenda._id}
                      className="col-12 col-lg-6"
                    >
                      <article className="card p-3 h-100">
                        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                          <h3 className="h5 mb-0">
                            Encomenda #{encomenda._id.slice(-6)}

                            {encomenda.origem === 'leilao' && (
                              <span className="badge text-bg-success ms-2">
                                Leilão
                              </span>
                            )}
                          </h3>

                          <span className="badge text-bg-secondary">
                            {encomenda.estado}
                          </span>
                        </div>

                        <p className="mb-1">
                          <strong>Comprador:</strong>{' '}
                          {encomenda.comprador?.nome || 'Comprador'}
                        </p>

                        <p className="texto-secundario small">
                          {new Date(encomenda.createdAt).toLocaleString('pt-PT')}
                        </p>

                        <h4 className="h6">Produtos</h4>

                        <ul className="mb-3">
                          {(encomenda.linhas || []).map((linha) => (
                            <li key={linha._id || String(linha.produto)}>
                              {linha.nome} — {linha.quantidade} ×{' '}
                              {euro(linha.precoUnit)}
                            </li>
                          ))}
                        </ul>

                        <p className="fw-bold">
                          Total: {euro(totalEncomenda(encomenda))}
                        </p>

                        <p className="mb-1">
                          <strong>Modalidade:</strong>{' '}
                          {encomenda.entrega?.tipo === 'entrega'
                            ? 'Entrega na morada'
                            : 'Levantamento no produtor'}
                        </p>

                        {encomenda.entrega?.tipo === 'entrega' &&
                          encomenda.entrega?.morada && (
                            <p className="small">
                              <strong>Morada:</strong>{' '}
                              {encomenda.entrega.morada}
                            </p>
                          )}

                        {proximo ? (
                          <button
                            type="button"
                            className="btn btn-success mt-auto"
                            disabled={aAtualizar !== null || aCarregar}
                            onClick={() => mudarEstado(encomenda)}
                          >
                            {aAtualizar === encomenda._id
                              ? 'A atualizar...'
                              : proximo.texto}
                          </button>
                        ) : (
                          <p className="text-success fw-bold mt-auto mb-0">
                            Encomenda concluída
                          </p>
                        )}
                      </article>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <MeusLeiloes />
        </>
      )}
    </>
  );
}
