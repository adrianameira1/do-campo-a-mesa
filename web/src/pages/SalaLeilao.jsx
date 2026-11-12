
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';

const euro = (valor) =>
  Number(valor ?? 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

const formatarData = (data) =>
  data
    ? new Date(data).toLocaleString('pt-PT')
    : 'Não definida';

const estados = {
  agendado: 'Agendado',
  ativo: 'Em direto',
  terminado: 'Terminado'
};

export default function SalaLeilao() {
  const { id } = useParams();

  const [leilao, setLeilao] = useState(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [agora, setAgora] = useState(Date.now());

  // Consultar os detalhes do leilão através da API REST
  useEffect(() => {
    let ativo = true;

    async function carregarLeilao() {
      setACarregar(true);
      setErro('');
      setLeilao(null);

      try {
        const dados = await api(`/auctions/${id}`);

        if (ativo) {
          setLeilao(dados.leilao);
        }
      } catch (err) {
        if (ativo) {
          setErro(
            err.message || 'Não foi possível carregar o leilão.'
          );
        }
      } finally {
        if (ativo) {
          setACarregar(false);
        }
      }
    }

    carregarLeilao();

    return () => {
      ativo = false;
    };
  }, [id]);

  // Atualizar a hora para refletir a passagem do tempo
  useEffect(() => {
    const intervalo = setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  if (aCarregar) {
    return <p>A carregar leilão...</p>;
  }

  if (erro || !leilao) {
    return (
      <>
        <h1>Leilão</h1>

        <div className="alert alert-danger" role="alert">
          {erro || 'Leilão não encontrado.'}
        </div>

        <Link to="/leiloes" className="btn btn-outline-secondary">
          Voltar aos leilões
        </Link>
      </>
    );
  }

  const nomeProdutor =
    leilao.produtor?.produtor?.nomeExploracao ||
    leilao.produtor?.nome ||
    'Produtor';

  const valorAtual =
    leilao.licitacaoAtual?.valor ?? leilao.precoBase;

  const inicio = new Date(leilao.iniciaEm).getTime();
  const fim = new Date(leilao.terminaEm).getTime();

  // Estado apresentado de acordo com as datas do leilão
  const estadoApresentado =
    leilao.estado === 'terminado' || agora >= fim
      ? 'terminado'
      : agora < inicio
        ? 'agendado'
        : 'ativo';

  return (
    <>
      <div className="mb-4">
        <Link
          to="/leiloes"
          className="btn btn-outline-secondary btn-sm"
        >
          Voltar aos leilões
        </Link>
      </div>

      <div className="sala-leilao">
        <section>
          <div className="card p-3 p-md-4">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
              <h1 className="mb-0">{leilao.lote}</h1>

              <span
                className={`badge ${
                  estadoApresentado === 'ativo'
                    ? 'bg-success'
                    : 'bg-secondary'
                }`}
              >
                {estados[estadoApresentado]}
              </span>
            </div>

            <p className="mb-3">
              <strong>Produtor:</strong> {nomeProdutor}
            </p>

            {leilao.produto && (
              <div className="mb-3">
                <h2 className="h5">Produto associado</h2>

                <p className="mb-1">
                  {leilao.produto.nome}
                </p>

                <p className="texto-secundario small mb-0">
                  Categoria: {leilao.produto.categoria}
                </p>
              </div>
            )}

            {leilao.produto?.imagemUrl && (
              <img
                src={leilao.produto.imagemUrl}
                alt={leilao.produto.nome}
                className="img-fluid rounded mb-3"
                style={{
                  maxHeight: 320,
                  objectFit: 'cover'
                }}
              />
            )}

            <h2 className="h5">Informações do leilão</h2>

            <dl className="row mb-0">
              <dt className="col-sm-5">Quantidade</dt>
              <dd className="col-sm-7">
                {leilao.quantidade}
              </dd>

              <dt className="col-sm-5">Preço base</dt>
              <dd className="col-sm-7">
                {euro(leilao.precoBase)}
              </dd>

              <dt className="col-sm-5">Incremento mínimo</dt>
              <dd className="col-sm-7">
                {euro(leilao.incremento)}
              </dd>

              <dt className="col-sm-5">Data de início</dt>
              <dd className="col-sm-7">
                {formatarData(leilao.iniciaEm)}
              </dd>

              <dt className="col-sm-5">Data de fim</dt>
              <dd className="col-sm-7">
                {formatarData(leilao.terminaEm)}
              </dd>
            </dl>
          </div>
        </section>

        <aside className="card p-3">
          <h2 className="h5">Licitação atual</h2>

          <p className="valor-atual mb-3">
            {euro(valorAtual)}
          </p>

          {estadoApresentado === 'agendado' && (
            <div className="alert alert-info mb-0">
              Este leilão ainda não começou.

              <p className="mb-0 mt-2">
                Início previsto:{' '}
                <strong>
                  {formatarData(leilao.iniciaEm)}
                </strong>
              </p>
            </div>
          )}

          {estadoApresentado === 'terminado' && (
            <div className="alert alert-secondary mb-0">
              Este leilão já terminou.
            </div>
          )}

          {estadoApresentado === 'ativo' && (
            <div className="alert alert-info mb-0">
              Este leilão está dentro do período previsto
              de funcionamento.

              <p className="mb-0 mt-2">
                A funcionalidade de licitação em direto
                será disponibilizada no Passo 7.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
