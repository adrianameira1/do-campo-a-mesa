import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

const formatarData = (data) =>
  data
    ? new Date(data).toLocaleString('pt-PT', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    : 'Data não disponível';

export default function HistoricoLicitacoes({
  leilaoId,
  terminado,
  vencedorId,
  valorFinal
}) {
  const socket = useSocket();
  const { utilizador } = useAuth();

  const [licitacoes, setLicitacoes] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');

  const idVencedor = String(
    vencedorId?._id || vencedorId || ''
  );

  const vencedor = terminado && idVencedor
    ? licitacoes.find(licitacao =>
        String(
          licitacao.comprador?._id ||
          licitacao.comprador ||
          ''
        ) === idVencedor &&
        Number(licitacao.valor) === Number(valorFinal)
      )
    : null;

  const ganhei = Boolean(vencedor && utilizador?._id) &&
    String(utilizador._id) === idVencedor;

  useEffect(() => {
    let ativo = true;
    let ultimaConsulta = 0;

    async function carregarHistorico() {
      const numeroConsulta = ++ultimaConsulta;

      try {
        const dados = await api(`/auctions/${leilaoId}/bids`);

        if (ativo && numeroConsulta === ultimaConsulta) {
          setLicitacoes(Array.isArray(dados) ? dados : []);
          setErro('');
        }
      } catch (err) {
        if (ativo && numeroConsulta === ultimaConsulta) {
          setErro(
            err.message || 'Não foi possível carregar o histórico.'
          );
        }
      } finally {
        if (ativo && numeroConsulta === ultimaConsulta) {
          setACarregar(false);
        }
      }
    }

    function receberNovaLicitacao(dados) {
      if (String(dados?.leilaoId) === leilaoId) {
        carregarHistorico();
      }
    }

    setLicitacoes([]);
    setACarregar(true);
    setErro('');

    // Obter o histórico existente ao abrir a página.
    carregarHistorico();

    if (socket) {
      // Atualizar após uma licitação aceite.
      socket.on('nova-licitacao', receberNovaLicitacao);

      // Recuperar ofertas recebidas enquanto esteve desligado.
      socket.on('connect', carregarHistorico);
    }

    return () => {
      ativo = false;

      if (socket) {
        socket.off('nova-licitacao', receberNovaLicitacao);
        socket.off('connect', carregarHistorico);
      }
    };
  }, [leilaoId, socket]);

  return (
    <section aria-labelledby="titulo-historico">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <h3 id="titulo-historico" className="h5 mb-0">
          Histórico de licitações
        </h3>

        <span className="badge bg-secondary">
          {licitacoes.length} ofertas
        </span>
      </div>

      {terminado && !aCarregar && !erro && (
        <div
          className={`alert ${
            ganhei ? 'alert-success' : 'alert-info'
          }`}
          role="status"
        >
          {vencedor ? (
            <>
              <h4 className="h6 fw-bold">
                {ganhei
                  ? 'Parabéns! Ganhaste este leilão!'
                  : 'Leilão terminado'}
              </h4>

              <p className="mb-1">
                <strong>Vencedor:</strong>{' '}
                {vencedor.comprador?.nome || 'Comprador'}
              </p>

              <p className="mb-0">
                <strong>Valor final:</strong>{' '}
                {euro(vencedor.valor)}
              </p>
            </>
          ) : licitacoes.length === 0 ? (
            <p className="mb-0">
              O leilão terminou sem licitações.
              Não houve vencedor.
            </p>
          ) : (
            <p className="mb-0">
              A confirmar o resultado final do leilão.
            </p>
          )}
        </div>
      )}

      {aCarregar && (
        <p className="texto-secundario small">
          A carregar histórico...
        </p>
      )}

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {!aCarregar && !erro && licitacoes.length === 0 && (
        <p className="texto-secundario small mb-0">
          Ainda não existem licitações neste leilão.
        </p>
      )}

      {!aCarregar && licitacoes.length > 0 && (
        <div className="list-group">
          {licitacoes.map((licitacao, indice) => {
            const comprador = licitacao.comprador;

            const compradorId = String(
              comprador?._id || comprador || ''
            );

            const minhaLicitacao =
              Boolean(utilizador?._id) &&
              compradorId === String(utilizador._id);

            const nomeComprador =
              comprador?.nome || 'Comprador';

            return (
              <div
                key={licitacao._id}
                className="list-group-item"
              >
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <div className="fw-semibold">
                      {nomeComprador}
                    </div>

                    {minhaLicitacao && (
                      <span className="badge bg-primary mt-1">
                        A tua licitação
                      </span>
                    )}

                    <div className="texto-secundario small mt-1">
                      {formatarData(licitacao.createdAt)}
                    </div>
                  </div>

                  <div className="text-end">
                    <div className="fw-bold">
                      {euro(licitacao.valor)}
                    </div>

                    {indice === 0 && (
                      <span className="badge bg-success mt-1">
                        Mais recente
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
