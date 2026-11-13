
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import FormularioLicitacao from '../components/FormularioLicitacao.jsx';
import HistoricoLicitacoes from '../components/HistoricoLicitacoes.jsx';

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
  const socket = useSocket();
  const { utilizador } = useAuth();

  const [presenca, setPresenca] = useState(null);
  const [ligado, setLigado] = useState(false);

  const [leilao, setLeilao] = useState(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [agora, setAgora] = useState(Date.now());
  const [desvioRelogio, setDesvioRelogio] = useState(0);

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
          setLeilao(anterior => {
            if (!anterior || String(anterior._id) !== id) {
              return dados.leilao;
            }

            // Evitar perder uma licitação mais recente
            // que tenha chegado primeiro pelo Socket.io.
            const valorAnterior =
              anterior.licitacaoAtual?.valor ?? -Infinity;

            const valorRecebido =
              dados.leilao.licitacaoAtual?.valor ?? -Infinity;

            return {
              ...dados.leilao,
              licitacaoAtual:
                valorAnterior > valorRecebido
                  ? anterior.licitacaoAtual
                  : dados.leilao.licitacaoAtual,
              estado:
                anterior.estado === 'terminado'
                  ? 'terminado'
                  : dados.leilao.estado
            };
          });
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

  // Ligar o utilizador à sala e acompanhar eventos em tempo real.
  useEffect(() => {
    setPresenca(null);
    setLigado(Boolean(socket?.connected));

    if (!socket) return undefined;

    function entrar() {
      setLigado(true);
      socket.emit('entrar', id);
    }

    function desligar() {
      setLigado(false);
      setPresenca(null);
    }

    function receberPresenca(numero) {
      if (Number.isInteger(numero) && numero >= 0) {
        setPresenca(numero);
      }
    }

    function receberEstado(dados) {
      if (String(dados?._id) !== id) return;

      setLeilao(anterior => {
        if (anterior && String(anterior._id) !== id) {
          return anterior;
        }

        const valorAnterior =
          anterior?.licitacaoAtual?.valor ?? -Infinity;

        const valorRecebido =
          dados.licitacaoAtual?.valor ?? -Infinity;

        return {
          ...anterior,
          ...dados,

          // A API REST devolve produtor e produto preenchidos.
          // O evento Socket.io pode devolver apenas os IDs.
          produtor:
            typeof dados.produtor === 'string' &&
            anterior?.produtor &&
            typeof anterior.produtor === 'object'
              ? anterior.produtor
              : dados.produtor,

          produto:
            typeof dados.produto === 'string' &&
            anterior?.produto &&
            typeof anterior.produto === 'object'
              ? anterior.produto
              : dados.produto,

          licitacaoAtual:
            valorAnterior > valorRecebido
              ? anterior.licitacaoAtual
              : dados.licitacaoAtual
        };
      });
    }

    function receberLicitacao(dados) {
      if (String(dados?.leilaoId) !== id) return;

      setLeilao(anterior => {
        if (!anterior || String(anterior._id) !== id) {
          return anterior;
        }

        return {
          ...anterior,
          licitacaoAtual: {
            ...anterior.licitacaoAtual,
            valor: dados.valor,
            comprador: dados.comprador
          }
        };
      });
    }

    function receberFim(dados) {
      if (String(dados?.leilaoId) !== id) return;

      setLeilao(anterior =>
        anterior && String(anterior._id) === id
          ? { ...anterior, estado: 'terminado' }
          : anterior
      );
    }

    socket.on('connect', entrar);
    socket.on('disconnect', desligar);
    socket.on('connect_error', desligar);
    socket.on('presenca', receberPresenca);
    socket.on('estado', receberEstado);
    socket.on('nova-licitacao', receberLicitacao);
    socket.on('leilao-terminado', receberFim);

    // Se já estiver ligado, entrar imediatamente.
    if (socket.connected) entrar();

    return () => {
      if (socket.connected) {
        socket.emit('sair', id);
      }

      socket.off('connect', entrar);
      socket.off('disconnect', desligar);
      socket.off('connect_error', desligar);
      socket.off('presenca', receberPresenca);
      socket.off('estado', receberEstado);
      socket.off('nova-licitacao', receberLicitacao);
      socket.off('leilao-terminado', receberFim);
    };
  }, [socket, id]);

  // Sincronizar com o servidor, compensando metade da latência.
  useEffect(() => {
    if (!socket) return undefined;

    let ativo = true;

    function sincronizarHora() {
      if (!socket.connected) return;

      const inicio = Date.now();

      socket.timeout(4000).emit(
        'sincronizar-hora',
        (erro, resposta) => {
          if (!ativo || erro || !Number.isFinite(resposta?.agora)) {
            return;
          }

          const fim = Date.now();
          const desvio = resposta.agora + (fim - inicio) / 2 - fim;

          setDesvioRelogio(desvio);
        }
      );
    }

    socket.on('connect', sincronizarHora);

    if (socket.connected) sincronizarHora();

    // Corrigir eventuais desvios a cada 30 segundos.
    const sincronizador = setInterval(sincronizarHora, 30000);

    return () => {
      ativo = false;
      clearInterval(sincronizador);
      socket.off('connect', sincronizarHora);
    };
  }, [socket]);

  // Atualizar a contagem decrescente usando a hora sincronizada.
  useEffect(() => {
    function atualizarRelogio() {
      setAgora(Date.now() + desvioRelogio);
    }

    atualizarRelogio();

    const intervalo = setInterval(atualizarRelogio, 1000);

    return () => clearInterval(intervalo);
  }, [desvioRelogio]);

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

  const segundosRestantes = Math.max(
    0,
    Math.ceil((fim - agora) / 1000)
  );

  const contagemRegressiva = [
    Math.floor(segundosRestantes / 3600),
    Math.floor((segundosRestantes % 3600) / 60),
    segundosRestantes % 60
  ].map(numero => String(numero).padStart(2, '0')).join(':');

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

          <p
            className="texto-secundario small mb-3"
            aria-live="polite"
          >
            {!socket
              ? 'Inicia sessão para acompanhar o leilão em direto.'
              : ligado
                ? `Participantes em direto: ${presenca ?? 'a atualizar...'}`
                : 'A ligar à sala do leilão...'}
          </p>

          {estadoApresentado === 'ativo' && (
            <p className="mb-3" role="timer">
              Termina em:{' '}
              <strong>{contagemRegressiva}</strong>
            </p>
          )}

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
            utilizador?.papel === 'comprador' ? (
              <FormularioLicitacao
                key={id}
                leilaoId={id}
                valorAtual={valorAtual}
                incremento={leilao.incremento}
                disponivel={ligado && presenca !== null}
              />
            ) : (
              <div className="alert alert-info mb-0">
                {utilizador
                  ? 'Apenas compradores podem licitar.'
                  : 'Inicia sessão como comprador para licitar.'}
              </div>
            )
          )}

          <div className="mt-4 pt-3 border-top">
            <HistoricoLicitacoes
              leilaoId={id}
              terminado={estadoApresentado === 'terminado'}
              vencedorId={
                leilao.licitacaoAtual?.comprador?._id ||
                leilao.licitacaoAtual?.comprador
              }
              valorFinal={valorAtual}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
