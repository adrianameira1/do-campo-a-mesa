import { Link } from 'react-router-dom';

const euro = (v) =>
  v.toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function CartaoProduto({ produto, onAdicionar }) {
  const produtor = produto.produtor;
  const nomeProdutor =
  produtor?.produtor?.nomeExploracao ||
  produtor?.nome ||
  'Produtor';

  return (
    <article className="card cartao-produto h-100">

    <Link
      to={`/produtos/${produto._id}`}
      aria-label={`Ver detalhes de ${produto.nome}`}
      className="d-block"
    >
      
      {produto.imagemUrl ? (
        <img
          src={produto.imagemUrl}
          className="card-img-top"
          alt={produto.nome}
          style={{
            width: '100%',
            height: '180px',
            objectFit: 'cover'
          }}
        />
      ) : (
        <div
          className="cartao-produto__imagem"
          aria-hidden="true"
        />
      )}

    </Link>


      <div className="card-body d-flex flex-column">
        {produto.biologico && (
          <span className="etiqueta-bio">BIO</span>
        )}

        <h3 className="h6 mb-1">
          <Link
            to={`/produtos/${produto._id}`}
            className="text-decoration-none text-reset"
          >
            {produto.nome}
          </Link>
        </h3>

        <p className="texto-secundario small mb-2">
          {produtor?._id ? (
            <Link
              to={`/produtores/${produtor._id}`}
              className="link-underline link-underline-opacity-0"
            >
              {nomeProdutor}
            </Link>
          ) : (
            nomeProdutor
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
