
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';

const euro = (valor) =>
  Number(valor || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

const dataHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString('pt-PT')
    : '—';

const ESTADOS = {
  agendado: {
    texto: 'Agendado',
    classe: 'text-bg-secondary'
  },
  ativo: {
    texto: 'Em direto',
    classe: 'text-bg-success'
  },
  terminado: {
    texto: 'Terminado',
    classe: 'text-bg-dark'
  }
};

export default function MeusLeiloes() {
  const { token } = useAuth();

  const [leiloes, setLeiloes] = useState([]);
  const [licitacoes, setLicitacoes] = useState({});
  const [historicoAberto, setHistoricoAberto] = useState(null);

  const [aCarregar, setACarregar] = useState(true);
  const [aCarregarHistorico, setACarregarHistorico] = useState(null);
  const [erro, setErro] = useState('');

  const carregarLeiloes = useCallback(async () => {
    if (!token) return;

    setACarregar(true);
    setErro('');

    try {
      const dados = await api('/auctions/mine', { token });
      setLeiloes(dados);
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar os leilões.');
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    carregarLeiloes();
  }, [carregarLeiloes]);

  async function alternarHistorico(id) {
    if (historicoAberto === id) {
      setHistoricoAberto(null);
      return;
    }

    setHistoricoAberto(id);
    setACarregarHistorico(id);
    setErro('');

    try {
      const dados = await api(`/auctions/${id}/bids`, { token });

      setLicitacoes((anterior) => ({
        ...anterior,
        [id]: dados
      }));
    } catch (err) {
      setErro(err.message || 'Erro ao consultar licitações.');
    } finally {
      setACarregarHistorico(null);
    }
  }

  const agendados = leiloes.filter(
    (leilao) => leilao.estado === 'agendado'
  ).length;

  const ativos = leiloes.filter(
    (leilao) => leilao.estado === 'ativo'
  ).length;

  const terminados = leiloes.filter(
    (leilao) => leilao.estado === 'terminado'
  ).length;

  return (
    <section
      className="mb-5"
      aria-labelledby="titulo-meus-leiloes"
    >
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h2 id="titulo-meus-leiloes" className="h4 mb-0">
          Os meus leilões ({leiloes.length})
        </h2>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={carregarLeiloes}
          disabled={aCarregar}
        >
          {aCarregar ? 'A atualizar...' : 'Atualizar leilões'}
        </button>
      </div>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {!aCarregar && (
        <div className="row g-3 mb-4">
          {[
            ['Agendados', agendados],
            ['Em direto', ativos],
            ['Terminados', terminados]
          ].map(([nome, total]) => (
            <div key={nome} className="col-4">
              <div className="card p-3 h-100">
                <p className="texto-secundario small mb-1">
                  {nome}
                </p>
                <strong className="fs-4">{total}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {aCarregar ? (
        <p className="texto-secundario">
          A carregar os leilões...
        </p>
      ) : leiloes.length === 0 ? (
        <div className="card p-4">
          <p>Ainda não criaste nenhum leilão.</p>

          <Link
            to="/produtor/leiloes/novo"
            className="btn btn-success align-self-start"
          >
            Criar primeiro leilão
          </Link>
        </div>
      ) : (
        <div className="row g-3">
          {leiloes.map((leilao) => {
            const estado =
              ESTADOS[leilao.estado] || ESTADOS.agendado;

            const licitacao = leilao.licitacaoAtual;
            const temVencedor =
              leilao.estado === 'terminado' &&
              Boolean(licitacao?.comprador);

            const nomeVencedor =
              licitacao?.comprador?.nome ||
              licitacao?.nome ||
              'Comprador';

            const listaLicitacoes =
              licitacoes[leilao._id] || [];

            return (
              <div key={leilao._id} className="col-12 col-xl-6">
                <article className="card p-3 p-md-4 h-100">
                  <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                    <h3 className="h5 mb-0">
                      {leilao.lote}
                    </h3>

                    <span className={`badge ${estado.classe}`}>
                      {estado.texto}
                    </span>
                  </div>

                  {leilao.produto?.nome && (
                    <p className="texto-secundario small mb-2">
                      Produto: {leilao.produto.nome}
                    </p>
                  )}

                  {leilao.descricao && (
                    <p className="mb-3">{leilao.descricao}</p>
                  )}

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <span className="texto-secundario small">
                        Preço base
                      </span>
                      <p className="fw-bold mb-0">
                        {euro(leilao.precoBase)}
                      </p>
                    </div>

                    <div className="col-6">
                      <span className="texto-secundario small">
                        Licitação atual
                      </span>
                      <p className="fw-bold mb-0">
                        {euro(
                          licitacao?.valor ?? leilao.precoBase
                        )}
                      </p>
                    </div>

                    <div className="col-6">
                      <span className="texto-secundario small">
                        Início
                      </span>
                      <p className="small mb-0">
                        {dataHora(leilao.iniciaEm)}
                      </p>
                    </div>

                    <div className="col-6">
                      <span className="texto-secundario small">
                        Fim
                      </span>
                      <p className="small mb-0">
                        {dataHora(leilao.terminaEm)}
                      </p>
                    </div>
                  </div>

                  <p className="mb-2">
                    <strong>Licitações recebidas:</strong>{' '}
                    {leilao.numLicitacoes || 0}
                  </p>

                  {leilao.estado === 'terminado' && (
                    <div className="border rounded p-3 mb-3">
                      {temVencedor ? (
                        <>
                          <p className="fw-bold text-success mb-1">
                            Leilão com vencedor
                          </p>

                          <p className="mb-1">
                            <strong>Vencedor:</strong>{' '}
                            {nomeVencedor}
                          </p>

                          <p className="mb-1">
                            <strong>Valor final:</strong>{' '}
                            {euro(licitacao.valor)}
                          </p>

                          <p className="mb-0">
                            <strong>Encomenda:</strong>{' '}
                            {leilao.encomenda?.estado ||
                              'A processar'}
                          </p>
                        </>
                      ) : (
                        <p className="mb-0">
                          Terminado sem licitações vencedoras.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="d-flex flex-wrap gap-2 mt-auto">
                    <Link
                      to={`/leiloes/${leilao._id}`}
                      className="btn btn-outline-success btn-sm"
                    >
                      Ver leilão
                    </Link>

                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() =>
                        alternarHistorico(leilao._id)
                      }
                    >
                      {historicoAberto === leilao._id
                        ? 'Ocultar licitações'
                        : 'Ver licitações'}
                    </button>
                  </div>

                  {historicoAberto === leilao._id && (
                    <div className="border-top mt-3 pt-3">
                      <h4 className="h6">
                        Histórico de licitações
                      </h4>

                      {aCarregarHistorico === leilao._id ? (
                        <p>A carregar...</p>
                      ) : listaLicitacoes.length === 0 ? (
                        <p className="texto-secundario small">
                          Ainda não existem licitações.
                        </p>
                      ) : (
                        <ul className="list-group list-group-flush">
                          {listaLicitacoes.map((bid) => (
                            <li
                              key={bid._id}
                              className="list-group-item px-0 d-flex justify-content-between gap-2"
                            >
                              <span>
                                {bid.comprador?.nome ||
                                  bid.nome ||
                                  'Comprador'}
                              </span>

                              <span className="fw-semibold">
                                {euro(bid.valor)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
