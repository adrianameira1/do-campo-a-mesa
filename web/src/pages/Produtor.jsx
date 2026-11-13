
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { api } from '../api/client.js';
import MapaProdutor from '../components/MapaProdutor.jsx';

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
    return (
      <p className="texto-secundario">
        A carregar produtor...
      </p>
    );
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

  const avaliacoes = dados.avaliacoes || [];
  const totalAvaliacoes = dados.totalAvaliacoes ?? avaliacoes.length;

  const nomeExploracao =
    produtor.produtor?.nomeExploracao || produtor.nome;

  const descricao = produtor.produtor?.descricao;
  const localidade = produtor.produtor?.localidade;
  const localizacao = produtor.produtor?.localizacao;

  const temLocalizacao =
    Boolean(localidade?.trim()) ||
    (
      localizacao?.lat != null &&
      localizacao?.lng != null
    );

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

      {/* Perfil público do produtor */}
      <section className="card p-3 p-md-4 mb-4">
        <div className="row g-4 align-items-start">

          <div className={temLocalizacao ? 'col-12 col-lg-6' : 'col-12'}>
            <p className="texto-secundario small mb-2">
              Produtor local
            </p>

            <h1 className="mb-3">{nomeExploracao}</h1>

            {descricao && (
              <p className="mb-3">{descricao}</p>
            )}

            {localidade && (
              <p className="mb-2">
                <strong>Localidade:</strong> {localidade}
              </p>
            )}

            <p className="mb-2">
              <strong>Avaliação média:</strong>{' '}
              {avaliacaoMedia == null
                ? 'Ainda sem avaliações'
                : `${Number(avaliacaoMedia).toLocaleString('pt-PT', {
                    maximumFractionDigits: 2
                  })} / 5 (${totalAvaliacoes} ${
                    totalAvaliacoes === 1
                      ? 'avaliação'
                      : 'avaliações'
                  })`}
            </p>
          </div>

          {/* Mapa: coordenadas exatas ou centro da localidade */}
          {temLocalizacao && (
            <div className="col-12 col-lg-6">
              <h2 className="h5 mb-2">Localização</h2>

              <MapaProdutor
                localizacao={localizacao}
                localidade={localidade}
              />
            </div>
          )}
        </div>
      </section>

      {/* Produtos disponíveis */}
      <section
        className="mb-5"
        aria-labelledby="titulo-produtos-produtor"
      >
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

      {/* Avaliações dos clientes */}
      <section
        className="mb-4"
        aria-labelledby="titulo-avaliacoes"
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 id="titulo-avaliacoes" className="h5 mb-0">
            Avaliações dos clientes
          </h2>

          <span className="texto-secundario small">
            {totalAvaliacoes}{' '}
            {totalAvaliacoes === 1
              ? 'avaliação'
              : 'avaliações'}
          </span>
        </div>

        {avaliacoes.length === 0 ? (
          <p className="texto-secundario">
            Este produtor ainda não recebeu avaliações.
          </p>
        ) : (
          <div className="row row-cols-1 row-cols-md-2 g-3">
            {avaliacoes.map((avaliacao) => (
              <div className="col" key={avaliacao._id}>
                <article className="card h-100 bg-white border-0 shadow-sm p-3">

                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <strong>
                      {avaliacao.autor?.nome || 'Comprador'}
                    </strong>

                    <span className="texto-secundario small">
                      {new Date(avaliacao.createdAt).toLocaleDateString(
                        'pt-PT',
                        {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        }
                      )}
                    </span>
                  </div>

                  <div className="my-2">
                    <span
                      className="text-warning"
                      aria-label={`Classificação: ${avaliacao.classificacao} em 5`}
                    >
                      {'★'.repeat(avaliacao.classificacao)}
                      {'☆'.repeat(5 - avaliacao.classificacao)}
                    </span>

                    <span className="ms-2 texto-secundario small">
                      {avaliacao.classificacao}/5
                    </span>
                  </div>

                  {avaliacao.comentario ? (
                    <p className="mb-0 small">
                      {avaliacao.comentario}
                    </p>
                  ) : (
                    <p className="texto-secundario mb-0 small">
                      Sem comentário.
                    </p>
                  )}

                </article>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
