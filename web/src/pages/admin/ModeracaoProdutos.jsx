
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';

const euro = (valor) =>
  Number(valor || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function ModeracaoProdutos() {
  const { token } = useAuth();

  const [produtos, setProdutos] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [aCarregar, setACarregar] = useState(true);
  const [aGuardar, setAGuardar] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregarProdutos = useCallback(async () => {
    if (!token) return;

    setACarregar(true);
    setErro('');

    try {
      const lista = await api('/admin/products', { token });
      setProdutos(lista);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar produtos.');
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  async function alterarVisibilidade(produto) {
    if (aGuardar !== null) return;

    const visivel = produto.visivel === false;

    setAGuardar(produto._id);
    setErro('');
    setMensagem('');

    try {
      const atualizado = await api(
        `/admin/products/${produto._id}/visibilidade`,
        {
          metodo: 'PATCH',
          corpo: { visivel },
          token
        }
      );

      setProdutos((anteriores) =>
        anteriores.map((item) =>
          item._id === produto._id ? atualizado : item
        )
      );

      setMensagem(
        visivel
          ? 'Produto novamente visível no catálogo.'
          : 'Produto ocultado do catálogo.'
      );
    } catch (err) {
      setErro(err.message || 'Não foi possível alterar o produto.');
    } finally {
      setAGuardar(null);
    }
  }

  const visiveis = produtos.filter(
    (produto) => produto.visivel !== false
  ).length;

  const ocultos = produtos.length - visiveis;

  const filtrados = produtos.filter((produto) => {
    if (filtro === 'visiveis') return produto.visivel !== false;
    if (filtro === 'ocultos') return produto.visivel === false;
    return true;
  });

  return (
    <section className="mb-5" aria-labelledby="titulo-moderacao">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h2 id="titulo-moderacao" className="h4 mb-0">
          Moderação de produtos
        </h2>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={carregarProdutos}
          disabled={aCarregar || aGuardar !== null}
        >
          Atualizar produtos
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

      <div className="d-flex flex-wrap gap-2 mb-4">
        {[
          ['todos', `Todos (${produtos.length})`],
          ['visiveis', `Visíveis (${visiveis})`],
          ['ocultos', `Ocultos (${ocultos})`]
        ].map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            className={
              filtro === valor
                ? 'btn btn-success btn-sm'
                : 'btn btn-outline-success btn-sm'
            }
            onClick={() => setFiltro(valor)}
          >
            {texto}
          </button>
        ))}
      </div>

      {aCarregar ? (
        <p className="texto-secundario">A carregar produtos...</p>
      ) : filtrados.length === 0 ? (
        <p className="texto-secundario">
          Não existem produtos nesta categoria.
        </p>
      ) : (
        <div className="row g-3">
          {filtrados.map((produto) => {
            const visivel = produto.visivel !== false;

            return (
              <div key={produto._id} className="col-12 col-lg-6">
                <article className="card p-3 h-100">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <h3 className="h5 mb-0">{produto.nome}</h3>

                    <span
                      className={`badge ${
                        visivel
                          ? 'text-bg-success'
                          : 'text-bg-secondary'
                      }`}
                    >
                      {visivel ? 'Visível' : 'Oculto'}
                    </span>
                  </div>

                  <p className="texto-secundario small mb-2">
                    Produtor:{' '}
                    {produto.produtor?.produtor?.nomeExploracao ||
                      produto.produtor?.nome ||
                      'Desconhecido'}
                  </p>

                  <p className="mb-1">
                    <strong>Categoria:</strong> {produto.categoria}
                  </p>

                  <p className="mb-1">
                    <strong>Preço:</strong> {euro(produto.preco)}
                  </p>

                  <p className="mb-3">
                    <strong>Stock:</strong> {produto.stock}
                  </p>

                  <button
                    type="button"
                    className={`btn mt-auto ${
                      visivel
                        ? 'btn-outline-danger'
                        : 'btn-outline-success'
                    }`}
                    disabled={aGuardar !== null}
                    onClick={() => alterarVisibilidade(produto)}
                  >
                    {aGuardar === produto._id
                      ? 'A guardar...'
                      : visivel
                        ? 'Ocultar produto'
                        : 'Voltar a mostrar'}
                  </button>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
