
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import leiloesSimulados from '../data/leiloes.js';

const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

function estaEmDireto(leilao, agora) {
  const inicio = new Date(leilao.iniciaEm).getTime();
  const fim = new Date(leilao.terminaEm).getTime();

  return (
    leilao.estado === 'ativo' &&
    inicio <= agora &&
    fim > agora
  );
}

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

export default function DestaqueLeilao() {
  const [leiloes, setLeiloes] = useState([]);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    let ativo = true;

    if (USAR_DADOS_SIMULADOS) {
      setLeiloes(leiloesSimulados);
    } else {
      api('/auctions')
        .then((dados) => {
          if (ativo && Array.isArray(dados)) {
            setLeiloes(dados);
          }
        })
        .catch(() => {
          if (ativo) setLeiloes([]);
        });
    }

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  const leilao = leiloes
    .filter((item) => estaEmDireto(item, agora))
    .sort(
      (a, b) =>
        new Date(a.terminaEm) - new Date(b.terminaEm)
    )[0];

    if (!leilao) {
        return (
            <section className="card mb-4" aria-label="Leilões">
            <div className="card-body">
                <h2 className="h5">Leilões em direto</h2>

                <p className="texto-secundario">
                Não existem leilões em direto neste momento.
                Consulte os próximos leilões disponíveis.
                </p>

                <Link to="/leiloes" className="btn btn-outline-success">
                Ver leilões
                </Link>
            </div>
            </section>
        );
    }

  return (
    <section
      className="card border-success mb-4"
      aria-label="Leilão em destaque"
    >
      <div className="card-body">
        <span className="badge bg-danger mb-3">
          EM DIRETO
        </span>

        <h2 className="h4">
          Leilão em destaque: {leilao.lote}
        </h2>

        <p className="texto-secundario">
          {leilao.produtor?.nome || 'Produtor local'}
        </p>

        <p className="mb-1">Licitação atual</p>

        <p className="fs-3 fw-bold text-success">
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
          className="btn btn-success"
        >
          Ver leilão
        </Link>

        {USAR_DADOS_SIMULADOS && (
          <p className="texto-secundario small mt-3 mb-0">
            Demonstração com dados simulados.
          </p>
        )}
      </div>
    </section>
  );
}
