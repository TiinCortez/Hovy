import { useState, useEffect, useMemo } from 'react';
import { Search, AlertCircle, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import CobrosResumen from '../components/cobros/CobrosResumen';
import CobroFila from '../components/cobros/CobroFila';
import TurnoDetalleModal from '../components/turnos/TurnoDetalleModal';
import TurnoService from '../services/api/turno.service';
import { obtenerAhoraTurnos, cambiarMesTurnos } from '../components/turnos/agendaTurnos';
import {
  COBROS_POR_PAGINA, ORDENES, normalizar, codigoOrden, etiquetaMes,
  montoFinal, cobroAtrasado, ordenarLiquidaciones, filtrarRealizadosDelMes,
} from '../components/cobros/cobrosUtils';
import '../components/cobros/cobros.scss';

const TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendientes', label: 'Pendientes', punto: 'pendiente' },
  { value: 'cobrados', label: 'Cobrados', punto: 'cobrado' },
];

const EMPTY_TEXT = {
  todos: 'No hay turnos realizados en este mes.',
  pendientes: 'No hay turnos pendientes de cobro en este mes.',
  cobrados: 'Todavía no hay turnos cobrados en este mes.',
};

const noop = () => {};

export default function CobrosPage() {
  const hoy = obtenerAhoraTurnos().fecha;
  const mesActual = hoy.slice(0, 7);

  const [turnos, setTurnos] = useState([]);
  const [mes, setMes] = useState(mesActual);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [pagina, setPagina] = useState(1);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [guardandoId, setGuardandoId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'danger', text }
  const [detalle, setDetalle] = useState(null);

  // Se traen todos los turnos una vez; el mes y los filtros se resuelven en memoria.
  // El estado solo se toca dentro de los callbacks asíncronos.
  useEffect(() => {
    let isMounted = true;

    TurnoService.getAll()
      .then((res) => {
        if (!isMounted) return;
        setTurnos(res.data || []);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error.response?.data?.error || 'No se pudieron cargar los turnos a liquidar.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [reloadKey]);

  // Cierra el menú de opciones al hacer click afuera o presionar Escape
  useEffect(() => {
    if (!menuAbiertoId) return undefined;
    const handleClickOutside = () => setMenuAbiertoId(null);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuAbiertoId(null);
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuAbiertoId]);

  const liquidaciones = useMemo(() => filtrarRealizadosDelMes(turnos, mes), [turnos, mes]);

  const resumen = useMemo(() => {
    let recaudado = 0;
    let porCobrar = 0;
    let cantidadCobrados = 0;
    let cantidadPendientes = 0;
    let cantidadAtrasados = 0;

    liquidaciones.forEach((t) => {
      if (t.cobrado) {
        recaudado += montoFinal(t);
        cantidadCobrados += 1;
      } else {
        porCobrar += montoFinal(t);
        cantidadPendientes += 1;
        if (cobroAtrasado(t, hoy)) cantidadAtrasados += 1;
      }
    });

    const facturado = recaudado + porCobrar;
    const porcentaje = facturado > 0 ? Math.round((recaudado / facturado) * 1000) / 10 : 0;

    return { recaudado, porCobrar, porcentaje, cantidadCobrados, cantidadPendientes, cantidadAtrasados };
  }, [liquidaciones, hoy]);

  const counts = {
    todos: liquidaciones.length,
    pendientes: resumen.cantidadPendientes,
    cobrados: resumen.cantidadCobrados,
  };

  const filtradas = useMemo(() => {
    const search = normalizar(searchTerm.trim());
    const lista = liquidaciones.filter((t) => {
      if (activeTab === 'pendientes' && t.cobrado) return false;
      if (activeTab === 'cobrados' && !t.cobrado) return false;
      if (!search) return true;
      return [
        t.cliente?.nombre,
        t.cliente?.apellido,
        `${t.cliente?.nombre || ''} ${t.cliente?.apellido || ''}`,
        t.inmueble?.direccion,
        t.inmueble?.barrio,
        t.servicio?.descripcion,
        codigoOrden(t),
      ].some((campo) => normalizar(campo).includes(search));
    });
    return ordenarLiquidaciones(lista, orden);
  }, [liquidaciones, activeTab, searchTerm, orden]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / COBROS_POR_PAGINA));
  const paginaActiva = Math.min(pagina, totalPaginas);
  const desde = (paginaActiva - 1) * COBROS_POR_PAGINA;
  const visibles = filtradas.slice(desde, desde + COBROS_POR_PAGINA);

  const cambiarMes = (delta) => {
    setPagina(1);
    setMenuAbiertoId(null);
    setMes(cambiarMesTurnos(`${mes}-01`, delta).slice(0, 7));
  };

  const handleRetry = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  // Usa el PUT existente de turnos: el backend devuelve el turno actualizado
  const handleCambiarCobrado = async (turno, cobrado) => {
    setMenuAbiertoId(null);
    setGuardandoId(turno.idTurno);
    try {
      const response = await TurnoService.update(turno.idTurno, { cobrado });
      setTurnos((prev) => prev.map((t) => (t.idTurno === turno.idTurno ? response.data : t)));
      setFeedback({
        type: 'success',
        text: cobrado
          ? `El turno ${codigoOrden(turno)} quedó marcado como cobrado.`
          : `El turno ${codigoOrden(turno)} volvió a pendiente de cobro.`,
      });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.response?.data?.error || 'No se pudo actualizar el estado de cobro.' });
    } finally {
      setGuardandoId(null);
    }
  };

  const handleVerDetalle = (turno) => {
    setMenuAbiertoId(null);
    setDetalle(turno);
  };

  return (
    <div className="d-flex flex-column gap-4 pb-5">

      <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="text-success fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>Administración financiera</span>
          </div>
          <h2 className="fw-bold fs-2 text-dark m-0">Cobros &amp; Liquidación de Servicios</h2>
          <p className="text-secondary small m-0">Control de pagos de turnos ejecutados, presupuestos finales y conciliación de cobranzas en terreno.</p>
        </div>

        <div className="d-flex align-items-center gap-1 bg-white border rounded-4 shadow-sm p-1 flex-shrink-0">
          <Button variant="light" icon className="border-0" aria-label="Mes anterior" onClick={() => cambiarMes(-1)}>
            <ChevronLeft size={18} />
          </Button>
          <div className="d-flex align-items-center gap-2 px-2">
            <CalendarDays size={18} className="text-success flex-shrink-0" />
            <span className="fw-semibold text-dark small text-nowrap" aria-live="polite">{etiquetaMes(mes)}</span>
            {mes === mesActual && (
              <span className="badge rounded-pill cobros-badge-verde text-nowrap">Mes actual</span>
            )}
          </div>
          <Button variant="light" icon className="border-0" aria-label="Mes siguiente" onClick={() => cambiarMes(1)}>
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {!loading && !errorMessage && <CobrosResumen resumen={resumen} />}

      {/* Barra de filtros: en xl todo en una fila; debajo, el buscador arriba y
          pestañas + orden abajo. Las pestañas nunca se achican ni se recortan. */}
      <div className="bg-white border rounded-4 shadow-sm p-3 d-flex flex-column flex-xl-row align-items-stretch align-items-xl-center gap-3">
        <div className="input-group bg-white rounded-pill px-3 py-2 border flex-grow-1" style={{ minWidth: 0 }}>
          <span className="input-group-text bg-transparent border-0 text-secondary p-0 me-2"><Search size={18} /></span>
          <input
            type="text"
            className="form-control bg-transparent border-0 shadow-none text-dark small p-0"
            placeholder="Buscar por cliente, predio, servicio u orden (#OT)..."
            aria-label="Buscar turnos a cobrar"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPagina(1); }}
          />
        </div>

        <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-2 gap-md-3 flex-shrink-0">
          <div className="d-flex flex-wrap gap-2 flex-shrink-0" role="tablist" aria-label="Filtrar por estado de cobro">
            {TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={activeTab === tab.value ? 'primary' : 'light'}
                className="rounded-pill text-nowrap small fw-semibold flex-grow-1 flex-md-grow-0"
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => { setActiveTab(tab.value); setPagina(1); }}
              >
                {tab.punto && <span className={`cobros-tab-punto cobros-tab-punto--${tab.punto}`} aria-hidden="true"></span>}
                {tab.label} ({counts[tab.value]})
              </Button>
            ))}
          </div>

          <select
            className="form-select rounded-pill border shadow-sm small cobros-orden"
            aria-label="Ordenar turnos"
            value={orden}
            onChange={(e) => { setOrden(e.target.value); setPagina(1); }}
          >
            {ORDENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {feedback && (
        <div
          className={`alert alert-${feedback.type} rounded-3 m-0 small fw-medium d-flex justify-content-between align-items-center`}
          role={feedback.type === 'danger' ? 'alert' : 'status'}
        >
          <span>{feedback.text}</span>
          <button type="button" className="btn-close" aria-label="Cerrar aviso" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" style={{ color: '#1B3006' }} role="status"></div></div>
      ) : errorMessage ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4">
          <div className="d-flex align-items-center justify-content-center gap-2 text-danger mb-3" role="alert">
            <AlertCircle size={18} />
            <span className="small fw-medium">{errorMessage}</span>
          </div>
          <div><Button variant="light" onClick={handleRetry}>Reintentar</Button></div>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4">
          <p className="text-secondary m-0">
            {counts[activeTab] === 0 ? EMPTY_TEXT[activeTab] : 'No se encontraron turnos con esa búsqueda.'}
          </p>
        </Card>
      ) : (
        <div className="bg-white border rounded-4 shadow-sm">
          <div className="cobros-fila cobros-encabezado d-none d-lg-grid">
            <div className="cobros-celda-turno">Turno / Ejecución</div>
            <div className="cobros-celda-cliente">Cliente &amp; Ubicación</div>
            <div className="cobros-celda-servicio">Servicio</div>
            <div className="cobros-celda-monto">Presupuesto final</div>
            <div className="cobros-celda-estado text-center">Estado de cobro</div>
          </div>

          {visibles.map((turno) => (
            <CobroFila
              key={turno.idTurno}
              turno={turno}
              hoy={hoy}
              guardando={guardandoId === turno.idTurno}
              menuAbierto={menuAbiertoId === turno.idTurno}
              onToggleMenu={() => setMenuAbiertoId((actual) => (actual === turno.idTurno ? null : turno.idTurno))}
              onCambiarCobrado={handleCambiarCobrado}
              onVerDetalle={handleVerDetalle}
            />
          ))}

          <div className="cobros-pie px-3 px-lg-4 py-3 d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3">
            <span className="text-secondary small">
              Mostrando <strong className="text-dark">{desde + 1} - {desde + visibles.length}</strong> de <strong className="text-dark">{filtradas.length}</strong> turnos
            </span>
            <div className="d-flex align-items-center gap-1 flex-wrap justify-content-center">
              <Button variant="light" size="sm" disabled={paginaActiva === 1} onClick={() => setPagina(paginaActiva - 1)}>
                Anterior
              </Button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numero) => (
                <Button
                  key={numero}
                  variant={numero === paginaActiva ? 'primary' : 'light'}
                  size="sm"
                  aria-current={numero === paginaActiva ? 'page' : undefined}
                  onClick={() => setPagina(numero)}
                >
                  {numero}
                </Button>
              ))}
              <Button variant="light" size="sm" disabled={paginaActiva === totalPaginas} onClick={() => setPagina(paginaActiva + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Los turnos de esta vista ya están Realizados: el modal solo muestra el detalle */}
      {detalle && (
        <TurnoDetalleModal
          key={detalle.idTurno}
          isOpen
          onClose={() => setDetalle(null)}
          turnoData={detalle}
          onCancelTurno={noop}
          onEditTurno={noop}
          onChangeState={noop}
        />
      )}
    </div>
  );
}