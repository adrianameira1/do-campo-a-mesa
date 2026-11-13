
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';

const FORMULARIO_INICIAL = {
  nomeExploracao: '',
  descricao: '',
  localidade: '',
  lat: '',
  lng: ''
};

export default function PerfilExploracao() {
  const { token } = useAuth();

  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [aCarregar, setACarregar] = useState(true);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [aEditar, setAEditar] = useState(false);

  const carregarPerfil = useCallback(async () => {
    if (!token) return;

    setACarregar(true);
    setErro('');

    try {
      const dados = await api('/producers/me', { token });
      const produtor = dados.produtor || {};

      setFormulario({
        nomeExploracao: produtor.nomeExploracao || '',
        descricao: produtor.descricao || '',
        localidade: produtor.localidade || '',
        lat: produtor.localizacao?.lat ?? '',
        lng: produtor.localizacao?.lng ?? ''
      });
    } catch (err) {
      setErro(err.message);
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    carregarPerfil();
  }, [carregarPerfil]);

  function mudar(campo, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor
    }));
  }

  async function guardar(e) {
    e.preventDefault();

    if (aGuardar) return;

    setErro('');
    setMensagem('');

    const dados = {
      nomeExploracao: formulario.nomeExploracao.trim(),
      descricao: formulario.descricao.trim(),
      localidade: formulario.localidade.trim()
    };

    const temLat = String(formulario.lat).trim() !== '';
    const temLng = String(formulario.lng).trim() !== '';

    if (temLat !== temLng) {
      setErro('Indica as duas coordenadas ou deixa ambas vazias.');
      return;
    }

    if (temLat && temLng) {
      const lat = Number(formulario.lat);
      const lng = Number(formulario.lng);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 || lat > 90 ||
        lng < -180 || lng > 180
      ) {
        setErro('Indica coordenadas válidas.');
        return;
      }

      dados.localizacao = { lat, lng };
    }

    setAGuardar(true);

    try {
      await api('/producers/me', {
        metodo: 'PATCH',
        corpo: dados,
        token
      });

      await carregarPerfil();

      setMensagem('Perfil da exploração atualizado com sucesso!');
      setAEditar(false);
    } catch (err) {
      setErro(err.message || 'Não foi possível guardar.');
    } finally {
      setAGuardar(false);
    }
  }

  if (aCarregar) {
    return <p>A carregar perfil da exploração...</p>;
  }

  return (
    <section className="card p-3 p-md-4 mb-4">
      <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
        <h2 className="h4 mb-0">A minha exploração</h2>

        {!aEditar && (
          <button
            type="button"
            className="btn btn-outline-success btn-sm"
            onClick={() => {
              setMensagem('');
              setAEditar(true);
            }}
          >
            Editar perfil
          </button>
        )}
      </div>

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

      {!aEditar ? (
        <>
          <h3 className="h5">{formulario.nomeExploracao}</h3>

          <p>
            {formulario.descricao || 'Ainda não foi adicionada uma descrição.'}
          </p>

          <p>
            <strong>Localidade:</strong> {formulario.localidade}
          </p>

          {formulario.lat !== '' && formulario.lng !== '' && (
            <p className="small texto-secundario">
              Coordenadas: {formulario.lat}, {formulario.lng}
            </p>
          )}
        </>
      ) : (
        <form onSubmit={guardar}>
          <fieldset disabled={aGuardar}>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label htmlFor="nome-exploracao" className="form-label">
                  Nome da exploração
                </label>
                <input
                  id="nome-exploracao"
                  className="form-control"
                  required
                  maxLength={150}
                  value={formulario.nomeExploracao}
                  onChange={(e) =>
                    mudar('nomeExploracao', e.target.value)
                  }
                />
              </div>

              <div className="col-12 col-md-6">
                <label htmlFor="localidade-exploracao" className="form-label">
                  Localidade
                </label>
                <input
                  id="localidade-exploracao"
                  className="form-control"
                  required
                  maxLength={150}
                  value={formulario.localidade}
                  onChange={(e) =>
                    mudar('localidade', e.target.value)
                  }
                />
              </div>

              <div className="col-12">
                <label htmlFor="descricao-exploracao" className="form-label">
                  Descrição da exploração
                </label>
                <textarea
                  id="descricao-exploracao"
                  className="form-control"
                  rows={4}
                  maxLength={1000}
                  placeholder="Conta aos compradores a história da tua exploração..."
                  value={formulario.descricao}
                  onChange={(e) =>
                    mudar('descricao', e.target.value)
                  }
                />
              </div>

              <div className="col-12 col-md-6">
                <label htmlFor="latitude-exploracao" className="form-label">
                  Latitude
                </label>
                <input
                  id="latitude-exploracao"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  className="form-control"
                  value={formulario.lat}
                  onChange={(e) => mudar('lat', e.target.value)}
                />
              </div>

              <div className="col-12 col-md-6">
                <label htmlFor="longitude-exploracao" className="form-label">
                  Longitude
                </label>
                <input
                  id="longitude-exploracao"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  className="form-control"
                  value={formulario.lng}
                  onChange={(e) => mudar('lng', e.target.value)}
                />
              </div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn btn-success">
                {aGuardar ? 'A guardar...' : 'Guardar alterações'}
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={async () => {
                  await carregarPerfil();
                  setAEditar(false);
                  setErro('');
                }}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
