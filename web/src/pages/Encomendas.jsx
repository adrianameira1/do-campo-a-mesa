
import { useCallback, useEffect, useState } from 'react';
import EstadoEncomenda from '../components/EstadoEncomenda.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { useEventoSocket } from '../context/SocketContext.jsx';

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

// Formulário reutilizável para produtor e produtos.
function FormularioAvaliacao({
  titulo,
  classificacao,
  setClassificacao,
  comentario,
  setComentario,
  erro,
  aSubmeter,
  onSubmit,
  onCancelar
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="border rounded p-3 mt-3"
    >
      <h4 className="h6">{titulo}</h4>

      <label className="form-label">
        Classificação
      </label>

      <div
        className="d-flex gap-2 mb-3"
        role="group"
        aria-label="Classificação de uma a cinco estrelas"
      >
        {[1, 2, 3, 4, 5].map((valor) => (
          <button
            key={valor}
            type="button"
            className={`btn btn-link p-0 text-decoration-none fs-3 ${
              valor <= classificacao
                ? 'text-warning'
                : 'text-secondary'
            }`}
            onClick={() => setClassificacao(valor)}
            aria-label={`${valor} estrelas`}
            aria-pressed={classificacao === valor}
          >
            ★
          </button>
        ))}
      </div>

      <label className="form-label">
        Comentário (opcional)
      </label>

      <textarea
        className="form-control mb-3"
        rows="3"
        maxLength={1000}
        placeholder="Partilha a tua experiência..."
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
      />

      <div className="d-flex justify-content-between align-items-center">
        <small className="texto-secundario">
          {comentario.length}/1000 caracteres
        </small>

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onCancelar}
            disabled={aSubmeter}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn btn-success"
            disabled={aSubmeter}
          >
            {aSubmeter ? 'A enviar...' : 'Enviar avaliação'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="alert alert-danger mt-3 mb-0">
          {erro}
        </div>
      )}
    </form>
  );
}

export default function Encomendas() {
  const { token } = useAuth();

  const [encomendas, setEncomendas] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState({});

  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');

  const [formulario, setFormulario] = useState(null);
  const [classificacao, setClassificacao] = useState(5);
  const [comentario, setComentario] = useState('');

  const [aSubmeter, setASubmeter] = useState(false);
  const [erroAvaliacao, setErroAvaliacao] = useState('');
  const [feedback, setFeedback] = useState({});

  // Consultar as avaliações feitas numa encomenda.
  const carregarAvaliacoes = useCallback(async (encomendaId) => {
    if (!token) return;

    try {
      const dados = await api(
        `/reviews/encomenda/${encomendaId}/minhas`,
        { token }
      );

      setAvaliacoes((atuais) => ({
        ...atuais,
        [encomendaId]: {
          lista: dados,
          erro: ''
        }
      }));

    } catch (err) {
      setAvaliacoes((atuais) => ({
        ...atuais,
        [encomendaId]: {
          lista: [],
          erro: err.message || 'Não foi possível consultar as avaliações.'
        }
      }));
    }
  }, [token]);

  // Carregar encomendas e respetivas avaliações.
  const carregarEncomendas = useCallback(async () => {
    if (!token) {
      setEncomendas([]);
      setAvaliacoes({});
      setErro('É necessário iniciar sessão como comprador.');
      setACarregar(false);
      return;
    }

    setACarregar(true);
    setErro('');

    try {
      const dados = await api('/orders', { token });

      setEncomendas(dados);
      setAvaliacoes({});

      // Consultar avaliações apenas das encomendas entregues.
      const entregues = dados.filter(
        (encomenda) => encomenda.estado === 'entregue'
      );

      await Promise.all(
        entregues.map((encomenda) =>
          carregarAvaliacoes(encomenda._id)
        )
      );

    } catch (err) {
      setErro(
        err.message || 'Não foi possível carregar as encomendas.'
      );
      setEncomendas([]);
    } finally {
      setACarregar(false);
    }
  }, [token, carregarAvaliacoes]);

  useEffect(() => {
    carregarEncomendas();
  }, [carregarEncomendas]);

  // Atualizar o estado em tempo real.
  const aoAtualizarEstado = useCallback((evento) => {
    if (!evento?.id || !evento?.estado) return;

    setEncomendas((atuais) =>
      atuais.map((encomenda) =>
        String(encomenda._id) === String(evento.id)
          ? { ...encomenda, estado: evento.estado }
          : encomenda
      )
    );

    // Quando a encomenda é entregue, consultar as avaliações.
    if (evento.estado === 'entregue') {
      carregarAvaliacoes(evento.id);
    }
  }, [carregarAvaliacoes]);

  useEventoSocket('encomenda-atualizada', aoAtualizarEstado);

  useEventoSocket('leilao-ganho', carregarEncomendas);

  // Abrir o formulário de avaliação.
  function abrirFormulario(encomendaId, tipo, produtoId = null) {
    setFormulario({
      encomendaId,
      tipo,
      produtoId: produtoId ? String(produtoId) : null
    });

    setClassificacao(5);
    setComentario('');
    setErroAvaliacao('');

    setFeedback((atual) => ({
      ...atual,
      [encomendaId]: ''
    }));
  }

  function fecharFormulario() {
    setFormulario(null);
    setErroAvaliacao('');
  }

  // Submeter uma avaliação.
  async function submeterAvaliacao(e) {
    e.preventDefault();

    if (!formulario || aSubmeter) return;

    setASubmeter(true);
    setErroAvaliacao('');

    const corpo = {
      encomenda: formulario.encomendaId,
      tipo: formulario.tipo,
      classificacao,
      comentario: comentario.trim()
    };

    if (formulario.tipo === 'produto') {
      corpo.produto = formulario.produtoId;
    }

    try {
      const criada = await api('/reviews', {
        metodo: 'POST',
        corpo,
        token
      });

      // Atualizar a lista sem precisar de recarregar a página.
      setAvaliacoes((atuais) => {
        const anterior = atuais[formulario.encomendaId] || {
          lista: [],
          erro: ''
        };

        return {
          ...atuais,
          [formulario.encomendaId]: {
            lista: [...anterior.lista, criada],
            erro: ''
          }
        };
      });

      setFeedback((atual) => ({
        ...atual,
        [formulario.encomendaId]: 'Avaliação submetida com sucesso!'
      }));

      setFormulario(null);
      setComentario('');

    } catch (err) {
      setErroAvaliacao(
        err.message || 'Não foi possível submeter a avaliação.'
      );
    } finally {
      setASubmeter(false);
    }
  }

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
          {encomendas.map((encomenda) => {
            const dadosAvaliacoes = avaliacoes[encomenda._id];

            const listaAvaliacoes =
              dadosAvaliacoes?.lista || [];

            const avaliacaoProdutor = listaAvaliacoes.find(
              (avaliacao) => avaliacao.tipo === 'produtor'
            );

            const formularioProdutorAberto =
              formulario?.encomendaId === encomenda._id &&
              formulario?.tipo === 'produtor';

            return (
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

                      {encomenda.origem === 'leilao' && (
                        <span className="badge text-bg-success mb-2">
                          Ganho em leilão
                        </span>
                      )}

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
                    {(encomenda.linhas || []).map((linha, indice) => {
                      const produtoId =
                        linha.produto?._id || linha.produto;

                      const avaliacaoProduto = produtoId
                        ? listaAvaliacoes.find(
                            (avaliacao) =>
                              avaliacao.tipo === 'produto' &&
                              String(
                                avaliacao.produto?._id ||
                                avaliacao.produto
                              ) === String(produtoId)
                          )
                        : null;

                      const formularioProdutoAberto =
                        formulario?.encomendaId === encomenda._id &&
                        formulario?.tipo === 'produto' &&
                        formulario?.produtoId === String(produtoId);

                      return (
                        <li
                          key={linha._id || indice}
                          className="list-group-item"
                        >
                          <div className="d-flex justify-content-between flex-wrap gap-2">
                            <span>
                              {linha.nome} — {linha.quantidade} ×{' '}
                              {euro(linha.precoUnit)}
                            </span>

                            <strong>
                              {euro(
                                linha.quantidade * linha.precoUnit
                              )}
                            </strong>
                          </div>

                          {encomenda.estado === 'entregue' &&
                            produtoId &&
                            dadosAvaliacoes &&
                            !dadosAvaliacoes.erro && (
                              <div className="mt-2">
                                {avaliacaoProduto ? (
                                  <span className="badge text-bg-success">
                                    Produto avaliado: {avaliacaoProduto.classificacao}/5 ★
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() =>
                                      abrirFormulario(
                                        encomenda._id,
                                        'produto',
                                        produtoId
                                      )
                                    }
                                  >
                                    <span aria-hidden="true">★ </span>
                                    Avaliar produto
                                  </button>
                                )}
                              </div>
                            )}

                          {formularioProdutoAberto && (
                            <FormularioAvaliacao
                              titulo={`Avaliar ${linha.nome}`}
                              classificacao={classificacao}
                              setClassificacao={setClassificacao}
                              comentario={comentario}
                              setComentario={setComentario}
                              erro={erroAvaliacao}
                              aSubmeter={aSubmeter}
                              onSubmit={submeterAvaliacao}
                              onCancelar={fecharFormulario}
                            />
                          )}
                        </li>
                      );
                    })}
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

                  {/* Avaliações disponíveis após a entrega. */}
                  {encomenda.estado === 'entregue' && (
                    <div className="border-top mt-3 pt-3">
                      <h3 className="h6 mb-3">
                        Avaliações
                      </h3>

                      {!dadosAvaliacoes && (
                        <p className="texto-secundario small">
                          A carregar avaliações...
                        </p>
                      )}

                      {dadosAvaliacoes?.erro && (
                        <div className="alert alert-warning">
                          <p className="mb-2">
                            {dadosAvaliacoes.erro}
                          </p>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              carregarAvaliacoes(encomenda._id)
                            }
                          >
                            Tentar novamente
                          </button>
                        </div>
                      )}

                      {dadosAvaliacoes &&
                        !dadosAvaliacoes.erro && (
                          <>
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                              <div>
                                <strong>Avaliação do produtor</strong>
                                <p className="texto-secundario small mb-0">
                                  Avalia a tua experiência com o produtor.
                                </p>
                              </div>

                              {avaliacaoProdutor ? (
                                <span className="badge text-bg-success">
                                  Avaliado: {avaliacaoProdutor.classificacao}/5 ★
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-outline-success btn-sm"
                                  onClick={() =>
                                    abrirFormulario(
                                      encomenda._id,
                                      'produtor'
                                    )
                                  }
                                >
                                  ★ Avaliar produtor
                                </button>
                              )}
                            </div>

                            {formularioProdutorAberto && (
                              <FormularioAvaliacao
                                titulo="Avaliar produtor"
                                classificacao={classificacao}
                                setClassificacao={setClassificacao}
                                comentario={comentario}
                                setComentario={setComentario}
                                erro={erroAvaliacao}
                                aSubmeter={aSubmeter}
                                onSubmit={submeterAvaliacao}
                                onCancelar={fecharFormulario}
                              />
                            )}
                          </>
                        )}

                      {feedback[encomenda._id] && (
                        <div className="alert alert-success mt-3 mb-0">
                          {feedback[encomenda._id]}
                        </div>
                      )}
                    </div>
                  )}

                </article>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
