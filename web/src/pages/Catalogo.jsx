import { useEffect, useState } from 'react';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import produtosSimulados from '../data/produtos.json';
import DestaqueLeilao from '../components/DestaqueLeilao.jsx';

const CATEGORIAS = ['Todos', 'Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria'];

const FILTRO_INICIAL = {
  q: '',
  localidade: '',
  categoria: 'Todos',
  bio: false,
  epoca: '',
  precoMax: '',
  ordenar: 'recentes'
};

export default function Catalogo() {
  const [produtos, setProdutos] = useState([]);
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(true);

  const carrinho = useCarrinho();
  const { utilizador } = useAuth();

  useEffect(() => {
    let ativo = true;

    setErro('');
    setACarregar(true);

    if (USAR_DADOS_SIMULADOS) {
      const lista = produtosSimulados
        .filter((p) =>
          (filtro.categoria === 'Todos' || p.categoria === filtro.categoria) &&
          (!filtro.localidade ||
          (p.produtor?.produtor?.localidade || '')
            .toLowerCase()
            .includes(filtro.localidade.trim().toLowerCase())) &&
          (!filtro.bio || p.biologico) &&
          (!filtro.epoca || p.epocas?.includes(filtro.epoca)) &&
          (filtro.precoMax === '' || p.preco <= Number(filtro.precoMax)) &&
          [
            p.nome,
            p.produtor?.nome,
            p.produtor?.produtor?.nomeExploracao,
            ...(p.ingredientes || [])
          ]
            .filter(Boolean)
            .some((texto) =>
              texto.toLowerCase().includes(filtro.q.trim().toLowerCase())
            )
        )
        .sort((a, b) => {
          if (filtro.ordenar === 'preco_asc') return a.preco - b.preco;
          if (filtro.ordenar === 'preco_desc') return b.preco - a.preco;
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

      setProdutos(lista);
      setACarregar(false);
      return;
    }

    const parametros = new URLSearchParams();

    if (filtro.q) parametros.set('q', filtro.q);
    if (filtro.localidade.trim()) {
      parametros.set('localidade', filtro.localidade.trim());
    }
    if (filtro.categoria !== 'Todos') {
      parametros.set('categoria', filtro.categoria);
    }
    if (filtro.bio) parametros.set('bio', 'true');
    if (filtro.epoca) parametros.set('epoca', filtro.epoca);
    if (filtro.precoMax !== '') {
      parametros.set('precoMax', filtro.precoMax);
    }
    parametros.set('ordenar', filtro.ordenar);

    api(`/products?${parametros.toString()}`)
      .then((lista) => {
        if (ativo) setProdutos(lista);
      })
      .catch((e) => {
        if (ativo) {
          setErro(e.message);
          setProdutos([]);
        }
      })
      .finally(() => {
        if (ativo) setACarregar(false);
      });

    return () => {
      ativo = false;
    };
  }, [filtro]);

  const mudar = (campo) => (e) => {
    const valor = e.target.type === 'checkbox'
      ? e.target.checked
      : e.target.value;

    setFiltro((anterior) => ({
      ...anterior,
      [campo]: valor
    }));
  };

  return (
    <>
      <section className="destaque mb-4">
        <h1>Direto de quem produz, para a sua mesa.</h1>
        <p className="texto-secundario">
          Produtores do Alto Minho. Encomende ou dispute os lotes
          da época nos leilões em direto.
        </p>
      </section>

      <DestaqueLeilao />

      <section className="filtros mb-3" aria-label="Filtros">
        <label className="visually-hidden" htmlFor="pesquisa">
          Pesquisar
        </label>
        <input
          id="pesquisa"
          type="search"
          className="form-control"
          placeholder="Pesquisar produtos, ingredientes ou produtores..."
          value={filtro.q}
          onChange={mudar('q')}
        />

        <div className="d-flex flex-wrap gap-2">
          {CATEGORIAS.map((categoria) => (
            <button
              key={categoria}
              type="button"
              className={`btn btn-sm ${
                filtro.categoria === categoria
                  ? 'btn-dark'
                  : 'btn-outline-secondary'
              }`}
              onClick={() =>
                setFiltro((anterior) => ({
                  ...anterior,
                  categoria
                }))
              }
            >
              {categoria}
            </button>
          ))}
        </div>

        <div className="form-check">
          <input
            id="bio"
            className="form-check-input"
            type="checkbox"
            checked={filtro.bio}
            onChange={mudar('bio')}
          />
          <label className="form-check-label" htmlFor="bio">
            Só biológico
          </label>
        </div>
        <div className="row g-2">

          <div className="col-12 col-md-6 col-lg-3">
            <label htmlFor="localidade" className="form-label">
              Localidade do produtor
            </label>
            <input
              id="localidade"
              type="search"
              className="form-control"
              placeholder="Ex.: Ponte de Lima"
              value={filtro.localidade}
              onChange={mudar('localidade')}
            />
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label htmlFor="epoca" className="form-label">
              Época do ano
            </label>
            <select
              id="epoca"
              className="form-select"
              value={filtro.epoca}
              onChange={mudar('epoca')}
            >
              <option value="">Todas as épocas</option>
              <option value="Primavera">Primavera</option>
              <option value="Verão">Verão</option>
              <option value="Outono">Outono</option>
              <option value="Inverno">Inverno</option>
            </select>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label htmlFor="precoMax" className="form-label">
              Preço máximo (€)
            </label>
            <input
              id="precoMax"
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              placeholder="Sem limite"
              value={filtro.precoMax}
              onChange={mudar('precoMax')}
            />
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label htmlFor="ordenar" className="form-label">
              Ordenar por
            </label>
            <select
              id="ordenar"
              className="form-select"
              value={filtro.ordenar}
              onChange={mudar('ordenar')}
            >
              <option value="recentes">Mais recentes</option>
              <option value="preco_asc">Preço: mais baixo</option>
              <option value="preco_desc">Preço: mais alto</option>
            </select>
          </div>

        </div>


        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setFiltro({ ...FILTRO_INICIAL })}
        >
          Limpar filtros
        </button>
      </section>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {aCarregar ? (
        <p className="texto-secundario">A carregar produtos...</p>
      ) : (
        <>
          <section className="grelha-produtos" aria-label="Produtos">
            {produtos.map((produto) => (
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
          </section>

          {!erro && produtos.length === 0 && (
            <p className="texto-secundario">
              Nenhum produto encontrado.
            </p>
          )}
        </>
      )}
    </>
  );
}
