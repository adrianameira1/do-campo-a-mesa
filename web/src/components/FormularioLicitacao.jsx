import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function FormularioLicitacao({
  leilaoId,
  valorAtual,
  incremento,
  disponivel
}) {
  const socket = useSocket();
  const { utilizador } = useAuth();

  const [valor, setValor] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const pedidoPendente = useRef(false);
  const temporizador = useRef(null);

  const minimo = Math.round(
    (Number(valorAtual) + Number(incremento)) * 100
  ) / 100;

  function concluirPedido() {
    pedidoPendente.current = false;

    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }

    setAEnviar(false);
  }

  useEffect(() => {
    if (!socket) return undefined;

    function receberLicitacao(dados) {
      if (
        !pedidoPendente.current ||
        String(dados?.leilaoId) !== leilaoId ||
        String(dados?.comprador) !== String(utilizador?._id)
      ) {
        return;
      }

      concluirPedido();
      setValor('');
      setMensagem({
        tipo: 'success',
        texto: `A tua licitação de ${euro(dados.valor)} foi aceite!`
      });
    }

    function receberRecusa(motivo) {
      if (!pedidoPendente.current) return;

      concluirPedido();
      setMensagem({
        tipo: 'danger',
        texto: typeof motivo === 'string'
          ? motivo
          : 'A licitação foi recusada.'
      });
    }

    function perderLigacao() {
      if (!pedidoPendente.current) return;

      concluirPedido();
      setMensagem({
        tipo: 'warning',
        texto:
          'A ligação foi interrompida. Confirma o preço atual ' +
          'antes de voltares a tentar.'
      });
    }

    socket.on('nova-licitacao', receberLicitacao);
    socket.on('recusada', receberRecusa);
    socket.on('disconnect', perderLigacao);

    return () => {
      socket.off('nova-licitacao', receberLicitacao);
      socket.off('recusada', receberRecusa);
      socket.off('disconnect', perderLigacao);

      if (temporizador.current) {
        clearTimeout(temporizador.current);
        temporizador.current = null;
      }

      pedidoPendente.current = false;
    };
  }, [socket, leilaoId, utilizador?._id]);

  function licitar(evento) {
    evento.preventDefault();

    if (pedidoPendente.current) return;

    if (!disponivel || !socket?.connected) {
      setMensagem({
        tipo: 'danger',
        texto: 'Ainda não estás ligado à sala do leilão.'
      });
      return;
    }

    const texto = valor.trim().replace(',', '.');
    const numero = Number(texto);
    const centimos = Math.round(numero * 100);
    const minimoCentimos = Math.round(minimo * 100);

    if (
      !/^\d+(\.\d{1,2})?$/.test(texto) ||
      !Number.isFinite(numero) ||
      !Number.isSafeInteger(centimos) ||
      centimos < minimoCentimos
    ) {
      setMensagem({
        tipo: 'danger',
        texto: `A licitação deve ser, no mínimo, ${euro(minimo)}.`
      });
      return;
    }

    pedidoPendente.current = true;
    setAEnviar(true);
    setMensagem(null);

    temporizador.current = setTimeout(() => {
      if (!pedidoPendente.current) return;

      concluirPedido();
      setMensagem({
        tipo: 'warning',
        texto:
          'Não foi possível confirmar a licitação. ' +
          'Verifica o valor atual antes de tentares novamente.'
      });
    }, 12000);

    socket.emit('licitar', {
      leilaoId,
      valor: centimos / 100
    });
  }

  return (
    <form onSubmit={licitar}>
      <p className="mb-3">
        Próxima licitação mínima:
        {' '}
        <strong>{euro(minimo)}</strong>
      </p>

      <div className="mb-3">
        <p className="form-label fw-semibold mb-2">
          Oferta rápida
        </p>

        <div
          className="d-flex flex-wrap gap-2"
          role="group"
          aria-label="Escolher oferta rápida"
        >
          {[1, 2, 5].map((multiplicador) => {
            const oferta = Math.round(
              (
                Number(valorAtual) +
                Number(incremento) * multiplicador
              ) * 100
            ) / 100;

            return (
              <button
                key={multiplicador}
                type="button"
                className="btn btn-outline-success btn-sm"
                disabled={!disponivel || aEnviar}
                onClick={() => {
                  setValor(String(oferta));
                  setMensagem(null);
                }}
              >
                +{multiplicador} incremento{multiplicador > 1 ? 's' : ''}
                {' · '}
                {euro(oferta)}
              </button>
            );
          })}
        </div>
      </div>

      <label
        htmlFor="valor-licitacao"
        className="form-label fw-semibold"
      >
        A tua oferta
      </label>

      <div className="input-group mb-3">
        <input
          id="valor-licitacao"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="form-control"
          placeholder={`Ex.: ${minimo.toFixed(2).replace('.', ',')}`}
          value={valor}
          onChange={(evento) => {
            setValor(evento.target.value);
            setMensagem(null);
          }}
          disabled={!disponivel || aEnviar}
          required
        />

        <span className="input-group-text">€</span>
      </div>

      <button
        type="submit"
        className="btn btn-success w-100"
        disabled={!disponivel || aEnviar}
      >
        {aEnviar ? 'A confirmar licitação...' : 'Licitar'}
      </button>

      {mensagem && (
        <div
          className={`alert alert-${mensagem.tipo} mt-3 mb-0`}
          role="status"
          aria-live="polite"
        >
          {mensagem.texto}
        </div>
      )}

      {!disponivel && (
        <p className="texto-secundario small mt-2 mb-0">
          A aguardar ligação à sala do leilão...
        </p>
      )}
    </form>
  );
}
