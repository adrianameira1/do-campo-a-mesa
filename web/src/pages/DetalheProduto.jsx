
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';

const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function DetalheProduto() {
  const { id } = useParams();
  const { utilizador, token } = useAuth();
  const carrinho = useCarrinho();

  const [produto, setProduto] = useState(null);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [aDenunciar, setADenunciar] = useState(null);
  const [denunciasEnviadas, setDenunciasEnviadas] = useState([]);
  const [erroDenuncia, setErroDenuncia] = useState('');
  const [sucessoDenuncia, setSucessoDenuncia] = useState('');


  useEffect(() => {
    let ativo = true;

    setACarregar(true);
    setErro('');
    setProduto(null);
    setAvaliacoes([]);

    Promise.all([
      api(`/products/${id}`),
      api(`/reviews?produto=${id}`)
    ])
      .then(([dadosProduto, listaAvaliacoes]) => {
        if (!ativo) return;

        setProduto(dadosProduto);
        setAvaliacoes(listaAvaliacoes);
      })
      .catch((err) => {
        if (ativo) {
          setErro(err.message || 'Erro ao carregar produto.');
        }
      })
      .finally(() => {
        if (ativo) setACarregar(false);
      });

    return () => {
      ativo = false;
    };
  }, [id]);


    async function denunciarAvaliacao(avaliacaoId) {
    if (!token || aDenunciar !== null) return;

    setADenunciar(avaliacaoId);
    setErroDenuncia('');
    setSucessoDenuncia('');

    try {
        await api(`/reviews/${avaliacaoId}/denuncia`, {
        metodo: 'POST',
        token
        });

        setDenunciasEnviadas((anteriores) => [
        ...anteriores,
        avaliacaoId
        ]);

        setSucessoDenuncia(
        'Denúncia enviada com sucesso. O administrador irá analisar a avaliação.'
        );
    } catch (err) {
        setErroDenuncia(
        err.message || 'Não foi possível enviar a denúncia.'
        );
    } finally {
        setADenunciar(null);
    }
    }


  if (aCarregar) {
    return <p className="texto-secundario">A carregar produto...</p>;
  }

  if (erro || !produto) {
    return (
      <>
        <div className="alert alert-danger" role="alert">
          {erro || 'Produto não encontrado.'}
        </div>

        <Link to="/" className="btn btn-outline-secondary">
          Voltar ao catálogo
        </Link>
      </>
    );
  }

  const produtor = produto.produtor;
  const nomeProdutor =
    produtor?.produtor?.nomeExploracao ||
    produtor?.nome ||
    'Produtor';

  const media = avaliacoes.length
    ? avaliacoes.reduce(
        (soma, avaliacao) => soma + avaliacao.classificacao,
        0
      ) / avaliacoes.length
    : null;

  return (
    <>
      <div className="mb-4">
        <Link to="/" className="btn btn-outline-secondary btn-sm">
          ← Voltar ao catálogo
        </Link>
      </div>

      <section className="card p-3 p-md-4 mb-4">
        <div className="row g-4">
          <div className="col-12 col-md-5">
            {produto.imagemUrl ? (
              <img
                src={produto.imagemUrl}
                alt={produto.nome}
                className="img-fluid rounded w-100"
              />
            ) : (
              <div
                className="cartao-produto__imagem rounded"
                style={{ minHeight: '300px' }}
                aria-label="Produto sem imagem"
              />
            )}
          </div>

          <div className="col-12 col-md-7">
            <p className="texto-secundario mb-2">
              {produto.categoria}
            </p>

            <h1 className="mb-3">{produto.nome}</h1>

            {produto.biologico && (
              <span className="etiqueta-bio">BIO</span>
            )}

            <p className="preco mt-3">
              {euro(produto.preco)}
              <span className="texto-secundario small">
                {' '}/ {produto.unidade}
              </span>
            </p>

            <p>
              <strong>Stock disponível:</strong> {produto.stock}
            </p>

            {produto.descricao && (
              <div className="mb-3">
                <h2 className="h5">Descrição</h2>
                <p>{produto.descricao}</p>
              </div>
            )}

            {produto.ingredientes?.length > 0 && (
              <div className="mb-3">
                <h2 className="h5">Ingredientes</h2>
                <p>{produto.ingredientes.join(', ')}</p>
              </div>
            )}

            {produto.epocas?.length > 0 && (
              <p>
                <strong>Épocas:</strong> {produto.epocas.join(', ')}
              </p>
            )}

            <div className="border-top pt-3 mt-3">
              <p className="mb-1">
                <strong>Produtor:</strong>{' '}
                {produtor?._id ? (
                  <Link to={`/produtores/${produtor._id}`}>
                    {nomeProdutor}
                  </Link>
                ) : (
                  nomeProdutor
                )}
              </p>

              {produtor?.produtor?.localidade && (
                <p className="texto-secundario">
                  {produtor.produtor.localidade}
                </p>
              )}
            </div>

            {utilizador?.papel === 'comprador' && (
              <button
                type="button"
                className="btn btn-success mt-3"
                disabled={produto.stock < 1}
                onClick={() => carrinho.adicionar(produto)}
              >
                {produto.stock < 1
                  ? 'Sem stock'
                  : 'Adicionar ao carrinho'}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mb-5" aria-labelledby="titulo-avaliacoes">
        <h2 id="titulo-avaliacoes" className="h4 mb-3">
          Avaliações e comentários
        </h2>

        {erroDenuncia && (
        <div className="alert alert-danger" role="alert">
            {erroDenuncia}
        </div>
        )}

        {sucessoDenuncia && (
        <div className="alert alert-success" role="status">
            {sucessoDenuncia}
        </div>
        )}


        {media !== null && (
          <p>
            <strong>Avaliação média:</strong>{' '}
            {media.toLocaleString('pt-PT', {
              maximumFractionDigits: 1
            })}/5 ({avaliacoes.length}{' '}
            {avaliacoes.length === 1 ? 'avaliação' : 'avaliações'})
          </p>
        )}

        {avaliacoes.length === 0 ? (
          <p className="texto-secundario">
            Este produto ainda não tem avaliações.
          </p>
        ) : (
          <div className="row g-3">
            {avaliacoes.map((avaliacao) => (
              <div
                className="col-12 col-md-6"
                key={avaliacao._id}
              >
                <article className="card h-100 p-3">
                  <div className="d-flex justify-content-between gap-2">
                    <strong>
                      {avaliacao.autor?.nome || 'Comprador'}
                    </strong>

                    <span className="texto-secundario small">
                      {new Date(
                        avaliacao.createdAt
                      ).toLocaleDateString('pt-PT')}
                    </span>
                  </div>

                  <div className="my-2">
                    <span
                      className="text-warning"
                      aria-label={`Classificação ${avaliacao.classificacao} de 5`}
                    >
                      {'★'.repeat(avaliacao.classificacao)}
                      {'☆'.repeat(5 - avaliacao.classificacao)}
                    </span>
                  </div>

                  {avaliacao.comentario ? (
                    <p className="mb-0">{avaliacao.comentario}</p>
                  ) : (
                    <p className="texto-secundario mb-0">
                      Sem comentário.
                    </p>
                  )}

                    {token &&
                    String(utilizador?._id || utilizador?.id) !==
                        String(avaliacao.autor?._id || avaliacao.autor) && (
                        <div className="border-top mt-3 pt-2 text-end">
                        {denunciasEnviadas.includes(avaliacao._id) ? (
                            <span className="texto-secundario small">
                            Denúncia enviada
                            </span>
                        ) : (
                            <button
                            type="button"
                            className="btn btn-link btn-sm text-secondary p-0"
                            disabled={aDenunciar !== null}
                            onClick={() => denunciarAvaliacao(avaliacao._id)}
                            >
                            {aDenunciar === avaliacao._id
                                ? 'A enviar denúncia...'
                                : 'Denunciar comentário'}
                            </button>
                        )}
                        </div>
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
