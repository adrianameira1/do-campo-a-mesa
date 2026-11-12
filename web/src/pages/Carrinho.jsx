import { useState } from 'react';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

const euro = (valor) =>
  valor.toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function Carrinho() {
  const {
    linhas,
    alterarQuantidade,
    remover,
    esvaziar,
    total
  } = useCarrinho();

  const { token } = useAuth();

  const [tipoEntrega, setTipoEntrega] = useState('levantamento');
  const [morada, setMorada] = useState('');
  const [aSubmeter, setASubmeter] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function finalizar(e) {
    e.preventDefault();

    if (aSubmeter || linhas.length === 0) return;

    setErro('');
    setSucesso('');

    if (!token) {
      setErro('É necessário iniciar sessão como comprador.');
      return;
    }

    if (tipoEntrega === 'entrega' && !morada.trim()) {
      setErro('Indica a morada de entrega.');
      return;
    }

    if (linhas.some(({ produto, quantidade }) =>
      !Number.isSafeInteger(quantidade) ||
      quantidade < 1 ||
      quantidade > produto.stock
    )) {
      setErro('Verifica as quantidades e o stock dos produtos.');
      return;
    }

    const corpo = {
      linhas: linhas.map(({ produto, quantidade }) => ({
        produto: produto._id,
        quantidade
      })),
      entrega: {
        tipo: tipoEntrega,
        ...(tipoEntrega === 'entrega'
          ? { morada: morada.trim() }
          : {})
      }
    };

    setASubmeter(true);

    try {
      const encomendas = await api('/orders', {
        metodo: 'POST',
        corpo,
        token
      });

      if (!Array.isArray(encomendas) || encomendas.length === 0) {
        throw new Error('Resposta inesperada ao criar encomendas.');
      }

      esvaziar();
      setMorada('');
      setTipoEntrega('levantamento');

      setSucesso(
        encomendas.length === 1
          ? 'Encomenda criada com sucesso!'
          : `${encomendas.length} encomendas criadas com sucesso!`
      );
    } catch (err) {
      setErro(err.message || 'Não foi possível finalizar a encomenda.');
    } finally {
      setASubmeter(false);
    }
  }

  return (
    <>
      <h1>Carrinho</h1>

      {sucesso && (
        <div className="alert alert-success" role="status">
          {sucesso}
        </div>
      )}

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {linhas.length === 0 ? (
        <p>O carrinho está vazio.</p>
      ) : (
        <>
          <ul className="list-group mb-3">
            {linhas.map(({ produto, quantidade }) => (
              <li
                key={produto._id}
                className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-3"
              >
                <div>
                  <strong>{produto.nome}</strong>
                  <div className="texto-secundario small">
                    {euro(produto.preco)} / {produto.unidade}
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    aria-label={`Diminuir quantidade de ${produto.nome}`}
                    disabled={aSubmeter}
                    onClick={() =>
                      alterarQuantidade(produto._id, quantidade - 1)
                    }
                  >
                    −
                  </button>

                  <span>{quantidade}</span>

                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    aria-label={`Aumentar quantidade de ${produto.nome}`}
                    disabled={aSubmeter || quantidade >= produto.stock}
                    onClick={() =>
                      alterarQuantidade(produto._id, quantidade + 1)
                    }
                  >
                    +
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={aSubmeter}
                    onClick={() => remover(produto._id)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="d-flex justify-content-between align-items-center mb-3">
            <p className="fw-bold mb-0">
              Total: {euro(total)}
            </p>

            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              disabled={aSubmeter}
              onClick={esvaziar}
            >
              Esvaziar carrinho
            </button>
          </div>

          <form onSubmit={finalizar} className="card p-3">
            <h2 className="h5 mb-3">Finalizar encomenda</h2>

            <fieldset disabled={aSubmeter}>
              <legend className="fs-6">Modalidade de entrega</legend>

              <div className="form-check mb-2">
                <input
                  id="levantamento"
                  type="radio"
                  name="tipoEntrega"
                  className="form-check-input"
                  checked={tipoEntrega === 'levantamento'}
                  onChange={() => setTipoEntrega('levantamento')}
                />
                <label className="form-check-label" htmlFor="levantamento">
                  Levantamento no produtor
                </label>
              </div>

              <div className="form-check mb-3">
                <input
                  id="entrega"
                  type="radio"
                  name="tipoEntrega"
                  className="form-check-input"
                  checked={tipoEntrega === 'entrega'}
                  onChange={() => setTipoEntrega('entrega')}
                />
                <label className="form-check-label" htmlFor="entrega">
                  Entrega na morada
                </label>
              </div>

              {tipoEntrega === 'entrega' && (
                <div className="mb-3">
                  <label htmlFor="morada" className="form-label">
                    Morada de entrega
                  </label>
                  <textarea
                    id="morada"
                    className="form-control"
                    rows="3"
                    required
                    value={morada}
                    onChange={(e) => setMorada(e.target.value)}
                    placeholder="Rua, número, código postal e localidade"
                  />
                </div>
              )}
            </fieldset>

            <button
              type="submit"
              className="btn btn-success"
              disabled={aSubmeter}
            >
              {aSubmeter ? 'A finalizar...' : 'Finalizar encomenda'}
            </button>
          </form>
        </>
      )}
    </>
  );
}
