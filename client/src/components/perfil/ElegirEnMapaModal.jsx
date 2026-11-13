import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { AlertCircle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import Button from '../ui/Button';
import Aviso from '../ui/Aviso';
import PerfilService from '../../services/api/perfil.service';
import { getApiError } from '../visitas/visitaUtils';
import ModalUbicacion from './ModalUbicacion';
import { VERDE } from '../../styles/colores';

const ZOOM_MAX = 19;
const ZOOM_MIN = 4;
const ZOOM_SIN_SALIDA = 12;
const ZOOM_CON_SALIDA = 16;
// Same starting point as the agenda map.
const CENTRO_POR_DEFECTO = [-24.233563, -65.261317];
// Same box the server validates: a point outside it is rejected with a 400.
const LIMITES_ARGENTINA = L.latLngBounds([-55.5, -74], [-21.5, -53]);

const ICONO_PIN = L.divIcon({
  className: 'custom-map-pin',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="${VERDE}" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="#FFFFFF"></circle>
    </svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

function PinSeleccion({ posicion, onChange }) {
  useMapEvents({ click: (e) => onChange(e.latlng) });
  if (!posicion) return null;

  return (
    <Marker
      position={posicion}
      icon={ICONO_PIN}
      draggable
      eventHandlers={{ dragend: (e) => onChange(e.target.getLatLng()) }}
    />
  );
}

// Point picked by hand. Saves nothing: only asks for the approximate address of
// the point once the user accepts it (that endpoint is rate limited, so it must
// not run while the pin moves) and goes on to the confirmation step.
export default function ElegirEnMapaModal({ salida, onElegida, onClose }) {
  const [posicion, setPosicion] = useState(() => (
    salida?.configurada ? L.latLng(salida.latitud, salida.longitud) : null
  ));
  const [isBuscando, setIsBuscando] = useState(false);
  const [error, setError] = useState(null);

  const fueraDeArgentina = Boolean(posicion) && !LIMITES_ARGENTINA.contains(posicion);

  const handleAceptar = async () => {
    setError(null);
    setIsBuscando(true);
    try {
      const res = await PerfilService.sugerirSalida({ latitud: posicion.lat, longitud: posicion.lng });
      onElegida(res.data);
    } catch (err) {
      setError(getApiError(err, 'No se pudo usar ese punto. Intentá de nuevo.'));
      setIsBuscando(false);
    }
  };

  return (
    <ModalUbicacion
      titulo="Elegir desde el mapa"
      size="lg"
      cerrable={!isBuscando}
      onClose={onClose}
      footer={(
        <Button
          variant="primary"
          onClick={handleAceptar}
          disabled={isBuscando || !posicion || fueraDeArgentina}
          style={{ backgroundColor: VERDE, borderColor: VERDE }}
        >
          {isBuscando ? 'Buscando dirección...' : 'Usar este punto'}
        </Button>
      )}
    >
      {error && <Aviso tipo="error" icono={AlertCircle}>{error}</Aviso>}
      {fueraDeArgentina && <Aviso tipo="error" icono={AlertCircle}>Elegí un punto dentro de Argentina.</Aviso>}

      <p className="small text-secondary mb-0">
        Tocá el mapa para marcar tu punto de salida. Podés arrastrar el pin para ajustarlo.
      </p>

      <div className="rounded-3 overflow-hidden" style={{ border: '1px solid #EAE6DF' }}>
        <MapContainer
          center={posicion ?? CENTRO_POR_DEFECTO}
          zoom={posicion ? ZOOM_CON_SALIDA : ZOOM_SIN_SALIDA}
          minZoom={ZOOM_MIN}
          maxZoom={ZOOM_MAX}
          style={{ width: '100%', height: '380px', zIndex: 0 }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            maxZoom={ZOOM_MAX}
          />
          <PinSeleccion posicion={posicion} onChange={setPosicion} />
        </MapContainer>
      </div>
    </ModalUbicacion>
  );
}
