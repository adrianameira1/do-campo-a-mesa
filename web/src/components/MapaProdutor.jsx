
import { useEffect, useState } from 'react';

export default function MapaProdutor({ localizacao, localidade }) {
  const [coordenadas, setCoordenadas] = useState(null);
  const [aCarregar, setACarregar] = useState(false);

  useEffect(() => {
    let ativo = true;

    const lat = Number(localizacao?.lat);
    const lng = Number(localizacao?.lng);

    const temCoordenadas =
      localizacao?.lat != null &&
      localizacao?.lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180;

    if (temCoordenadas) {
      setCoordenadas({ lat, lng, aproximado: false });
      setACarregar(false);
      return () => { ativo = false; };
    }

    setCoordenadas(null);

    if (!localidade?.trim()) {
      setACarregar(false);
      return () => { ativo = false; };
    }

    async function procurarLocalidade() {
      setACarregar(true);

      try {
        const query = new URLSearchParams({
          q: `${localidade}, Portugal`,
          format: 'json',
          limit: '1'
        });

        const resposta = await fetch(
          `https://nominatim.openstreetmap.org/search?${query}`
        );

        if (!resposta.ok) {
          throw new Error('Não foi possível localizar a localidade.');
        }

        const resultados = await resposta.json();

        if (ativo && resultados.length > 0) {
          setCoordenadas({
            lat: Number(resultados[0].lat),
            lng: Number(resultados[0].lon),
            aproximado: true
          });
        }
      } catch {
        if (ativo) setCoordenadas(null);
      } finally {
        if (ativo) setACarregar(false);
      }
    }

    procurarLocalidade();

    return () => { ativo = false; };
  }, [localizacao?.lat, localizacao?.lng, localidade]);

  if (aCarregar) {
    return <p className="texto-secundario">A carregar mapa...</p>;
  }

  if (!coordenadas) {
    return (
      <p className="texto-secundario">
        Localização não disponível.
      </p>
    );
  }

  const { lat, lng, aproximado } = coordenadas;

  const margem = 0.025;

  const bbox = [
    lng - margem,
    lat - margem,
    lng + margem,
    lat + margem
  ].join(',');

  const parametros = new URLSearchParams({
    bbox,
    layer: 'mapnik'
  });

  // Um marcador só deve representar a exploração
  // quando existem coordenadas fornecidas pelo produtor.
  if (!aproximado) {
    parametros.set('marker', `${lat},${lng}`);
  }

  return (
    <div className="mt-3">
      <iframe
        title={`Mapa de ${localidade || 'exploração'}`}
        src={`https://www.openstreetmap.org/export/embed.html?${parametros}`}
        width="100%"
        height="280"
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px'
        }}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />

      <p className="texto-secundario small mt-2">
        {aproximado
          ? `Localização aproximada: ${localidade}. Não representa a morada exata da exploração.`
          : 'Localização indicada pelo produtor.'}
      </p>
    </div>
  );
}
