
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import ModeracaoProdutos from './ModeracaoProdutos.jsx';
import { useEventoSocket } from '../../context/SocketContext.jsx';

export default function PainelAdmin() {
  const { token } = useAuth();

  const [estatisticas, setEstatisticas] = useState(null);
  const [pendentes, setPendentes] = useState([]);
  const [denunciadas, setDenunciadas] = useState([]);
  const [resolvidas, setResolvidas] = useState([]);
  const [leiloes, setLeiloes] = useState([]);

  const [aCarregar, setACarregar] = useState(true);
  const [aGuardar, setAGuardar] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregarDados = useCallback(async () => {
    if (!token) {
      setErro('É necessário iniciar sessão como administrador.');
      setACarregar(false);
      return;
    }

    setACarregar(true);

    try {

      const [
        estat,
        produtores,
        avaliacoes,
        listaResolvidas,
        listaLeiloes
      ] = await Promise.all([
        api('/admin/estatisticas', { token }),
        api('/admin/produtores/pendentes', { token }),
        api('/admin/reviews/denunciadas', { token }),
        api('/admin/reviews/resolvidas', { token }),
        api('/auctions?estado=ativo')
      ]);


      setEstatisticas(estat);
      setPendentes(produtores);
      setDenunciadas(avaliacoes);
      setResolvidas(listaResolvidas);

      // Considerar apenas leilões dentro do período ativo.
      const agora = Date.now();
      setLeiloes(
        listaLeiloes.filter((leilao) =>
          leilao.estado === 'ativo' &&
          new Date(leilao.iniciaEm).getTime() <= agora &&
          new Date(leilao.terminaEm).getTime() > agora
        )
      );
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar os dados.');
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);



  // Atualizar o painel quando um leilão é criado
  // ou muda de estado (agendado, ativo, terminado).
  const aoAtualizarLeilao = useCallback(() => {
    carregarDados();
  }, [carregarDados]);

  useEventoSocket('leilao-criado', aoAtualizarLeilao);
  useEventoSocket('leilao-atualizado', aoAtualizarLeilao);

  async function decidirProdutor(id, aprovado) {
    setAGuardar(id);
    setErro('');
    setMensagem('');

    try {
      await api(`/admin/produtores/${id}/validacao`, {
        metodo: 'PATCH',
        corpo: { aprovado },
        token
      });

      setMensagem(
        aprovado
          ? 'Produtor aprovado com sucesso!'
          : 'Pedido do produtor rejeitado com sucesso.'
      );
    } catch (err) {
      setErro(err.message || 'Não foi possível decidir o pedido.');
    } finally {
      // Reconsultar a BD mesmo quando a resposta é um erro,
      // para não apresentar pedidos que já foram decididos.
      await carregarDados();
      setAGuardar(null);
    }
  }




  async function resolverDenuncia(avaliacao, visivel) {
    setAGuardar(avaliacao._id);
    setErro('');
    setMensagem('');

    try {
      await api(`/admin/reviews/${avaliacao._id}`, {
        metodo: 'PATCH',
        corpo: { visivel },
        token
      });

      setMensagem(
        visivel
          ? 'Denúncia resolvida. A avaliação permanece visível.'
          : 'Denúncia resolvida. A avaliação foi ocultada.'
      );

      await carregarDados();
    } catch (err) {
      setErro(err.message || 'Erro ao resolver a denúncia.');
    } finally {
      setAGuardar(null);
    }
  }


  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <h1 className="mb-0">Administração</h1>

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={carregarDados}
          disabled={aCarregar || aGuardar !== null}
        >
          Atualizar dados
        </button>
      </div>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="alert alert-success" role="status">
          {mensagem}
        </div>
      )}

      {aCarregar && (
        <p className="texto-secundario">A carregar dados...</p>
      )}

      {!aCarregar && (
        <>
          <section className="mb-5" aria-labelledby="titulo-estatisticas">
            <h2 id="titulo-estatisticas" className="h4 mb-3">
              Estatísticas gerais
            </h2>

            {estatisticas && (
              <div className="row g-3">
                {[
                  ['Utilizadores', estatisticas.utilizadores],
                  ['Produtores', estatisticas.produtores],
                  ['Encomendas de hoje', estatisticas.encomendasHoje],
                  ['Leilões ativos', estatisticas.leiloesAtivos]
                ].map(([titulo, valor]) => (
                  <div key={titulo} className="col-6 col-lg-3">
                    <div className="card h-100 p-3">
                      <p className="texto-secundario mb-2">{titulo}</p>
                      <strong className="fs-3">{valor}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-5" aria-labelledby="titulo-pendentes">
            <h2 id="titulo-pendentes" className="h4 mb-3">
              Produtores por validar ({pendentes.length})
            </h2>

            {pendentes.length === 0 ? (
              <p className="texto-secundario">
                Não existem produtores pendentes.
              </p>
            ) : (
              <div className="row g-3">
                {pendentes.map((produtor) => (
                  <div key={produtor._id} className="col-12 col-lg-6">
                    <div className="card p-3 h-100">
                      <h3 className="h5">
                        {produtor.produtor?.nomeExploracao || produtor.nome}
                      </h3>

                      <p className="mb-1">{produtor.nome}</p>
                      <p className="texto-secundario small">
                        {produtor.email}
                      </p>

                      {produtor.produtor?.localidade && (
                        <p className="small">
                          {produtor.produtor.localidade}
                        </p>
                      )}

                      <div className="d-flex flex-wrap gap-2 mt-auto">
                        <button
                          type="button"
                          className="btn btn-success flex-fill"
                          disabled={aGuardar !== null}
                          onClick={() => decidirProdutor(produtor._id, true)}
                        >
                          {aGuardar === produtor._id
                            ? 'A processar...'
                            : 'Aprovar produtor'}
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-danger flex-fill"
                          disabled={aGuardar !== null}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Tens a certeza de que queres rejeitar este produtor?'
                              )
                            ) {
                              decidirProdutor(produtor._id, false);
                            }
                          }}
                        >
                          Rejeitar produtor
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-5" aria-labelledby="titulo-avaliacoes">
            <h2 id="titulo-avaliacoes" className="h4 mb-3">
              Avaliações denunciadas ({denunciadas.length})
            </h2>

            {denunciadas.length === 0 ? (
              <p className="texto-secundario">
                Não existem avaliações denunciadas.
              </p>
            ) : (
              <div className="row g-3">
                {denunciadas.map((avaliacao) => (
                  <div key={avaliacao._id} className="col-12 col-lg-6">
                    <div className="card p-3 h-100">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <h3 className="h5">
                          {avaliacao.produto?.nome || 'Avaliação de produtor'}
                        </h3>

                        <span className="badge text-bg-warning">
                          {avaliacao.denuncias} denúncia(s)
                        </span>
                      </div>

                      <p className="mb-1">
                        Classificação: {avaliacao.classificacao}/5
                      </p>

                      <p className="texto-secundario small mb-2">
                        Por {avaliacao.autor?.nome || 'Utilizador'}
                      </p>

                      <p>{avaliacao.comentario || 'Sem comentário.'}</p>

                      <p className="small">
                        Estado: {avaliacao.visivel ? 'Visível' : 'Oculta'}
                      </p>

                      <div className="d-flex flex-wrap gap-2 mt-auto">
                        <button
                          type="button"
                          className="btn btn-outline-success flex-fill"
                          disabled={aGuardar !== null}
                          onClick={() => resolverDenuncia(avaliacao, true)}
                        >
                          Manter visível e resolver
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-danger flex-fill"
                          disabled={aGuardar !== null}
                          onClick={() => resolverDenuncia(avaliacao, false)}
                        >
                          Ocultar e resolver
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-5" aria-labelledby="titulo-resolvidas">
            <h2 id="titulo-resolvidas" className="h4 mb-3">
              Histórico de denúncias resolvidas ({resolvidas.length})
            </h2>

            {resolvidas.length === 0 ? (
              <p className="texto-secundario">
                Ainda não existem denúncias resolvidas.
              </p>
            ) : (
              <div className="row g-3">
                {resolvidas.map((avaliacao) => (
                  <div key={avaliacao._id} className="col-12 col-md-6">
                    <article className="card p-3 h-100">
                      <div className="d-flex justify-content-between gap-2">
                        <h3 className="h5 mb-0">
                          {avaliacao.produto?.nome ||
                            avaliacao.produtor?.produtor?.nomeExploracao ||
                            'Avaliação de produtor'}
                        </h3>

                        <span className="badge text-bg-success">
                          Resolvida
                        </span>
                      </div>

                      <p className="texto-secundario small mt-2 mb-1">
                        {avaliacao.denuncias} denúncia(s)
                      </p>

                      <p className="mb-1">
                        Por {avaliacao.autor?.nome || 'Utilizador'}
                      </p>

                      <p>{avaliacao.comentario || 'Sem comentário.'}</p>

                      <p className="mb-1">
                        <strong>Decisão:</strong>{' '}
                        {avaliacao.visivel
                          ? 'Manter comentário visível'
                          : 'Ocultar comentário'}
                      </p>

                      {avaliacao.moderadoEm && (
                        <p className="texto-secundario small mb-0">
                          Decidido em:{' '}
                          {new Date(avaliacao.moderadoEm).toLocaleString('pt-PT')}
                        </p>
                      )}
                    </article>
                  </div>
                ))}
              </div>
            )}
          </section>

          <ModeracaoProdutos />
          <section className="mb-4" aria-labelledby="titulo-leiloes">
            <h2 id="titulo-leiloes" className="h4 mb-3">
              Leilões ativos ({leiloes.length})
            </h2>

            {leiloes.length === 0 ? (
              <p className="texto-secundario">
                Não existem leilões ativos neste momento.
              </p>
            ) : (
              <div className="row g-3">
                {leiloes.map((leilao) => (
                  <div key={leilao._id} className="col-12 col-lg-6">
                    <div className="card p-3 h-100">
                      <h3 className="h5">{leilao.lote}</h3>

                      <p className="texto-secundario small">
                        Termina em:{' '}
                        {new Date(leilao.terminaEm).toLocaleString('pt-PT')}
                      </p>

                      <Link
                        to={`/leiloes/${leilao._id}`}
                        className="btn btn-outline-success mt-auto"
                      >
                        Ver leilão
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
