
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import leiloesSimulados from '../data/leiloes.js';

const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

function tempoRestante(terminaEm, agora) {
  const segundos = Math.max(
    0,
    Math.floor((new Date(terminaEm).getTime() - agora) / 1000)
  );

  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const seg = segundos % 60;

  return [horas, minutos, seg]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export default function Leiloes() {
  const [leiloes, setLeiloes] = useState([]);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(true);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    let ativo = true;

    if (USAR_DADOS_SIMULADOS) {
      setLeiloes(leiloesSimulados);
      setACarregar(false);
    } else {
      api('/auctions')
        .then((dados) => {
          if (ativo) {
            const agora = Date.now();

            const leiloesEmCurso = dados.filter((leilao) => {
              const inicio = new Date(leilao.iniciaEm).getTime();
              const fim = new Date(leilao.terminaEm).getTime();

              return (
                leilao.estado !== 'terminado' &&
                inicio <= agora &&
                fim > agora
              );
            });

            setLeiloes(leiloesEmCurso);
          }
        })
        .catch((e) => {
          if (ativo) setErro(e.message);
        })
        .finally(() => {
          if (ativo) setACarregar(false);
        });
    }

    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  return (
    <section aria-labelledby="titulo-leiloes">
      <h1 id="titulo-leiloes" className="mb-4">
        Leilões
      </h1>

      {aCarregar && <p>A carregar leilões...</p>}

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {!aCarregar && !erro && leiloes.length === 0 && (
        <p>Não existem leilões ativos neste momento.</p>
      )}

      <div className="row g-3">
        {leiloes.map((leilao) => (
          <div className="col-12 col-md-6 col-lg-4" key={leilao._id}>
            <article className="card h-100">
              <div className="card-body d-flex flex-column">

                <span className="badge bg-success align-self-start mb-3">
                  {leilao.estado === 'ativo'
                    ? 'Em direto'
                    : leilao.estado}
                </span>

                <h2 className="h5">{leilao.lote}</h2>

                <p className="texto-secundario small">
                  {leilao.produtor?.nome}
                  {leilao.produtor?.produtor?.localidade &&
                    ` · ${leilao.produtor.produtor.localidade}`}
                </p>

                <p className="mb-1">Licitação atual</p>

                <p className="fs-4 fw-bold text-success">
                  {euro(
                    leilao.licitacaoAtual?.valor ??
                    leilao.precoBase
                  )}
                </p>

                <p>
                  <strong>Tempo restante:</strong>{' '}
                  {tempoRestante(leilao.terminaEm, agora)}
                </p>

                <Link
                  to={`/leiloes/${leilao._id}`}
                  className="btn btn-success mt-auto"
                >
                  Entrar na sala
                </Link>

              </div>
            </article>
          </div>
        ))}
      </div>

      {USAR_DADOS_SIMULADOS && (
        <p className="texto-secundario small mt-3">
          Demonstração com dados simulados.
        </p>
      )}
    </section>
  );
}
