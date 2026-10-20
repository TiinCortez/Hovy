import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import {
  compararHorarioTurnos,
  formatearHorarioTurno,
  horaAMinutos,
  obtenerAhoraTurnos,
  tieneHorarioTurno
} from './agendaTurnos';

// Paleta del Design System "Organic Minimal Administrative"
const COLOR_EJECUCION = '#2D4A27';
const COLOR_P1 = '#C87D55';
const COLOR_P2 = '#607D5A';
const COLOR_DEFECTO = '#8D968B';
const COLOR_GRUPO = '#2D4A27';

// Agrupación por cercanía: radio en píxeles de pantalla. Por encima de
// ZOOM_MAX_AGRUPACION cada ubicación se ve sola (nivel calle).
const RADIO_AGRUPACION_PX = 60;
const ZOOM_MAX_AGRUPACION = 17;
const ZOOM_MAX_MAPA = 19;
// Con este zoom o menos (país entero a la vista) todo se junta en un solo
// grupo, aunque haya turnos en provincias distintas.
const ZOOM_VISTA_PAIS = 5;

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

const colorDeTurno = (turno) => {
  if (turno.estado === 'EN_EJECUCION') return COLOR_EJECUCION;
  if (turno.prioridad === 'P1_REASIGNADO') return COLOR_P1;
  if (turno.prioridad === 'P2_FIJO') return COLOR_P2;
  return COLOR_DEFECTO;
};

// El pin de un grupo toma el color del turno más relevante:
// en ejecución > P1 > P2 > resto.
const PESO_COLOR = { [COLOR_EJECUCION]: 4, [COLOR_P1]: 3, [COLOR_P2]: 2, [COLOR_DEFECTO]: 1 };
const colorDeGrupo = (turnos) =>
  turnos.map(colorDeTurno).sort((a, b) => PESO_COLOR[b] - PESO_COLOR[a])[0];

const badgeCantidad = (cantidad) => `
  <span style="position:absolute;top:-6px;right:-8px;min-width:18px;height:18px;padding:0 4px;
    border-radius:9px;background:${COLOR_GRUPO};color:#FFFFFF;border:1.5px solid #FFFFFF;
    font:600 11px/15px 'Plus Jakarta Sans',sans-serif;text-align:center;box-sizing:border-box;">${cantidad}</span>`;

const crearIconoPin = (colorHex, cantidad) => L.divIcon({
  className: 'custom-map-pin',
  html: `
    <div style="position:relative;width:32px;height:32px;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="${colorHex}" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3" fill="#FFFFFF"></circle>
      </svg>
      ${cantidad > 1 ? badgeCantidad(cantidad) : ''}
    </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -28]
});

// Burbuja de un grupo por cercanía: crece un poco con la cantidad de turnos.
const crearIconoCluster = (total) => {
  const lado = total < 10 ? 36 : total < 50 ? 44 : 52;
  return L.divIcon({
    className: 'custom-map-cluster',
    html: `
      <div style="width:${lado}px;height:${lado}px;border-radius:50%;background:${COLOR_GRUPO};
        border:3px solid rgba(255,255,255,0.9);box-shadow:0 0 0 4px rgba(45,74,39,0.25);
        display:flex;align-items:center;justify-content:center;color:#FFFFFF;
        font:700 14px 'Plus Jakarta Sans',sans-serif;">${total}</div>`,
    iconSize: [lado, lado],
    iconAnchor: [lado / 2, lado / 2]
  });
};

// Estilos de los chips de estado según DESIGN.md
const getBadgeStyle = (estado) => {
  if (estado === 'EN_EJECUCION') return { background: '#EAF2E8', color: '#2D4A27', border: '1px solid #D2E4CF' };
  if (estado === 'COORDINADO' || estado === 'CONFIRMADO') return { background: '#FDF0EB', color: '#C87D55', border: '1px solid #F8D8C9' };
  if (estado === 'REALIZADO') return { background: '#EAF2E8', color: '#3D6836', border: '1px solid #CCE0C9' };
  return { background: '#EFECE5', color: '#5F695D', border: '1px solid #EAE6DF' };
};

const formatearFechaCorta = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const texto = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const ordenarTurnos = (turnos) => [...turnos].sort((a, b) =>
  (a.fechaAsignada || '').localeCompare(b.fechaAsignada || '') || compararHorarioTurnos(a, b)
);

// Turnos con la MISMA coordenada (redondeada a ~1 m) son un único pin con
// flechas: nunca se separan, ni con el zoom al máximo.
const agruparPorUbicacion = (turnos) => {
  const grupos = new Map();
  for (const turno of turnos) {
    const lat = Number(turno.inmueble?.latitud);
    const lng = Number(turno.inmueble?.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (!grupos.has(key)) grupos.set(key, { key, lat, lng, turnos: [] });
    grupos.get(key).turnos.push(turno);
  }
  return [...grupos.values()].map((g) => ({ ...g, turnos: ordenarTurnos(g.turnos) }));
};

// El popup abre en el turno en curso o, si no hay, en el próximo desde ahora.
// Si todos ya pasaron, en el más reciente.
const indiceProximoTurno = (turnos, ahora = obtenerAhoraTurnos()) => {
  const enCurso = turnos.findIndex((t) => t.estado === 'EN_EJECUCION');
  if (enCurso !== -1) return enCurso;

  const minutosAhora = ahora.segundos / 60;
  const proximo = turnos.findIndex((t) => {
    if (t.fechaAsignada > ahora.fecha) return true;
    if (t.fechaAsignada < ahora.fecha) return false;
    if (!tieneHorarioTurno(t)) return true;
    return horaAMinutos(t.franjaHoraria.horaFin) > minutosAhora;
  });
  return proximo === -1 ? turnos.length - 1 : proximo;
};

const estiloFlecha = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: '1px solid #EAE6DF',
  background: '#FFFFFF',
  color: '#2D4A27',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0
};

// Contenido del popup. Se monta cada vez que se abre, así que siempre
// arranca en el próximo turno.
function PopupGrupoTurnos({ turnos, onSelectTurno }) {
  const [indice, setIndice] = useState(() => indiceProximoTurno(turnos));
  const actual = Math.min(indice, turnos.length - 1);
  const turno = turnos[actual];
  const varios = turnos.length > 1;
  const badgeStyle = getBadgeStyle(turno.estado);

  const mover = (paso) => setIndice((i) => (i + paso + turnos.length) % turnos.length);

  return (
    <div className="p-2" style={{ minWidth: '230px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>

      {varios && (
        <div className="d-flex justify-content-between align-items-center gap-2 pb-2 mb-3" style={{ borderBottom: '1px solid #EAE6DF' }}>
          <button type="button" style={estiloFlecha} aria-label="Turno anterior" onClick={() => mover(-1)}>
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <div className="fw-semibold" style={{ fontSize: '0.8rem', color: '#1F291E' }}>
              Turno {actual + 1} de {turnos.length}
            </div>
            <div className="d-flex justify-content-center gap-1 mt-1">
              {turnos.map((t, k) => (
                <span
                  key={t.idTurno}
                  style={{
                    height: 6,
                    width: k === actual ? 14 : 6,
                    borderRadius: 3,
                    background: k === actual ? '#2D4A27' : '#D2D6CC',
                    transition: 'width 0.2s'
                  }}
                />
              ))}
            </div>
          </div>
          <button type="button" style={estiloFlecha} aria-label="Turno siguiente" onClick={() => mover(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="badge rounded-pill fw-semibold" style={{ fontSize: '0.65rem', letterSpacing: '0.02em', background: '#F2EFE9', color: '#5F695D', border: '1px solid #EAE6DF' }}>
          ID: {turno.idPresupuesto || turno.idTurno}
        </span>
        <span className="badge rounded-pill fw-semibold" style={{ fontSize: '0.65rem', letterSpacing: '0.02em', ...badgeStyle }}>
          {turno.estado.replace('_', ' ')}
        </span>
      </div>

      <strong className="d-block mb-1 fs-6" style={{ color: '#1F291E', fontWeight: '700' }}>
        {turno.cliente?.nombre} {turno.cliente?.apellido}
      </strong>
      <span className="small d-block mb-3" style={{ color: '#5F695D', lineHeight: '1.4' }}>
        {turno.inmueble?.direccion}
      </span>

      <div className="p-2 rounded-3 mb-3 small" style={{ backgroundColor: '#FAF8F5', border: '1px solid #EAE6DF' }}>
        <span className="d-block fw-semibold" style={{ color: '#1F291E' }}>
          {turno.servicio?.descripcion || 'Mantenimiento General'}
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center gap-2 pt-3" style={{ borderTop: '1px solid #EAE6DF' }}>
        <span className="badge rounded-pill fw-semibold py-1 px-2" style={{ fontSize: '0.7rem', background: '#2D4A27', color: '#FFFFFF' }}>
          {formatearFechaCorta(turno.fechaAsignada)} · {formatearHorarioTurno(turno)}
        </span>
        <button
          type="button"
          className="btn btn-sm p-0 text-decoration-none fw-bold d-flex align-items-center gap-1"
          style={{ fontSize: '0.75rem', color: '#2D4A27' }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectTurno?.(turno.idTurno);
          }}
        >
          Ver detalle &rarr;
        </button>
      </div>
    </div>
  );
}

// Capa que decide, según el zoom, qué se dibuja: burbujas de grupo o pines.
function CapaTurnosAgrupados({ grupos, onSelectTurno }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const indice = useMemo(() => {
    const sc = new Supercluster({
      radius: RADIO_AGRUPACION_PX,
      maxZoom: ZOOM_MAX_AGRUPACION,
      // La burbuja cuenta turnos, no ubicaciones.
      map: (props) => ({ total: props.total }),
      reduce: (acumulado, props) => { acumulado.total += props.total; }
    });
    sc.load(grupos.map((g) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
      properties: { key: g.key, total: g.turnos.length }
    })));
    return sc;
  }, [grupos]);

  const grupoPorKey = useMemo(() => new Map(grupos.map((g) => [g.key, g])), [grupos]);

  // Se calcula sobre todo el mundo: con los volúmenes de una agenda es
  // barato y evita recalcular en cada paneo.
  const elementos = indice.getClusters([-180, -85, 180, 85], zoom);

  // Vista de país: un único grupo con todos los turnos. Al tocarlo, el mapa
  // se acomoda para mostrar todas las ubicaciones.
  if (zoom <= ZOOM_VISTA_PAIS && elementos.length > 1) {
    const total = grupos.reduce((suma, g) => suma + g.turnos.length, 0);
    const lat = grupos.reduce((suma, g) => suma + g.lat, 0) / grupos.length;
    const lng = grupos.reduce((suma, g) => suma + g.lng, 0) / grupos.length;
    return (
      <Marker
        key="cluster-pais"
        position={[lat, lng]}
        icon={crearIconoCluster(total)}
        eventHandlers={{
          click: () => map.flyToBounds(grupos.map((g) => [g.lat, g.lng]), { padding: [40, 40] })
        }}
      />
    );
  }

  return elementos.map((elemento) => {
    const [lng, lat] = elemento.geometry.coordinates;

    if (elemento.properties.cluster) {
      const idCluster = elemento.properties.cluster_id;
      return (
        <Marker
          key={`cluster-${idCluster}`}
          position={[lat, lng]}
          icon={crearIconoCluster(elemento.properties.total)}
          eventHandlers={{
            click: () => {
              const zoomDestino = Math.min(indice.getClusterExpansionZoom(idCluster), map.getMaxZoom());
              map.flyTo([lat, lng], zoomDestino);
            }
          }}
        />
      );
    }

    const grupo = grupoPorKey.get(elemento.properties.key);
    return (
      <Marker
        key={`grupo-${grupo.key}`}
        position={[grupo.lat, grupo.lng]}
        icon={crearIconoPin(colorDeGrupo(grupo.turnos), grupo.turnos.length)}
      >
        <Popup className="organic-map-popup" minWidth={250}>
          <PopupGrupoTurnos turnos={grupo.turnos} onSelectTurno={onSelectTurno} />
        </Popup>
      </Marker>
    );
  });
}

export default function MapaAgenda({ turnos = [], onSelectTurno }) {
  const grupos = useMemo(() => agruparPorUbicacion(turnos), [turnos]);
  const center = [-24.233563, -65.261317];

  return (
    <div
      className="card shadow-sm overflow-hidden p-0 h-100"
      style={{
        minHeight: '400px',
        backgroundColor: '#FAF8F5',
        border: '1px solid #EAE6DF',
        borderRadius: '16px'
      }}
    >
      <MapContainer
        center={center}
        zoom={12}
        maxZoom={ZOOM_MAX_MAPA}
        style={{ width: '100%', height: '100%', minHeight: '400px', zIndex: 0 }}
      >
        <AutoResize />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={ZOOM_MAX_MAPA}
        />
        <CapaTurnosAgrupados grupos={grupos} onSelectTurno={onSelectTurno} />
      </MapContainer>
    </div>
  );
}