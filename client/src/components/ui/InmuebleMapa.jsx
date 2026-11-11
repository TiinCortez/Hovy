import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Maximize2, Minimize2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Button from './Button';

const CENTRO_ARGENTINA = [-38.4161, -63.6167];
const ICONO_INMUEBLE = L.divIcon({
  className: 'custom-map-pin',
  html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#1B3006" stroke="#FFFFFF" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#FFFFFF"/></svg>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

function UbicacionMapa({ posicion, onChange }) {
  const map = useMap();
  const lat = posicion?.[0];
  const lng = posicion?.[1];

  useMapEvents({
    click: (event) => onChange?.(event.latlng.wrap()),
  });

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    } else {
      map.setView(CENTRO_ARGENTINA, 4);
    }
  }, [map, lat, lng]);

  if (!posicion) return null;

  return (
    <Marker
      position={posicion}
      icon={ICONO_INMUEBLE}
      draggable={Boolean(onChange)}
      autoPan={Boolean(onChange)}
      title="Ubicación del inmueble"
      alt="Ubicación del inmueble"
      eventHandlers={{ dragend: (event) => onChange?.(event.target.getLatLng().wrap()) }}
    />
  );
}

export default function InmuebleMapa({ posicion, onChange }) {
  const mapaRef = useRef(null);
  const [mapaFullscreen, setMapaFullscreen] = useState(false);
  const [errorFullscreen, setErrorFullscreen] = useState(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setMapaFullscreen(document.fullscreenElement === mapaRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    setErrorFullscreen(null);
    try {
      if (document.fullscreenElement === mapaRef.current) {
        await document.exitFullscreen();
      } else {
        await mapaRef.current.requestFullscreen();
      }
    } catch {
      setErrorFullscreen('No se pudo cambiar el tamaño del mapa. Intentá nuevamente.');
    }
  };

  return (
    <>
      <div
        ref={mapaRef}
        className={`position-relative rounded-3 overflow-hidden border bg-white ${mapaFullscreen ? 'mapa-fullscreen' : ''}`}
        role="region"
        aria-label={onChange ? 'Seleccionar ubicación del inmueble' : 'Mapa de ubicación del inmueble'}
      >
        <Button
          variant="light"
          icon
          className="position-absolute border shadow-sm"
          onClick={toggleFullscreen}
          aria-label={mapaFullscreen ? 'Salir de pantalla completa' : 'Mapa en pantalla completa'}
          title={mapaFullscreen ? 'Salir de pantalla completa' : 'Mapa en pantalla completa'}
          aria-pressed={mapaFullscreen}
          style={{ top: 10, right: 10, zIndex: 1000 }}
        >
          {mapaFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        </Button>
        <MapContainer
          center={posicion ?? CENTRO_ARGENTINA}
          zoom={posicion ? 16 : 4}
          minZoom={3}
          maxZoom={19}
          scrollWheelZoom
          style={{ height: mapaFullscreen ? '100%' : '300px', width: '100%', zIndex: 0 }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            maxZoom={19}
          />
          <UbicacionMapa posicion={posicion} onChange={onChange} />
        </MapContainer>
      </div>
      {errorFullscreen && <p className="small text-danger mt-2 mb-0" role="alert">{errorFullscreen}</p>}
    </>
  );
}
