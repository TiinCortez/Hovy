import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, AlertCircle, Phone, MapPin, Ruler, Wrench, CalendarDays, Clock, CalendarCheck, UserPlus, Users, UserCheck, Inbox, History } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import VisitaService from '../services/api/visita.service';
import ConfirmarVisitaModal from '../components/visitas/ConfirmarVisitaModal';
import VisitasSkeleton from '../components/skeletons/VisitasSkeleton';
import { VERDE } from '../styles/colores';
import Badge from '../components/ui/Badge';

// Case- and accent-insensitive comparison for the search box
const normalize = (text) => (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const formatFecha = (valor) => {
  if (!valor) return null;
  return new Date(valor).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
};

const FRANJA_TEXTO = {
  Mañana: 'por la mañana',
  Tarde: 'por la tarde',
  Indistinto: 'en cualquier horario',
};

// Backend state "Realizada" means "turno agendado": it is shown as Confirmada
const getTab = (visita) => (visita.estado === 'Realizada' ? 'Confirmada' : visita.estado);

// A turno request from an existing client (bot) is created already Confirmada:
// it stays pending until the admin assigns the budget and books the turno.
const esPedidoClienteEnCurso = (visita) => visita.tipo_solicitud === 'cliente' && visita.estado === 'Confirmada';

// Requests still being worked on. Confirmed new contacts (or turno already
// scheduled) and cancelled ones only show up in the history view.
const ESTADOS_ACTIVOS = ['Pendiente', 'Contactada'];
const esActiva = (visita) => ESTADOS_ACTIVOS.includes(visita.estado) || esPedidoClienteEnCurso(visita);

// First turno on a property: the client request arrives Pendiente and goes
// through the physical visit (measure the real m2) before any budget.
const esPedidoClienteConVisita = (visita) =>
  visita.tipo_solicitud === 'cliente' && ESTADOS_ACTIVOS.includes(visita.estado);

// What an open client request is waiting for.
const pasoPendienteCliente = (visita) => {
  if (esPedidoClienteConVisita(visita)) return 'Falta visita';
  return visita.id_presupuesto ? 'Falta turno' : 'Falta presupuesto';
};

const VISTAS = [
  { value: 'activas', label: 'Pendientes', icon: Inbox },
  { value: 'historial', label: 'Historial', icon: History },
];

const TABS_POR_VISTA = {
  activas: ['Todas', 'Pendiente', 'Contactada'],
  historial: ['Todas', 'Pendiente', 'Contactada', 'Confirmada', 'Cancelada'],
};

// Client requests arrive Confirmada (property already measured) or Pendiente
// (first turno: needs a visit), so their pending view needs all three tabs.
const tabsDe = (vista, grupo) => (
  vista === 'activas' && grupo === 'clientes' ? ['Todas', 'Pendiente', 'Contactada', 'Confirmada'] : TABS_POR_VISTA[vista]
);

const GRUPOS = [
  { value: 'nuevas', label: 'Nuevas', icon: UserPlus, descripcion: 'Personas que todavía no son clientes.' },
  { value: 'clientes', label: 'Clientes', icon: Users, descripcion: 'Pedidos de clientes existentes.' },
];

// The request is from an existing client when the bot flagged it at intake.
// Until the backend sends tipo_solicitud, fall back to id_cliente only while
// the request is active: confirming a new contact also fills id_cliente, so a
// closed request with id_cliente is treated as a new contact that became a
// client (that is the only intake flow the bot has today).
const getGrupo = (visita) => {
  if (visita.tipo_solicitud) return visita.tipo_solicitud === 'cliente' ? 'clientes' : 'nuevas';
  return esActiva(visita) && visita.id_cliente != null ? 'clientes' : 'nuevas';
};

// A new contact that was confirmed is now a client.
const yaEsCliente = (visita) => getGrupo(visita) === 'nuevas' && getTab(visita) === 'Confirmada';

// Tipo de Badge según el estado de la solicitud
const BADGE_TIPO = {
  Pendiente: 'pendiente',
  Contactada: 'info',
  Confirmada: 'exito',
  Cancelada: 'neutro',
};

// Compact status badge (top right) and secondary chips (under the name)
const CHIP_STYLE = { fontSize: 'var(--hovy-texto-xs)', padding: 'var(--hovy-espacio-2) var(--hovy-espacio-8)', border: '1px solid', whiteSpace: 'nowrap' };
const CHIP_TURNO = { backgroundColor: 'rgba(27, 48, 6, 0.08)', color: VERDE, borderColor: 'rgba(27, 48, 6, 0.15)' };
const CHIP_CLIENTE = { backgroundColor: 'rgba(121, 84, 45, 0.08)', color: 'var(--hovy-ambar-800)', borderColor: 'rgba(121, 84, 45, 0.2)' };

const EMPTY_TEXT = {
  Todas: 'Todavía no hay solicitudes.',
  TodasActivas: 'No hay solicitudes pendientes.',
  Pendiente: 'No hay solicitudes en estado Pendiente.',
  Contactada: 'No hay solicitudes en estado Contactada.',
  Confirmada: 'No hay solicitudes en estado Confirmada.',
  Cancelada: 'No hay solicitudes en estado Cancelada.',
};

const time = (visita) => new Date(visita.created_at).getTime() || 0;

export default function VisitasPage() {
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [grupo, setGrupo] = useState('nuevas');
  const [vista, setVista] = useState('activas');
  const [activeTab, setActiveTab] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = newest first
  const [confirmando, setConfirmando] = useState(null); // visit being confirmed in the modal
  const [feedback, setFeedback] = useState(null);

  // Fetch once (all states); state is only set inside async callbacks
  useEffect(() => {
    let isMounted = true;

    VisitaService.getAll()
      .then((res) => {
        if (!isMounted) return;
        setVisitas(res.data || []);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error.response?.data?.error || 'No se pudieron cargar las solicitudes.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [reloadKey]);

  // The group cards count only what still needs attention.
  const countsGrupo = useMemo(() => {
    const result = { nuevas: 0, clientes: 0 };
    visitas.filter(esActiva).forEach((v) => { result[getGrupo(v)] += 1; });
    return result;
  }, [visitas]);

  const delGrupo = useMemo(() => visitas.filter((v) => getGrupo(v) === grupo), [visitas, grupo]);

  const countsVista = useMemo(() => ({
    activas: delGrupo.filter(esActiva).length,
    historial: delGrupo.length,
  }), [delGrupo]);

  const visitasDelGrupo = useMemo(
    () => (vista === 'activas' ? delGrupo.filter(esActiva) : delGrupo),
    [delGrupo, vista],
  );

  const tabs = tabsDe(vista, grupo);

  const counts = useMemo(() => {
    const result = { Todas: visitasDelGrupo.length, Pendiente: 0, Contactada: 0, Confirmada: 0, Cancelada: 0 };
    visitasDelGrupo.forEach((v) => {
      const tab = getTab(v);
      if (tab in result) result[tab] += 1;
    });
    return result;
  }, [visitasDelGrupo]);

  const filteredVisitas = useMemo(() => {
    const search = normalize(searchTerm.trim());
    const list = visitasDelGrupo.filter((v) => {
      if (activeTab !== 'Todas' && getTab(v) !== activeTab) return false;
      if (!search) return true;
      return [v.nombre, v.apellido, `${v.nombre || ''} ${v.apellido || ''}`, v.telefono, v.direccion]
        .some((field) => normalize(String(field ?? '')).includes(search));
    });
    return list.sort((a, b) => (sortOrder === 'desc' ? time(b) - time(a) : time(a) - time(b)));
  }, [visitasDelGrupo, activeTab, searchTerm, sortOrder]);

  const handleRetry = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  // After confirming from the modal: reload silently so the visit moves to Confirmada
  const handleConfirmed = (message) => {
    setFeedback(message);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="d-flex flex-column gap-4 pb-5">

      <div>
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="hovy-rotulo">Solicitudes</span>
        </div>
        <h2 className="fw-bold fs-2 text-dark m-0">Solicitudes</h2>
        <p className="text-secondary small m-0">
          {vista === 'activas'
            ? 'Solicitudes que todavía hay que atender.'
            : 'Historial: todas las solicitudes, en cualquier estado.'}
        </p>
      </div>

      <div className="row g-3" role="tablist" aria-label="Tipo de solicitud">
        {GRUPOS.map(({ value, label, icon: Icon, descripcion }) => {
          const activo = grupo === value;
          return (
            <div key={value} className="col-12 col-md-6">
              <button
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => { setGrupo(value); setActiveTab('Todas'); }}
                className={`w-100 text-start rounded-4 p-3 d-flex align-items-center gap-3 shadow-sm border ${activo ? 'text-white' : 'bg-white text-dark'}`}
                style={activo ? { backgroundColor: VERDE, borderColor: VERDE } : undefined}
              >
                <span className={`p-3 rounded-circle d-flex ${activo ? 'bg-white bg-opacity-25' : 'bg-light'}`}>
                  <Icon size={22} />
                </span>
                <span className="flex-grow-1">
                  <span className="d-block fw-bold fs-5">{label}</span>
                  <span className={`d-block small ${activo ? 'text-white-50' : 'text-secondary'}`}>{descripcion}</span>
                </span>
                <span className="fw-bold fs-3">{countsGrupo[value]}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-3">
      <div className="hovy-filter-group" role="tablist" aria-label="Filtrar por estado">
        {tabs.map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'primary' : 'light'}
            size="sm"
            className="rounded-pill fw-semibold"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            <span className="hovy-filter-label">{tab}</span>
            <span className="hovy-filter-count">({counts[tab]})</span>
          </Button>
        ))}
      </div>

      <div className="btn-group bg-white rounded-pill border shadow-sm p-1 flex-shrink-0 align-self-start align-self-md-center" role="tablist" aria-label="Pendientes o historial">
        {VISTAS.map(({ value, label, icon: Icon }) => {
          const activo = vista === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => { setVista(value); setActiveTab('Todas'); }}
              className={`btn btn-sm rounded-pill fw-semibold d-flex align-items-center gap-1 px-3 border-0 ${activo ? 'text-white' : 'text-secondary'}`}
              style={activo ? { backgroundColor: VERDE } : undefined}
            >
              <Icon size={14} /> {label} ({countsVista[value]})
            </button>
          );
        })}
      </div>
      </div>

      <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-3">
        <div className="input-group bg-white rounded-pill px-3 py-2 border shadow-sm flex-grow-1" style={{ maxWidth: '360px' }}>
          <span className="input-group-text bg-transparent border-0 text-secondary p-0 me-2"><Search size={18} /></span>
          <input
            type="text"
            className="form-control bg-transparent border-0 shadow-none text-dark small p-0"
            placeholder="Buscar por nombre, teléfono o dirección…"
            aria-label="Buscar solicitudes"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="form-select rounded-pill border shadow-sm small w-auto"
          aria-label="Ordenar por fecha"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          <option value="desc">Más recientes primero</option>
          <option value="asc">Más antiguas primero</option>
        </select>
      </div>

      {feedback && (
        <div className="alert alert-success rounded-3 m-0 small fw-medium d-flex justify-content-between align-items-center" role="status">
          <span>{feedback}</span>
          <button type="button" className="btn-close" aria-label="Cerrar aviso" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {loading ? (
        <VisitasSkeleton />
      ) : errorMessage ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4">
          <div className="d-flex align-items-center justify-content-center gap-2 text-danger mb-3" role="alert">
            <AlertCircle size={18} />
            <span className="small fw-medium">{errorMessage}</span>
          </div>
          <div><Button variant="light" onClick={handleRetry}>Reintentar</Button></div>
        </Card>
      ) : filteredVisitas.length === 0 ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4">
          <p className="text-secondary m-0">
            {counts[activeTab] === 0
              ? EMPTY_TEXT[activeTab === 'Todas' && vista === 'activas' ? 'TodasActivas' : activeTab]
              : 'No se encontraron solicitudes con esa búsqueda.'}
          </p>
        </Card>
      ) : (
        <div className="row g-3">
          {filteredVisitas.map((visita) => {
            const tab = getTab(visita);
            const franja = FRANJA_TEXTO[visita.franja_preferida];
            return (
              <div key={visita.id_solicitud} className="col-12 col-md-6 col-xl-4">
                <Card className="h-100 p-4 shadow-sm border-0 rounded-4 d-flex flex-column bg-white">

                  <div className="mb-3 w-100">
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div className="overflow-hidden" style={{ minWidth: 0 }}>
                        <h5 className="fw-bold text-dark m-0 fs-5 text-truncate" title={`${visita.nombre} ${visita.apellido}`}>
                          {visita.nombre} {visita.apellido}
                        </h5>
                        <p className="text-secondary small m-0">Solicitud #{visita.id_solicitud}</p>
                      </div>
                      <Badge tipo={BADGE_TIPO[tab] || 'neutro'} className="flex-shrink-0">
                        {tab}
                      </Badge>
                    </div>
                    {(visita.estado === 'Realizada' || yaEsCliente(visita) || esPedidoClienteEnCurso(visita) || esPedidoClienteConVisita(visita)) && (
                      <div className="d-flex flex-wrap gap-1 mt-2">
                        {visita.estado === 'Realizada' && (
                          <span className="d-inline-flex align-items-center gap-1 rounded-pill fw-semibold" style={{ ...CHIP_STYLE, ...CHIP_TURNO }}>
                            <CalendarCheck size={12} /> Turno asignado
                          </span>
                        )}
                        {yaEsCliente(visita) && (
                          <span className="d-inline-flex align-items-center gap-1 rounded-pill fw-semibold" style={{ ...CHIP_STYLE, ...CHIP_CLIENTE }}>
                            <UserCheck size={12} /> Ya es cliente
                          </span>
                        )}
                        {(esPedidoClienteEnCurso(visita) || esPedidoClienteConVisita(visita)) && (
                          <span className="d-inline-flex align-items-center gap-1 rounded-pill fw-semibold" style={{ ...CHIP_STYLE, ...CHIP_CLIENTE }}>
                            <Clock size={12} /> {pasoPendienteCliente(visita)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="d-flex flex-column gap-2 small text-dark mb-4">
                    <div className="d-flex align-items-center gap-2"><Phone size={15} className="text-secondary flex-shrink-0" />+{visita.telefono}</div>
                    <div className="d-flex align-items-start gap-2"><MapPin size={15} className="text-secondary flex-shrink-0 mt-1" /><span>{visita.direccion}</span></div>
                    {visita.superficie_aproximada && (
                      <div className="d-flex align-items-center gap-2"><Ruler size={15} className="text-secondary flex-shrink-0" />{visita.superficie_aproximada} m²</div>
                    )}
                    {visita.servicio && (
                      <div className="d-flex align-items-start gap-2"><Wrench size={15} className="text-secondary flex-shrink-0 mt-1" /><span>{visita.servicio}</span></div>
                    )}
                    {(visita.fecha_preferida || franja) && (
                      <div className="d-flex align-items-center gap-2">
                        <CalendarDays size={15} className="text-secondary flex-shrink-0" />
                        <span>Preferida: {[visita.fecha_preferida, franja].filter(Boolean).join(' · ')}</span>
                      </div>
                    )}
                    <div className="d-flex align-items-center gap-2 text-secondary">
                      <Clock size={15} className="flex-shrink-0" />Solicitada el {formatFecha(visita.created_at)}
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 mt-auto">
                    <Link
                      to={`/visitas/${visita.id_solicitud}`}
                      className="btn btn-light flex-grow-1 rounded-pill text-dark fw-bold small py-2 bg-light border shadow-sm"
                    >
                      Ver detalle
                    </Link>
                    {visita.estado === 'Contactada' && (
                      <Button
                        variant="primary"
                        className="flex-grow-1 rounded-pill fw-bold small py-2"
                        style={{ backgroundColor: VERDE, borderColor: VERDE }}
                        onClick={() => setConfirmando(visita)}
                      >
                        Confirmar
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !errorMessage && filteredVisitas.length > 0 && (
        <span className="text-secondary small fw-medium">
          Mostrando {filteredVisitas.length} visita(s)
        </span>
      )}

      {confirmando && (
        <ConfirmarVisitaModal
          visita={confirmando}
          onClose={() => setConfirmando(null)}
          onConfirmed={handleConfirmed}
        />
      )}
    </div>
  );
}
