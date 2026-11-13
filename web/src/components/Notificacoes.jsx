import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEventoSocket } from '../context/SocketContext.jsx';

const euro = (valor) =>
  Number(valor || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function Notificacoes() {
  const [avisos, setAvisos] = useState([]);
  const temporizadores = useRef(new Map());

  const fechar = useCallback((chave) => {
    const temporizador = temporizadores.current.get(chave);
    if (temporizador) clearTimeout(temporizador);

    temporizadores.current.delete(chave);
    setAvisos((atuais) => atuais.filter((aviso) => aviso.chave !== chave));
  }, []);

  useEffect(() => {
    const timers = temporizadores.current;

    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const mostrar = useCallback((chave, titulo, mensagem, destino, tipo = 'info') => {
    if (!chave || temporizadores.current.has(chave)) return;

    setAvisos((atuais) => {
      if (atuais.some((aviso) => aviso.chave === chave)) return atuais;

      return [
        { chave, titulo, mensagem, destino, tipo },
        ...atuais
      ].slice(0, 4);
    });

    const timer = setTimeout(() => {
      setAvisos((atuais) =>
        atuais.filter((aviso) => aviso.chave !== chave)
      );
      temporizadores.current.delete(chave);
    }, 9000);

    temporizadores.current.set(chave, timer);
  }, []);

  const aoGanhar = useCallback((dados) => {
    if (!dados?.leilaoId || !dados?.encomenda) return;

    mostrar(
      `ganho:${dados.leilaoId}`,
      'Parabéns! Ganhaste o leilão!',
      `Ganhaste "${dados.lote}" por ${euro(dados.valor)}. A tua encomenda foi confirmada.`,
      '/encomendas',
      'success'
    );
  }, [mostrar]);

  const aoTerminar = useCallback((dados) => {
    // Ignorar o evento geral da sala: queremos apenas
    // a notificação pessoal enviada ao produtor.
    if (!dados?.leilaoId || !dados?.encomenda) return;

    mostrar(
      `produtor-leilao:${dados.leilaoId}`,
      'Leilão terminado!',
      `O lote "${dados.lote}" foi vendido por ${euro(dados.valor)}.`,
      '/produtor',
      'success'
    );
  }, [mostrar]);

  const aoReceberEncomenda = useCallback((dados) => {
    if (!dados?.id) return;

    // Leilao terminado e nova-encomenda descrevem
    // a mesma venda: apresentar apenas um aviso.
    const chave = dados.origem === 'leilao' && dados.leilaoId
      ? `produtor-leilao:${dados.leilaoId}`
      : `nova-encomenda:${dados.id}`;

    mostrar(
      chave,
      'Nova encomenda recebida!',
      `Recebeste uma encomenda no valor de ${euro(dados.total)}.`,
      '/produtor',
      'info'
    );
  }, [mostrar]);

  const aoAtualizarEncomenda = useCallback((dados) => {
    if (!dados?.id || !dados?.estado) return;

    mostrar(
      `estado:${dados.id}:${dados.estado}`,
      'Encomenda atualizada!',
      `A tua encomenda #${String(dados.id).slice(-6)} passou para o estado "${dados.estado}".`,
      '/encomendas',
      'info'
    );
  }, [mostrar]);

  const aoValidarConta = useCallback(() => {
    mostrar(
      'conta-validada',
      'Conta aprovada!',
      'A tua conta de produtor foi aprovada. Já podes gerir os teus produtos.',
      '/produtor',
      'success'
    );
  }, [mostrar]);

  useEventoSocket('leilao-ganho', aoGanhar);
  useEventoSocket('leilao-terminado', aoTerminar);
  useEventoSocket('nova-encomenda', aoReceberEncomenda);
  useEventoSocket('encomenda-atualizada', aoAtualizarEncomenda);
  useEventoSocket('conta-validada', aoValidarConta);

  if (avisos.length === 0) return null;

  return (
    <div
      className="position-fixed top-0 end-0 p-3"
      style={{ zIndex: 1090, width: 'min(420px, 100%)' }}
      aria-live="polite"
      aria-atomic="false"
    >
      {avisos.map((aviso) => (
        <div
          key={aviso.chave}
          className={`alert alert-${aviso.tipo} shadow d-flex gap-3 align-items-start mb-2`}
          role="status"
        >
          <div className="flex-grow-1">
            <strong className="d-block mb-1">{aviso.titulo}</strong>

            <p className="mb-2 small">{aviso.mensagem}</p>

            {aviso.destino && (
              <Link
                to={aviso.destino}
                className="alert-link small"
                onClick={() => fechar(aviso.chave)}
              >
                Ver detalhes
              </Link>
            )}
          </div>

          <button
            type="button"
            className="btn-close"
            aria-label="Fechar notificação"
            onClick={() => fechar(aviso.chave)}
          />
        </div>
      ))}
    </div>
  );
}
