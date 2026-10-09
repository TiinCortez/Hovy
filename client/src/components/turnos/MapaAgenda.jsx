import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Recalcula el tamaño del mapa cuando cambia su contenedor (ej: pantalla completa)
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// Generador de íconos personalizados de Leaflet con la figura de ubicación y color dinámico
const crearIconoPrioridad = (prioridad, estado) => {
  let colorHex = '#6c757d'; // P3 - Casual (Gris/Secundario por defecto)

  if (estado === 'EN_EJECUCION') {
    colorHex = '#0dcaf0'; // En curso (Celeste)
  } else if (prioridad === 'P1_REASIGNADO') {
    colorHex = '#dc3545'; // P1 (Rojo)
  } else if (prioridad === 'P2_FIJO') {
    colorHex = '#198754'; // P2 (Verde / Fijo)
  }

  // Estructura SVG de la figura de ubicación (Pin) con el color correspondiente
  const svgHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="${colorHex}" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
    </svg>
  `;

  return L.divIcon({
    className: 'custom-map-pin',
    html: svgHtml,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
  });
};

export default function MapaAgenda({ turnos = [], onSelectTurno }) {
  const turnosConUbicacion = turnos.filter(t => t.inmueble?.latitud && t.inmueble?.longitud);
  const center = [-31.4201, -64.1888]; // Córdoba Capital por defecto

  return (
    <div
      className="card border-0 shadow-sm rounded-4 overflow-hidden p-0 h-100"
      style={{ minHeight: '400px', backgroundColor: '#ffffff' }}
    >
      <MapContainer
        center={center}
        zoom={12}
        style={{ width: '100%', height: '100%', minHeight: '400px', zIndex: 0 }}
      >
        <AutoResize />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {turnosConUbicacion.map(turno => {
          const iconoPersonalizado = crearIconoPrioridad(turno.prioridad, turno.estado);

          return (
            <Marker
              key={turno.idTurno}
              position={[turno.inmueble.latitud, turno.inmueble.longitud]}
              icon={iconoPersonalizado}
              eventHandlers={{ click: () => onSelectTurno?.(turno.idTurno) }}
            >
              <Popup>
                <div className="p-1" style={{ minWidth: '200px' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="badge bg-dark text-white" style={{ fontSize: '0.65rem' }}>
                      {turno.idPresupuesto || 'Turno'}
                    </span>
                    <span className="badge bg-light text-dark border" style={{ fontSize: '0.65rem' }}>
                      {turno.estado.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <strong className="d-block mb-1 text-dark fs-6">{turno.cliente.nombre}</strong>
                  <span className="small text-secondary d-block mb-2">{turno.inmueble.direccion}</span>
                  
                  <div className="bg-light p-2 rounded-2 mb-2 small">
                    <span className="d-block fw-semibold text-dark">{turno.servicio?.descripcion}</span>
                  </div>

                  <div className="d-flex justify-content-between align-items-center pt-1 border-top">
                    <span className="badge bg-success text-white">
                      {turno.franjaHoraria.horaInicio} - {turno.franjaHoraria.horaFin} hs
                    </span>
                    <button 
                      className="btn btn-sm btn-link p-0 text-decoration-none fw-bold"
                      style={{ fontSize: '0.75rem', color: '#1B3006' }}
                      onClick={() => onSelectTurno?.(turno.idTurno)}
                    >
                      Ver detalle &rarr;
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}