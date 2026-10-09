import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Recalcula el tamaño del mapa cuando cambia su contenedor
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// Generador de íconos utilizando los colores del Design System "Organic Minimal Administrative"
const crearIconoPrioridad = (prioridad, estado) => {
  let colorHex = '#8D968B'; // Muted Olive Grey por defecto

  if (estado === 'EN_EJECUCION') {
    colorHex = '#2D4A27'; // Primary (Deep Forest Green)
  } else if (prioridad === 'P1_REASIGNADO') {
    colorHex = '#C87D55'; // Tertiary (Terracotta)
  } else if (prioridad === 'P2_FIJO') {
    colorHex = '#607D5A'; // Secondary (Muted Sage)
  }

  const svgHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="${colorHex}" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="#FFFFFF"></circle>
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

// Mapeo de estilos para los chips de estado según DESIGN.md
const getBadgeStyle = (estado) => {
  if (estado === 'EN_EJECUCION') return { background: '#EAF2E8', color: '#2D4A27', border: '1px solid #D2E4CF' };
  if (estado === 'COORDINADO' || estado === 'CONFIRMADO') return { background: '#FDF0EB', color: '#C87D55', border: '1px solid #F8D8C9' }; // Pendiente/Attention
  if (estado === 'REALIZADO') return { background: '#EAF2E8', color: '#3D6836', border: '1px solid #CCE0C9' };
  return { background: '#EFECE5', color: '#5F695D', border: '1px solid #EAE6DF' }; // Por defecto
};

export default function MapaAgenda({ turnos = [], onSelectTurno }) {
  const turnosConUbicacion = turnos.filter(t => t.inmueble?.latitud && t.inmueble?.longitud);
  const center = [-31.4201, -64.1888]; // Córdoba Capital por defecto

  return (
    <div
      className="card shadow-sm overflow-hidden p-0 h-100"
      style={{ 
        minHeight: '400px', 
        backgroundColor: '#FAF8F5', 
        border: '1px solid #EAE6DF',
        borderRadius: '16px' // rounded-xl
      }}
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
          const badgeStyle = getBadgeStyle(turno.estado);

          return (
            <Marker
              key={turno.idTurno}
              position={[turno.inmueble.latitud, turno.inmueble.longitud]}
              icon={iconoPersonalizado}
            >
              <Popup className="organic-map-popup">
                <div className="p-2" style={{ minWidth: '220px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  
                  {/* Header del Popup */}
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="badge rounded-pill fw-semibold" style={{ fontSize: '0.65rem', letterSpacing: '0.02em', background: '#F2EFE9', color: '#5F695D', border: '1px solid #EAE6DF' }}>
                      ID: {turno.idPresupuesto || turno.idTurno}
                    </span>
                    <span className="badge rounded-pill fw-semibold" style={{ fontSize: '0.65rem', letterSpacing: '0.02em', ...badgeStyle }}>
                      {turno.estado.replace('_', ' ')}
                    </span>
                  </div>
                  
                  {/* Datos del Cliente */}
                  <strong className="d-block mb-1 fs-6" style={{ color: '#1F291E', fontWeight: '700' }}>
                    {turno.cliente.nombre}
                  </strong>
                  <span className="small d-block mb-3" style={{ color: '#5F695D', lineHeight: '1.4' }}>
                    {turno.inmueble.direccion}
                  </span>
                  
                  {/* Detalle del Servicio (Soft Container) */}
                  <div className="p-2 rounded-3 mb-3 small" style={{ backgroundColor: '#FAF8F5', border: '1px solid #EAE6DF' }}>
                    <span className="d-block fw-semibold" style={{ color: '#1F291E' }}>
                      {turno.servicio?.descripcion || 'Mantenimiento General'}
                    </span>
                  </div>

                  {/* Acciones y Horario */}
                  <div className="d-flex justify-content-between align-items-center pt-3" style={{ borderTop: '1px solid #EAE6DF' }}>
                    <span className="badge rounded-pill fw-semibold py-1 px-2" style={{ fontSize: '0.7rem', background: '#2D4A27', color: '#FFFFFF' }}>
                      {turno.franjaHoraria.horaInicio} - {turno.franjaHoraria.horaFin} hs
                    </span>
                    <button 
                      className="btn btn-sm p-0 text-decoration-none fw-bold d-flex align-items-center gap-1"
                      style={{ fontSize: '0.75rem', color: '#2D4A27', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => e.target.style.color = '#173313'}
                      onMouseLeave={(e) => e.target.style.color = '#2D4A27'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTurno?.(turno.idTurno);
                      }}
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