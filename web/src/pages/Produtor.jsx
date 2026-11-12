
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { api } from '../api/client.js';

export default function Produtor() {
  const { id } = useParams();
  const { utilizador } = useAuth();
  const carrinho = useCarrinho();

  const [dados, setDados] = useState(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;

    setACarregar(true);
    setErro('');
    setDados(null);

    api(`/producers/${id}`)
      .then((resposta) => {
        if (ativo) setDados(resposta);
      })
      .catch((err) => {
        if (ativo) setErro(err.message);
      })
      .finally(() => {
        if (ativo) setACarregar(false);
      });

    return () => {
      ativo = false;
    };
  }, [id]);

  if (aCarregar) {
    return <p className="texto-secundario">A carregar produtor...</p>;
  }

  if (erro || !dados) {
    return (
      <>
        <h1>Produtor</h1>
        <div className="alert alert-danger" role="alert">
          {erro || 'Não foi possível obter os dados do produtor.'}
        </div>
        <Link to="/" className="btn btn-outline-secondary">
          Voltar ao catálogo
        </Link>
      </>
    );
  }

  const { produtor, produtos, avaliacaoMedia } = dados;

  const nomeExploracao =
    produtor.produtor?.nomeExploracao || produtor.nome;

  const descricao = produtor.produtor?.descricao;
  const localidade = produtor.produtor?.localidade;
  const localizacao = produtor.produtor?.localizacao;

  const temCoordenadas =
    Number.isFinite(localizacao?.lat) &&
    Number.isFinite(localizacao?.lng) &&
    localizacao.lat >= -90 &&
    localizacao.lat <= 90 &&
    localizacao.lng >= -180 &&
    localizacao.lng <= 180;

  const urlMapa = temCoordenadas
    ? `https://www.openstreetmap.org/?mlat=${localizacao.lat}&mlon=${localizacao.lng}#map=13/${localizacao.lat}/${localizacao.lng}`
    : null;

  const produtosComProdutor = produtos.map((produto) => ({
    ...produto,
    produtor: {
      _id: produtor._id,
      nome: produtor.nome,
      produtor: produtor.produtor
    }
  }));

  return (
    <>
      <div className="mb-4">
        <Link to="/" className="btn btn-outline-secondary btn-sm">
          Voltar ao catálogo
        </Link>
      </div>

      <section className="card p-3 p-md-4 mb-4">
        <p className="texto-secundario small mb-2">
          Produtor local
        </p>

        <h1 className="mb-3">{nomeExploracao}</h1>

        {descricao && <p className="mb-3">{descricao}</p>}

        {localidade && (
          <p className="mb-2">
            <strong>Localidade:</strong> {localidade}
          </p>
        )}

        <p className="mb-2">
          <strong>Avaliação média:</strong>{' '}
          {avaliacaoMedia === null
            ? 'Ainda sem avaliações'
            : `${Number(avaliacaoMedia).toLocaleString('pt-PT', {
                maximumFractionDigits: 2
              })} / 5`}
        </p>

        {urlMapa && (
          <div className="mt-3">
            <h2 className="h5 mb-3">Localização</h2>

            <div className="ratio ratio-16x9 rounded overflow-hidden border">
              <iframe
                title={`Mapa da localização de ${nomeExploracao}`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                  localizacao.lng - 0.025
                },${localizacao.lat - 0.015},${
                  localizacao.lng + 0.025
                },${localizacao.lat + 0.015}&layer=mapnik&marker=${
                  localizacao.lat
                },${localizacao.lng}`}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>

            <a
              href={urlMapa}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-success btn-sm mt-3"
            >
              Abrir mapa
            </a>
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-produtos-produtor">
        <h2 id="titulo-produtos-produtor" className="h4 mb-3">
          Produtos disponíveis ({produtos.length})
        </h2>

        {produtos.length === 0 ? (
          <p className="texto-secundario">
            Este produtor ainda não tem produtos disponíveis.
          </p>
        ) : (
          <div className="grelha-produtos">
            {produtosComProdutor.map((produto) => (
              <CartaoProduto
                key={produto._id}
                produto={produto}
                onAdicionar={
                  utilizador?.papel === 'comprador'
                    ? () => carrinho.adicionar(produto)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
