import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';

const CATEGORIAS = [
  'Hortícolas',
  'Fruta',
  'Mel',
  'Vinho',
  'Queijo',
  'Padaria',
  'Outros'
];

const EPOCAS = ['Primavera', 'Verão', 'Outono', 'Inverno'];

const FORMULARIO_INICIAL = {
  nome: '',
  categoria: 'Hortícolas',
  preco: '',
  unidade: 'kg',
  stock: '0',
  biologico: false,
  epocas: []
};

const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function Produtos() {
  const { token, utilizador } = useAuth();

  const [produtos, setProdutos] = useState([]);
  const [formulario, setFormulario] = useState({
    ...FORMULARIO_INICIAL
  });

  const [produtoEmEdicao, setProdutoEmEdicao] = useState(null);
  const [aCarregar, setACarregar] = useState(true);
  const [aGuardar, setAGuardar] = useState(false);
  const [aEliminar, setAEliminar] = useState(null);
  const [produtoParaEliminar, setProdutoParaEliminar] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregarProdutos = useCallback(async () => {
    if (!utilizador?._id) {
      setProdutos([]);
      setACarregar(false);
      return;
    }

    setACarregar(true);

    try {
      const lista = await api('/products');

      setProdutos(
        lista.filter((produto) => {
          const idProdutor =
            typeof produto.produtor === 'object'
              ? produto.produtor?._id
              : produto.produtor;

          return String(idProdutor) === String(utilizador._id);
        })
      );
    } catch (err) {
      setErro(err.message);
    } finally {
      setACarregar(false);
    }
  }, [utilizador?._id]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  function mudar(campo, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor
    }));
  }

  function alternarEpoca(epoca) {
    setFormulario((anterior) => ({
      ...anterior,
      epocas: anterior.epocas.includes(epoca)
        ? anterior.epocas.filter((item) => item !== epoca)
        : [...anterior.epocas, epoca]
    }));
  }

  function limparFormulario() {
    setFormulario({
      ...FORMULARIO_INICIAL,
      epocas: []
    });
    setProdutoEmEdicao(null);
  }

  function editar(produto) {
    setProdutoEmEdicao(produto._id);

    setFormulario({
      nome: produto.nome || '',
      categoria: produto.categoria || 'Hortícolas',
      preco: String(produto.preco),
      unidade: produto.unidade || 'kg',
      stock: String(produto.stock ?? 0),
      biologico: Boolean(produto.biologico),
      epocas: [...(produto.epocas || [])]
    });

    setErro('');
    setMensagem('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function guardar(e) {
    e.preventDefault();

    if (aGuardar) return;

    setErro('');
    setMensagem('');

    const preco = Number(formulario.preco);
    const stock = Number(formulario.stock);

    if (!formulario.nome.trim()) {
      setErro('O nome do produto é obrigatório.');
      return;
    }

    if (
      formulario.preco === '' ||
      !Number.isFinite(preco) ||
      preco < 0
    ) {
      setErro('Indica um preço válido.');
      return;
    }

    if (
      formulario.stock === '' ||
      !Number.isSafeInteger(stock) ||
      stock < 0
    ) {
      setErro('O stock deve ser um número inteiro não negativo.');
      return;
    }

    const dados = {
      nome: formulario.nome.trim(),
      categoria: formulario.categoria,
      preco,
      unidade: formulario.unidade.trim() || 'kg',
      stock,
      biologico: formulario.biologico,
      epocas: formulario.epocas
    };

    setAGuardar(true);

    try {
      if (produtoEmEdicao) {
        await api(`/products/${produtoEmEdicao}`, {
          metodo: 'PUT',
          corpo: dados,
          token
        });

        setMensagem('Produto atualizado com sucesso!');
      } else {
        await api('/products', {
          metodo: 'POST',
          corpo: dados,
          token
        });

        setMensagem('Produto criado com sucesso!');
      }

      limparFormulario();
      await carregarProdutos();
    } catch (err) {
      setErro(err.message || 'Não foi possível guardar o produto.');
    } finally {
      setAGuardar(false);
    }
  }

  
  function pedirEliminacao(produto) {
    setProdutoParaEliminar(produto);
    setErro('');
    setMensagem('');
  }

  async function eliminar() {
    if (!produtoParaEliminar || aEliminar !== null) return;

    const produto = produtoParaEliminar;

    setAEliminar(produto._id);
    setErro('');
    setMensagem('');

    try {
      await api(`/products/${produto._id}`, {
        metodo: 'DELETE',
        token
      });

      if (produtoEmEdicao === produto._id) {
        limparFormulario();
      }

      setProdutoParaEliminar(null);
      setMensagem('Produto eliminado com sucesso!');
      await carregarProdutos();
    } catch (err) {
      setErro(err.message || 'Não foi possível eliminar o produto.');
      setProdutoParaEliminar(null);
    } finally {
      setAEliminar(null);
    }
  }


  return (
    <>
      <h1 className="mb-4">Gestão de produtos</h1>

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

      <section className="card p-3 p-md-4 mb-4">
        <h2 className="h4 mb-3">
          {produtoEmEdicao ? 'Editar produto' : 'Adicionar produto'}
        </h2>

        <form onSubmit={guardar}>
          <fieldset disabled={aGuardar}>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label htmlFor="nome" className="form-label">
                  Nome do produto
                </label>

                <input
                  id="nome"
                  type="text"
                  className="form-control"
                  required
                  maxLength={150}
                  value={formulario.nome}
                  onChange={(e) => mudar('nome', e.target.value)}
                />
              </div>

              <div className="col-12 col-md-6">
                <label htmlFor="categoria" className="form-label">
                  Categoria
                </label>

                <select
                  id="categoria"
                  className="form-select"
                  value={formulario.categoria}
                  onChange={(e) => mudar('categoria', e.target.value)}
                >
                  {CATEGORIAS.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-4">
                <label htmlFor="preco" className="form-label">
                  Preço (€)
                </label>

                <input
                  id="preco"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  required
                  value={formulario.preco}
                  onChange={(e) => mudar('preco', e.target.value)}
                />
              </div>

              <div className="col-12 col-md-4">
                <label htmlFor="unidade" className="form-label">
                  Unidade
                </label>

                <input
                  id="unidade"
                  type="text"
                  className="form-control"
                  placeholder="kg, molho, unid., 500 g..."
                  value={formulario.unidade}
                  onChange={(e) => mudar('unidade', e.target.value)}
                />
              </div>

              <div className="col-12 col-md-4">
                <label htmlFor="stock" className="form-label">
                  Stock disponível
                </label>

                <input
                  id="stock"
                  type="number"
                  min="0"
                  step="1"
                  className="form-control"
                  required
                  value={formulario.stock}
                  onChange={(e) => mudar('stock', e.target.value)}
                />
              </div>

              <div className="col-12">
                <div className="form-check">
                  <input
                    id="biologico"
                    type="checkbox"
                    className="form-check-input"
                    checked={formulario.biologico}
                    onChange={(e) =>
                      mudar('biologico', e.target.checked)
                    }
                  />

                  <label
                    htmlFor="biologico"
                    className="form-check-label"
                  >
                    Produto biológico
                  </label>
                </div>
              </div>

              <div className="col-12">
                <fieldset>
                  <legend className="fs-6">
                    Épocas de disponibilidade
                  </legend>

                  <div className="d-flex flex-wrap gap-3">
                    {EPOCAS.map((epoca) => (
                      <div key={epoca} className="form-check">
                        <input
                          id={`epoca-${epoca}`}
                          type="checkbox"
                          className="form-check-input"
                          checked={formulario.epocas.includes(epoca)}
                          onChange={() => alternarEpoca(epoca)}
                        />

                        <label
                          htmlFor={`epoca-${epoca}`}
                          className="form-check-label"
                        >
                          {epoca}
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 mt-4">
              <button type="submit" className="btn btn-success">
                {aGuardar
                  ? 'A guardar...'
                  : produtoEmEdicao
                    ? 'Guardar alterações'
                    : 'Criar produto'}
              </button>

              {produtoEmEdicao && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={limparFormulario}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </fieldset>
        </form>
      </section>

      <section aria-labelledby="titulo-meus-produtos">
        <h2 id="titulo-meus-produtos" className="h4 mb-3">
          Os meus produtos ({produtos.length})
        </h2>

        {aCarregar ? (
          <p className="texto-secundario">A carregar produtos...</p>
        ) : produtos.length === 0 ? (
          <p className="texto-secundario">
            Ainda não tens produtos registados.
          </p>
        ) : (
          <div className="row g-3">
            {produtos.map((produto) => (
              <div
                key={produto._id}
                className="col-12 col-md-6 col-xl-4"
              >
                <article className="card p-3 h-100">
                  <div className="d-flex justify-content-between gap-2">
                    <h3 className="h5">{produto.nome}</h3>

                    {produto.biologico && (
                      <span className="badge text-bg-success">
                        BIO
                      </span>
                    )}
                  </div>

                  <p className="texto-secundario small mb-2">
                    {produto.categoria}
                  </p>

                  <p className="fw-bold mb-2">
                    {euro(produto.preco)} / {produto.unidade}
                  </p>

                  <p className="mb-2">
                    Stock: {produto.stock}
                  </p>

                  {produto.stock <= 5 && (
                    <p className="text-danger small fw-bold">
                      Stock baixo
                    </p>
                  )}

                  <p className="texto-secundario small">
                    Épocas: {produto.epocas?.length
                      ? produto.epocas.join(', ')
                      : 'Não especificadas'}
                  </p>

                  <div className="d-flex gap-2 mt-auto">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      disabled={aEliminar !== null || aGuardar}
                      onClick={() => editar(produto)}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      disabled={aEliminar !== null || aGuardar}
                      onClick={() => pedirEliminacao(produto)}
                    >
                      {aEliminar === produto._id
                        ? 'A eliminar...'
                        : 'Eliminar'}
                    </button>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}
      </section>

      {produtoParaEliminar && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-eliminar-produto"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-0 pb-0">
                <h2
                  id="titulo-eliminar-produto"
                  className="modal-title h4"
                >
                  Eliminar produto?
                </h2>

                <button
                  type="button"
                  className="btn-close"
                  aria-label="Fechar"
                  disabled={aEliminar !== null}
                  onClick={() => setProdutoParaEliminar(null)}
                />
              </div>

              <div className="modal-body py-4">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: 52,
                    height: 52,
                    backgroundColor: '#fce8e6',
                    color: '#b42318',
                    fontSize: 24
                  }}
                  aria-hidden="true"
                >
                  !
                </div>

                <p className="mb-2">
                  Tens a certeza de que queres eliminar o produto
                  <strong> {produtoParaEliminar.nome}</strong>?
                </p>

                <p className="texto-secundario small mb-0">
                  Esta ação é permanente e não pode ser desfeita.
                </p>
              </div>

              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={aEliminar !== null}
                  onClick={() => setProdutoParaEliminar(null)}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={aEliminar !== null}
                  onClick={eliminar}
                >
                  {aEliminar !== null
                    ? 'A eliminar...'
                    : 'Sim, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
