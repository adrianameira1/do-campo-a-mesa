
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import PorImplementar from '../components/PorImplementar.jsx';

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

  return (
    <>
      <h1>Carrinho</h1>

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
                    disabled={quantidade >= produto.stock}
                    onClick={() =>
                      alterarQuantidade(produto._id, quantidade + 1)
                    }
                  >
                    +
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
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
              onClick={esvaziar}
            >
              Esvaziar carrinho
            </button>
          </div>
        </>
      )}

      <PorImplementar passo={3}>
        Escolher levantamento ou entrega e submeter com
        <code> POST /api/orders</code> (uma encomenda por produtor).
      </PorImplementar>
    </>
  );
}
