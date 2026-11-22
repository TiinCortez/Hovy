import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import {
  compararHorarioTurnos,
  formatearHorarioTurno,
  obtenerAhoraTurnos,
  obtenerSiguienteTurnoPendiente,
  tieneCoordenadasTurno
} from './agendaTurnos';
import { VERDE } from '../../styles/colores';
import { PALETA } from '../../styles/paleta';

const CENTRO_DEFECTO = [-24.233563, -65.261317];
const ZOOM_DEFECTO = 12;
const ZOOM_TURNO_FOCO = 15;

// Colores de los marcadores: Leaflet los usa como atributos SVG, así que van con su valor (PALETA).
const COLOR_EJECUCION = VERDE;
const COLOR_P1 = PALETA['terracota-500'];
const COLOR_P2 = PALETA['verde-600'];
const COLOR_DEFECTO = PALETA['oliva-500'];
const COLOR_GRUPO = VERDE;

// Agrupación por cercanía: radio en píxeles de pantalla. Por encima de
// ZOOM_MAX_AGRUPACION cada ubicación se ve sola (nivel calle).
const RADIO_AGRUPACION_PX = 60;
const ZOOM_MAX_AGRUPACION = 17;
const ZOOM_MAX_MAPA = 19;
// Con este zoom o menos (país entero a la vista) todo se junta en un solo
// grupo, aunque haya turnos en provincias distintas.
const ZOOM_VISTA_PAIS = 5;

// Recalcula el tamaño del mapa cuando cambia su contenedor o su modo expandido
function AutoResize({ expandido }) {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);

  useEffect(() => {
    const id = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    return () => cancelAnimationFrame(id);
  }, [map, expandido]);

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
    border-radius:9px;background:${COLOR_GRUPO};color:var(--hovy-blanco);border:1.5px solid var(--hovy-blanco);
    font:600 11px/15px 'Plus Jakarta Sans',sans-serif;text-align:center;box-sizing:border-box;">${cantidad}</span>`;

const crearIconoPin = (colorHex, cantidad, esSiguiente = false) => L.divIcon({
  className: 'custom-map-pin',
  html: `
    <div style="position:relative;width:32px;height:32px;">
      ${esSiguiente ? '<span style="position:absolute;left:50%;bottom:-3px;width:18px;height:18px;transform:translateX(-50%);border-radius:50%;background:rgba(27,48,6,0.22);border:2px solid #1B3006;"></span>' : ''}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="${colorHex}" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="position:relative;">
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
        display:flex;align-items:center;justify-content:center;color:var(--hovy-blanco);
        font:700 14px 'Plus Jakarta Sans',sans-serif;">${total}</div>`,
    iconSize: [lado, lado],
    iconAnchor: [lado / 2, lado / 2]
  });
};

// Estilos de los chips de estado según DESIGN.md
const getBadgeStyle = (estado) => {
  if (estado === 'EN_EJECUCION') return { background: 'var(--hovy-verde-100)', color: VERDE, border: '1px solid var(--hovy-oliva-300)' };
  if (estado === 'COORDINADO' || estado === 'CONFIRMADO') return { background: 'var(--hovy-terracota-50)', color: 'var(--hovy-terracota-700)', border: '1px solid var(--hovy-terracota-200)' };
  if (estado === 'REALIZADO') return { background: 'var(--hovy-verde-100)', color: 'var(--hovy-verde-700)', border: '1px solid var(--hovy-verde-200)' };
  return { background: 'var(--hovy-crema-300)', color: 'var(--hovy-oliva-700)', border: '1px solid var(--hovy-crema-300)' };
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

// El popup abre en el turno en curso o en el próximo pendiente de realizar.
// Si todos ya se realizaron, abre en el último del grupo.
const indiceProximoTurno = (turnos, ahora = obtenerAhoraTurnos()) => {
  const siguiente = obtenerSiguienteTurnoPendiente(turnos, ahora);
  if (siguiente) {
    const idx = turnos.findIndex((t) => String(t.idTurno) === String(siguiente.idTurno));
    if (idx !== -1) return idx;
  }
  return Math.max(0, turnos.length - 1);
};

const estiloFlecha = {
  width: 30,
  height: 30,
  borderRadius: 'var(--hovy-radio-circulo)',
  border: '1px solid var(--hovy-crema-300)',
  background: 'var(--hovy-blanco)',
  color: VERDE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0
};

// Popup de Leaflet que adapta sus dimensiones y padding entre vista compacta y ampliada.
function PopupTurnoAdaptativo({ expandido, children }) {
  const popupRef = useRef(null);

  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return undefined;

    const claseModo = expandido ? 'organic-map-popup--ampliada' : 'organic-map-popup--compacta';
    const padding = expandido ? 24 : 8;

    popup.options.minWidth = expandido ? 250 : 165;
    popup.options.maxWidth = expandido ? 310 : 205;
    popup.options.className = `organic-map-popup ${claseModo}`;
    popup.options.autoPanPaddingTopLeft = L.point(padding, padding);
    popup.options.autoPanPaddingBottomRight = L.point(padding, padding);

    const elemento = popup.getElement?.();
    if (elemento) {
      elemento.classList.toggle('organic-map-popup--ampliada', expandido);
      elemento.classList.toggle('organic-map-popup--compacta', !expandido);
    }

    if (!popup.isOpen?.()) return undefined;

    popup.update();
    const id = requestAnimationFrame(() => {
      if (popup.isOpen?.()) popup.update();
    });
    return () => cancelAnimationFrame(id);
  }, [expandido]);

  const padding = expandido ? 24 : 8;

  return (
    <Popup
      ref={popupRef}
      className={`organic-map-popup ${expandido ? 'organic-map-popup--ampliada' : 'organic-map-popup--compacta'}`}
      minWidth={expandido ? 250 : 165}
      maxWidth={expandido ? 310 : 205}
      autoPanPaddingTopLeft={[padding, padding]}
      autoPanPaddingBottomRight={[padding, padding]}
    >
      {children}
    </Popup>
  );
}

// Contenido del popup. Se monta cada vez que se abre, así que siempre
// arranca en el próximo turno.
function PopupGrupoTurnos({ turnos, ahora, expandido = false, onSelectTurno }) {
  const [indice, setIndice] = useState(() => indiceProximoTurno(turnos, ahora));
  const actual = Math.min(indice, turnos.length - 1);
  const turno = turnos[actual];
  const varios = turnos.length > 1;
  const badgeStyle = getBadgeStyle(turno.estado);

  const mover = (paso) => setIndice((i) => (i + paso + turnos.length) % turnos.length);

  if (!expandido) {
    const nombreCliente = [turno.cliente?.nombre, turno.cliente?.apellido].filter(Boolean).join(' ') || 'Cliente';

    return (
      <div className="mapa-popup-compacto">
        {varios && (
          <div className="mapa-popup-compacto-nav">
            <button
              type="button"
              className="mapa-popup-compacto-flecha"
              aria-label="Turno anterior"
              onClick={() => mover(-1)}
            >
              <ChevronLeft size={12} />
            </button>
            <span>{actual + 1}/{turnos.length}</span>
            <button
              type="button"
              className="mapa-popup-compacto-flecha"
              aria-label="Turno siguiente"
              onClick={() => mover(1)}
            >
              <ChevronRight size={12} />
            </button>
          </div>
        )}

        <div className={`mapa-popup-compacto-cabecera ${varios ? '' : 'con-espacio-cerrar'}`.trim()}>
          <strong className="mapa-popup-compacto-cliente" title={nombreCliente}>
            {nombreCliente}
          </strong>
          <span className="mapa-popup-compacto-estado" style={badgeStyle}>
            {turno.estado.replace('_', ' ')}
          </span>
        </div>

        <div className="mapa-popup-compacto-pie">
          <span className="mapa-popup-compacto-hora">
            {formatearHorarioTurno(turno)}
          </span>
          <button
            type="button"
            className="btn btn-sm p-0 text-decoration-none mapa-popup-compacto-detalle d-flex align-items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onSelectTurno?.(turno.idTurno);
            }}
          >
            Detalle &rarr;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2" style={{ minWidth: '230px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>

      {varios && (
        <div className="d-flex justify-content-between align-items-center gap-2 pb-2 mb-3" style={{ borderBottom: '1px solid var(--hovy-crema-300)' }}>
          <button type="button" style={estiloFlecha} aria-label="Turno anterior" onClick={() => mover(-1)}>
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <div className="fw-semibold" style={{ fontSize: 'var(--hovy-texto-sm)', color: 'var(--hovy-oliva-950)' }}>
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
                    background: k === actual ? VERDE : 'var(--hovy-oliva-300)',
                    transition: 'width var(--hovy-duracion-media)'
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
        <span className="badge rounded-pill fw-semibold" style={{ fontSize: 'var(--hovy-texto-xs)', letterSpacing: '0.02em', background: 'var(--hovy-crema-100)', color: 'var(--hovy-oliva-700)', border: '1px solid var(--hovy-crema-300)' }}>
          ID: {turno.idPresupuesto || turno.idTurno}
        </span>
        <span className="badge rounded-pill fw-semibold" style={{ fontSize: 'var(--hovy-texto-xs)', letterSpacing: '0.02em', ...badgeStyle }}>
          {turno.estado.replace('_', ' ')}
        </span>
      </div>

      <strong className="d-block mb-1 fs-6" style={{ color: 'var(--hovy-oliva-950)', fontWeight: '700' }}>
        {turno.cliente?.nombre} {turno.cliente?.apellido}
      </strong>
      <span className="small d-block mb-3" style={{ color: 'var(--hovy-oliva-700)', lineHeight: '1.4' }}>
        {turno.inmueble?.direccion}
      </span>

      <div className="p-2 rounded-3 mb-3 small" style={{ backgroundColor: 'var(--hovy-crema-50)', border: '1px solid var(--hovy-crema-300)' }}>
        <span className="d-block fw-semibold" style={{ color: 'var(--hovy-oliva-950)' }}>
          {turno.servicio?.descripcion || 'Mantenimiento General'}
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--hovy-crema-300)' }}>
        <span className="badge rounded-pill fw-semibold py-1 px-2" style={{ fontSize: 'var(--hovy-texto-xs)', background: VERDE, color: 'var(--hovy-blanco)' }}>
          {formatearFechaCorta(turno.fechaAsignada)} · {formatearHorarioTurno(turno)}
        </span>
        <button
          type="button"
          className="btn btn-sm p-0 text-decoration-none fw-bold d-flex align-items-center gap-1"
          style={{ fontSize: 'var(--hovy-texto-xs)', color: VERDE }}
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

// Enfoca el mapa en el próximo turno pendiente del período visible (o encuadra los realizados).
function EnfocarMapa({ turnoFoco, grupos, periodoKey }) {
  const map = useMap();
  const ultimoFocoRef = useRef(null);

  useEffect(() => {
    const tieneFoco = turnoFoco && tieneCoordenadasTurno(turnoFoco);
    const lat = tieneFoco ? Number(turnoFoco.inmueble.latitud) : null;
    const lng = tieneFoco ? Number(turnoFoco.inmueble.longitud) : null;
    const clave = tieneFoco
      ? `turno:${turnoFoco.idTurno}:${lat.toFixed(5)}:${lng.toFixed(5)}:${periodoKey}`
      : grupos.length > 0
        ? `grupos:${grupos.map((g) => g.key).join('|')}:${periodoKey}`
        : `vacio:${periodoKey}`;

    if (ultimoFocoRef.current === clave) return;
    const esInicial = ultimoFocoRef.current === null;
    ultimoFocoRef.current = clave;

    const reducirMovimiento = esInicial
      || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    if (tieneFoco) {
      if (reducirMovimiento) map.setView([lat, lng], ZOOM_TURNO_FOCO, { animate: false });
      else map.flyTo([lat, lng], ZOOM_TURNO_FOCO, { duration: 0.65 });
      return;
    }

    if (grupos.length === 1) {
      const unico = [grupos[0].lat, grupos[0].lng];
      if (reducirMovimiento) map.setView(unico, ZOOM_TURNO_FOCO, { animate: false });
      else map.flyTo(unico, ZOOM_TURNO_FOCO, { duration: 0.65 });
      return;
    }

    if (grupos.length > 1) {
      const limites = grupos.map((g) => [g.lat, g.lng]);
      if (reducirMovimiento) map.fitBounds(limites, { padding: [40, 40], maxZoom: ZOOM_TURNO_FOCO, animate: false });
      else map.flyToBounds(limites, { padding: [40, 40], maxZoom: ZOOM_TURNO_FOCO, duration: 0.65 });
      return;
    }

    if (reducirMovimiento) map.setView(CENTRO_DEFECTO, ZOOM_DEFECTO, { animate: false });
    else map.flyTo(CENTRO_DEFECTO, ZOOM_DEFECTO, { duration: 0.65 });
  }, [map, turnoFoco, grupos, periodoKey]);

  return null;
}

// Capa que decide, según el zoom, qué se dibuja: burbujas de grupo o pines.
function CapaTurnosAgrupados({ grupos, turnoFoco, ahora, expandido, onSelectTurno }) {
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
    const contieneSiguiente = Boolean(
      turnoFoco && grupo.turnos.some((t) => String(t.idTurno) === String(turnoFoco.idTurno))
    );
    const colorPin = contieneSiguiente && colorDeGrupo(grupo.turnos) === COLOR_DEFECTO
      ? VERDE
      : colorDeGrupo(grupo.turnos);

    return (
      <Marker
        key={`grupo-${grupo.key}`}
        position={[grupo.lat, grupo.lng]}
        icon={crearIconoPin(colorPin, grupo.turnos.length, contieneSiguiente)}
        zIndexOffset={contieneSiguiente ? 500 : 0}
      >
        <PopupTurnoAdaptativo expandido={expandido}>
          <PopupGrupoTurnos
            key={`${grupo.key}-${turnoFoco?.idTurno ?? 'none'}`}
            turnos={grupo.turnos}
            ahora={ahora}
            expandido={expandido}
            onSelectTurno={onSelectTurno}
          />
        </PopupTurnoAdaptativo>
      </Marker>
    );
  });
}

export default function MapaAgenda({ turnos = [], turnoFoco: turnoFocoProp, periodoKey = '', ahora, expandido = false, onSelectTurno }) {
  const grupos = useMemo(() => agruparPorUbicacion(turnos), [turnos]);
  const turnoFoco = useMemo(
    () => (turnoFocoProp !== undefined ? turnoFocoProp : obtenerSiguienteTurnoPendiente(turnos.filter(tieneCoordenadasTurno), ahora)),
    [turnoFocoProp, turnos, ahora]
  );
  const centroInicial = useMemo(() => {
    if (turnoFoco && tieneCoordenadasTurno(turnoFoco)) {
      return [Number(turnoFoco.inmueble.latitud), Number(turnoFoco.inmueble.longitud)];
    }
    if (grupos.length > 0) return [grupos[0].lat, grupos[0].lng];
    return CENTRO_DEFECTO;
  }, [turnoFoco, grupos]);
  const zoomInicial = (turnoFoco && tieneCoordenadasTurno(turnoFoco)) || grupos.length === 1 ? ZOOM_TURNO_FOCO : ZOOM_DEFECTO;

  return (
    <div
      className="card shadow-sm overflow-hidden p-0 h-100"
      style={{
        minHeight: 'var(--agenda-map-min-height, 400px)',
        backgroundColor: 'var(--hovy-crema-50)',
        border: '1px solid var(--hovy-crema-300)',
        borderRadius: 'var(--hovy-radio-lg)'
      }}
    >
      <MapContainer
        center={centroInicial}
        zoom={zoomInicial}
        maxZoom={ZOOM_MAX_MAPA}
        style={{ width: '100%', height: '100%', minHeight: 'var(--agenda-map-min-height, 400px)', zIndex: 0 }}
      >
        <AutoResize expandido={expandido} />
        <EnfocarMapa turnoFoco={turnoFoco} grupos={grupos} periodoKey={periodoKey} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={ZOOM_MAX_MAPA}
        />
        <CapaTurnosAgrupados grupos={grupos} turnoFoco={turnoFoco} ahora={ahora} expandido={expandido} onSelectTurno={onSelectTurno} />
      </MapContainer>
    </div>
  );
}
