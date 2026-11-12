
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

const formularioInicial = {
  produto: '',
  lote: '',
  quantidade: '1',
  precoBase: '',
  incremento: '0.50',
  iniciaEm: '',
  duracaoMinutos: '60'
};

export default function NovoLeilao() {
  const { token, utilizador } = useAuth();

  const [formulario, setFormulario] = useState(formularioInicial);
  const [produtos, setProdutos] = useState([]);
  const [aCarregarProdutos, setACarregarProdutos] = useState(true);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function carregarProdutos() {
      setACarregarProdutos(true);

      try {
        const dados = await api(
          `/products?produtor=${utilizador._id}`
        );

        if (ativo) {
          setProdutos(dados);
        }
      } catch (err) {
        if (ativo) {
          setErro(
            err.message || 'Não foi possível carregar os produtos.'
          );
        }
      } finally {
        if (ativo) {
          setACarregarProdutos(false);
        }
      }
    }

    if (utilizador?._id) {
      carregarProdutos();
    } else {
      setACarregarProdutos(false);
      setErro('Não foi possível identificar o produtor.');
    }

    return () => {
      ativo = false;
    };
  }, [utilizador?._id]);

  function alterarCampo(evento) {
    const { name, value } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value
    }));

    setErro('');
  }

  async function criarLeilao(evento) {
    evento.preventDefault();

    setErro('');
    setSucesso(null);

    const quantidade = Number(formulario.quantidade);
    const precoBase = Number(formulario.precoBase);
    const incremento = Number(formulario.incremento);
    const duracaoMinutos = Number(formulario.duracaoMinutos);

    const inicio = new Date(formulario.iniciaEm);

    if (!formulario.produto) {
      setErro('Seleciona um produto.');
      return;
    }

    if (!formulario.lote.trim()) {
      setErro('Indica a descrição do lote.');
      return;
    }

    if (
      !Number.isSafeInteger(quantidade) ||
      quantidade <= 0
    ) {
      setErro('A quantidade deve ser um número inteiro positivo.');
      return;
    }

    if (
      !Number.isFinite(precoBase) ||
      precoBase < 0 ||
      formulario.precoBase === ''
    ) {
      setErro('Indica um preço base válido.');
      return;
    }

    if (
      !Number.isFinite(incremento) ||
      incremento < 0.01
    ) {
      setErro('O incremento mínimo deve ser de 0,01 €.');
      return;
    }

    if (
      !formulario.iniciaEm ||
      Number.isNaN(inicio.getTime()) ||
      inicio.getTime() <= Date.now()
    ) {
      setErro('A data de início deve ser futura.');
      return;
    }

    if (
      !Number.isSafeInteger(duracaoMinutos) ||
      duracaoMinutos <= 0
    ) {
      setErro('A duração deve ser um número inteiro positivo.');
      return;
    }

    setAGuardar(true);

    try {
      const novoLeilao = await api('/auctions', {
        metodo: 'POST',
        token,
        corpo: {
          produto: formulario.produto,
          lote: formulario.lote.trim(),
          quantidade,
          precoBase,
          incremento,
          iniciaEm: inicio.toISOString(),
          duracaoMinutos
        }
      });

      setSucesso(novoLeilao);
      setFormulario(formularioInicial);
    } catch (err) {
      setErro(
        err.message || 'Não foi possível criar o leilão.'
      );
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <div className="formulario-estreito">
      <div className="mb-4">
        <Link
          to="/produtor"
          className="btn btn-outline-secondary btn-sm"
        >
          Voltar ao painel
        </Link>
      </div>

      <h1 className="mb-3">Criar leilão</h1>

      <p className="texto-secundario mb-4">
        Configura o lote, o preço inicial e a duração
        do leilão. A publicação ficará agendada para
        a data indicada.
      </p>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="alert alert-success" role="status">
          <h2 className="h5">Leilão criado com sucesso!</h2>

          <p className="mb-2">
            <strong>Lote:</strong> {sucesso.lote}
          </p>

          <p className="mb-2">
            <strong>Estado:</strong> {sucesso.estado}
          </p>

          <p className="mb-3">
            <strong>Início:</strong>{' '}
            {new Date(sucesso.iniciaEm).toLocaleString('pt-PT')}
          </p>

          <Link
            to={`/leiloes/${sucesso._id}`}
            className="btn btn-outline-success btn-sm"
          >
            Consultar leilão
          </Link>
        </div>
      )}

      <form onSubmit={criarLeilao} className="card p-3 p-md-4">
        <div className="mb-3">
          <label htmlFor="produto" className="form-label">
            Produto
          </label>

          <select
            id="produto"
            name="produto"
            className="form-select"
            value={formulario.produto}
            onChange={alterarCampo}
            disabled={aCarregarProdutos || aGuardar}
            required
          >
            <option value="">
              {aCarregarProdutos
                ? 'A carregar produtos...'
                : 'Seleciona um produto'}
            </option>

            {produtos.map((produto) => (
              <option
                key={produto._id}
                value={produto._id}
              >
                {produto.nome}
              </option>
            ))}
          </select>

          {!aCarregarProdutos && produtos.length === 0 && (
            <p className="texto-secundario small mt-2 mb-0">
              Ainda não tens produtos disponíveis.
              Cria primeiro um produto.
            </p>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="lote" className="form-label">
            Descrição do lote
          </label>

          <input
            id="lote"
            name="lote"
            type="text"
            className="form-control"
            placeholder="Ex.: Lote de 10 kg de kiwi"
            value={formulario.lote}
            onChange={alterarCampo}
            maxLength={200}
            required
            disabled={aGuardar}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="quantidade" className="form-label">
            Quantidade
          </label>

          <input
            id="quantidade"
            name="quantidade"
            type="number"
            min="1"
            step="1"
            className="form-control"
            value={formulario.quantidade}
            onChange={alterarCampo}
            disabled={aGuardar}
            required
          />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-sm-6">
            <label htmlFor="precoBase" className="form-label">
              Preço base (€)
            </label>

            <input
              id="precoBase"
              name="precoBase"
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              placeholder="10.00"
              value={formulario.precoBase}
              onChange={alterarCampo}
              required
              disabled={aGuardar}
            />
          </div>

          <div className="col-12 col-sm-6">
            <label htmlFor="incremento" className="form-label">
              Incremento mínimo (€)
            </label>

            <input
              id="incremento"
              name="incremento"
              type="number"
              min="0.01"
              step="0.01"
              className="form-control"
              value={formulario.incremento}
              onChange={alterarCampo}
              required
              disabled={aGuardar}
            />
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="iniciaEm" className="form-label">
            Data e hora de início
          </label>

          <input
            id="iniciaEm"
            name="iniciaEm"
            type="datetime-local"
            className="form-control"
            value={formulario.iniciaEm}
            onChange={alterarCampo}
            required
            disabled={aGuardar}
          />

          <div className="form-text">
            Escolhe uma data e hora futuras.
          </div>
        </div>

        <div className="mb-4">
          <label
            htmlFor="duracaoMinutos"
            className="form-label"
          >
            Duração do leilão (minutos)
          </label>

          <input
            id="duracaoMinutos"
            name="duracaoMinutos"
            type="number"
            min="1"
            step="1"
            className="form-control"
            value={formulario.duracaoMinutos}
            onChange={alterarCampo}
            required
            disabled={aGuardar}
          />
        </div>

        <button
          type="submit"
          className="btn btn-success w-100"
          disabled={
            aGuardar ||
            aCarregarProdutos ||
            produtos.length === 0
          }
        >
          {aGuardar ? 'A criar leilão...' : 'Criar leilão'}
        </button>
      </form>
    </div>
  );
}
