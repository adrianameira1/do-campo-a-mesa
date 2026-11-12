import { Link } from 'react-router-dom';

const euro = (v) =>
  v.toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function CartaoProduto({ produto, onAdicionar }) {
  const produtor = produto.produtor;

  return (
    <article className="card cartao-produto h-100">
      {produto.imagemUrl ? (
        <img
          src={produto.imagemUrl}
          className="card-img-top"
          alt={produto.nome}
        />
      ) : (
        <div
          className="cartao-produto__imagem"
          aria-hidden="true"
        />
      )}

      <div className="card-body d-flex flex-column">
        {produto.biologico && (
          <span className="etiqueta-bio">BIO</span>
        )}

        <h3 className="h6 mb-1">{produto.nome}</h3>

        <p className="texto-secundario small mb-2">
          {produtor?._id ? (
            <Link
              to={`/produtores/${produtor._id}`}
              className="link-underline link-underline-opacity-0"
            >
              {produtor.nome}
            </Link>
          ) : (
            produtor?.nome || 'Produtor'
          )}

          {produtor?.produtor?.localidade &&
            ` · ${produtor.produtor.localidade}`}
        </p>

        <p className="preco mt-auto">
          {euro(produto.preco)}{' '}
          <span className="texto-secundario small">
            / {produto.unidade}
          </span>
        </p>

        {onAdicionar && (
          <button
            type="button"
            className="btn btn-success w-100"
            onClick={onAdicionar}
          >
            Adicionar ao carrinho
          </button>
        )}
      </div>
    </article>
  );
}
