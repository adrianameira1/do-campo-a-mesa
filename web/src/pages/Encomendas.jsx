
import { useCallback, useEffect, useState } from 'react';
import EstadoEncomenda from '../components/EstadoEncomenda.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

const euro = (valor) =>
  Number(valor || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

function totalEncomenda(encomenda) {
  return (encomenda.linhas || []).reduce(
    (total, linha) =>
      total + linha.precoUnit * linha.quantidade,
    0
  );
}

export default function Encomendas() {
  const { token } = useAuth();

  const [encomendas, setEncomendas] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');

  const carregarEncomendas = useCallback(async () => {
    if (!token) {
      setEncomendas([]);
      setErro('É necessário iniciar sessão como comprador.');
      setACarregar(false);
      return;
    }

    setACarregar(true);
    setErro('');

    try {
      const dados = await api('/orders', { token });
      setEncomendas(dados);
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar as encomendas.');
      setEncomendas([]);
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    carregarEncomendas();
  }, [carregarEncomendas]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <h1 className="mb-0">As minhas encomendas</h1>

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={carregarEncomendas}
          disabled={aCarregar}
        >
          {aCarregar ? 'A carregar...' : 'Atualizar'}
        </button>
      </div>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {aCarregar ? (
        <p className="texto-secundario">
          A carregar encomendas...
        </p>
      ) : !erro && encomendas.length === 0 ? (
        <div className="card p-4 text-center">
          <h2 className="h5">Ainda não tens encomendas</h2>
          <p className="texto-secundario mb-0">
            Quando fizeres uma compra, poderás acompanhar
            o estado da encomenda nesta página.
          </p>
        </div>
      ) : (
        <div className="row g-3">
          {encomendas.map((encomenda) => (
            <div
              key={encomenda._id}
              className="col-12"
            >
              <article className="card p-3 p-md-4">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                  <div>
                    <h2 className="h5 mb-1">
                      Encomenda #{encomenda._id.slice(-6)}
                    </h2>

                    <p className="texto-secundario small mb-0">
                      {new Date(encomenda.createdAt)
                        .toLocaleString('pt-PT')}
                    </p>
                  </div>

                  <span className="badge text-bg-secondary">
                    {encomenda.estado}
                  </span>
                </div>

                <p className="mb-3">
                  <strong>Produtor:</strong>{' '}
                  {encomenda.produtor?.produtor?.nomeExploracao ||
                    encomenda.produtor?.nome ||
                    'Produtor'}
                </p>

                <h3 className="h6">Estado da encomenda</h3>

                <div className="mb-4">
                  <EstadoEncomenda estado={encomenda.estado} />
                </div>

                <h3 className="h6">Produtos encomendados</h3>

                <ul className="list-group mb-3">
                  {(encomenda.linhas || []).map((linha, indice) => (
                    <li
                      key={linha._id || indice}
                      className="list-group-item d-flex justify-content-between flex-wrap gap-2"
                    >
                      <span>
                        {linha.nome} — {linha.quantidade} ×{' '}
                        {euro(linha.precoUnit)}
                      </span>

                      <strong>
                        {euro(linha.quantidade * linha.precoUnit)}
                      </strong>
                    </li>
                  ))}
                </ul>

                <div className="d-flex justify-content-between align-items-center mb-3">
                  <strong>Total</strong>
                  <strong className="fs-5">
                    {euro(totalEncomenda(encomenda))}
                  </strong>
                </div>

                <div className="border-top pt-3">
                  <p className="mb-1">
                    <strong>Modalidade:</strong>{' '}
                    {encomenda.entrega?.tipo === 'entrega'
                      ? 'Entrega na morada'
                      : 'Levantamento no produtor'}
                  </p>

                  {encomenda.entrega?.tipo === 'entrega' &&
                    encomenda.entrega?.morada && (
                      <p className="mb-0">
                        <strong>Morada:</strong>{' '}
                        {encomenda.entrega.morada}
                      </p>
                    )}
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
