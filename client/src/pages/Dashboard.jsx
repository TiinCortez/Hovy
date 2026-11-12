import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  ClipboardList,
  AlertTriangle,
  MapPin,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  CheckCircle,
  PlayCircle
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import VisitaService from '../services/api/visita.service';
import TurnoService from '../services/api/turno.service';
import LogisticaService from '../services/api/logistica.service';
import NotificacionService from '../services/api/notificacion.service';
import AlertasNotificacionesCard from '../components/notificaciones/AlertasNotificacionesCard.jsx';
import { avisarNotificacionesActualizadas } from '../components/notificaciones/notificacionesConfig.js';
import { compararHorarioTurnos, formatearMontoARS, obtenerAhoraTurnos } from '../components/turnos/agendaTurnos';
import {
  avisosLogistica, etiquetaConsumo, formatearConsumo, formatearCosto, formatearKm, SIN_DATO
} from '../components/dashboard/logisticaUtils';
import {
  resolverPeriodo, filtrarRealizados, resumirPeriodo, calcularVariacion, formatearPorcentaje
} from '../components/metricas/metricasUtils';

const MAX_TURNOS_PROXIMOS = 4;

// "09:00:00" -> "9:00 AM"
const formatearHora = (hora) => {
  if (!hora) return null;
  const [h, m] = hora.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// "2026-10-13" -> "13/10"
const formatearDiaMes = (fechaIso) => {
  const [, mes, dia] = fechaIso.split('-');
  return `${dia}/${mes}`;
};

// Un turno cancelado o ya realizado no es "próximo".
const esTurnoVigente = (turno) => turno.estado !== 'CANCELADO' && turno.estado !== 'REALIZADO';

export default function Dashboard() {
  // Datos reales: solicitudes pendientes, turnos y logística del día (ruta, clientes
  // y combustible). Ganancias se calcula igual que en Métricas (y coincide con el
  // "Total recaudado" de Cobros: mismos turnos realizados del mes y mismo monto).
  const [solicitudesNuevas, setSolicitudesNuevas] = useState(0);
  const [turnos, setTurnos] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(true);
  const [logistica, setLogistica] = useState(null);
  const [cargandoLogistica, setCargandoLogistica] = useState(true);
  const [errorLogistica, setErrorLogistica] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(true);
  const [errorNotificaciones, setErrorNotificaciones] = useState(false);
  const [historialNotificaciones, setHistorialNotificaciones] = useState([]);
  // Se incrementa para volver a pedir las notificaciones (tras eliminar una).
  const [versionNotificaciones, setVersionNotificaciones] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const fetchNotificaciones = async () => {
      try {
        // The history (resolved / cancelled) only fills the card when there are few
        // active ones, so if it fails the card still shows the active ones.
        const [response, historial] = await Promise.all([
          NotificacionService.getActivas(),
          NotificacionService.getHistorial().catch((err) => {
            console.error('No se pudo obtener el historial de notificaciones:', err);
            return null;
          }),
        ]);
        setNotificaciones(response.data ?? []);
        setHistorialNotificaciones(historial?.data ?? []);
        setErrorNotificaciones(false);
      } catch (err) {
        console.error('No se pudieron obtener las notificaciones:', err);
        setErrorNotificaciones(true);
      } finally {
        setCargandoNotificaciones(false);
      }
    };

    fetchNotificaciones();
  }, [versionNotificaciones]);

  // Tras eliminar una (X): recarga la lista y avisa a la campana del Header.
  const handleNotificacionesActualizadas = () => {
    setVersionNotificaciones((v) => v + 1);
    avisarNotificacionesActualizadas();
  };

  // "Ver todas" desde la campana: baja hasta la sección de alertas.
  // Solo se desplaza el <main> del layout (.hovy-content-wrapper): scrollIntoView
  // también movería los contenedores con overflow-hidden del DashboardLayout y
  // dejaría la pantalla cortada.
  useEffect(() => {
    if (cargandoNotificaciones || location.hash !== '#alertas-notificaciones') return;
    const seccion = document.getElementById('alertas-notificaciones');
    const contenedor = seccion?.closest('.hovy-content-wrapper');
    if (!seccion || !contenedor) return;

    const destino = seccion.getBoundingClientRect().top
      - contenedor.getBoundingClientRect().top
      + contenedor.scrollTop;
    contenedor.scrollTo({ top: destino, behavior: 'smooth' });
  }, [cargandoNotificaciones, location.hash, location.key]);

  useEffect(() => {
    const fetchLogistica = async () => {
      try {
        const response = await LogisticaService.getDia();
        setLogistica(response.data);
      } catch (err) {
        console.error('No se pudo obtener la logística del día:', err);
        setErrorLogistica(true);
      } finally {
        setCargandoLogistica(false);
      }
    };

    fetchLogistica();
  }, []);

  useEffect(() => {
    const fetchTurnos = async () => {
      try {
        const response = await TurnoService.getAll();
        setTurnos(response.data ?? []);
      } catch (err) {
        console.error('No se pudieron obtener los turnos:', err);
      } finally {
        setCargandoTurnos(false);
      }
    };

    fetchTurnos();
  }, []);

  useEffect(() => {
    const fetchSolicitudesPendientes = async () => {
      try {
        const response = await VisitaService.getPendientes();
        setSolicitudesNuevas(response.data?.length ?? 0);
      } catch (err) {
        console.error('No se pudieron obtener las solicitudes de visita pendientes:', err);
      }
    };

    fetchSolicitudesPendientes();
  }, []);

  // Objeto JSON de prueba (Mock): solo queda el nombre del saludo.
  const mockData = {
    usuario: "Admin"
  };

  const hoy = obtenerAhoraTurnos().fecha;

  // Mismo cálculo que la tarjeta "Total cobrado" de Métricas en modo "Mes"
  // (mes actual contra el anterior) y sin filtro de servicio.
  const rangoGanancias = resolverPeriodo({ modo: 'mes', mes: hoy.slice(0, 7) });
  const realizados = filtrarRealizados(turnos, '');
  const cobradoActual = resumirPeriodo(realizados, rangoGanancias.meses, hoy).cobrado;
  const cobradoAnterior = resumirPeriodo(realizados, rangoGanancias.mesesAnteriores, hoy).cobrado;
  const variacionGanancias = calcularVariacion(cobradoActual, cobradoAnterior);
  const turnosVigentes = turnos.filter(esTurnoVigente);

  // Turnos de hoy sin cancelar (los realizados cuentan: ya se hicieron hoy).
  const turnosHoy = turnos.filter((t) => t.fechaAsignada === hoy && t.estado !== 'CANCELADO').length;

  // Hoy y los días siguientes, en orden cronológico, hasta MAX_TURNOS_PROXIMOS.
  const proximosTurnos = turnosVigentes
    .filter((t) => t.fechaAsignada >= hoy)
    .sort((a, b) => a.fechaAsignada.localeCompare(b.fechaAsignada) || compararHorarioTurnos(a, b))
    .slice(0, MAX_TURNOS_PROXIMOS);

  // Función auxiliar para renderizar los badges de estado de la agenda
  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'EN_EJECUCION':
        return <span className="badge rounded-pill bg-warning text-dark fw-semibold d-inline-flex align-items-center gap-1 flex-shrink-0" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}><PlayCircle size={12}/> En curso</span>;
      case 'REALIZADO':
        return <span className="badge rounded-pill bg-success text-white fw-semibold d-inline-flex align-items-center gap-1 flex-shrink-0" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}><CheckCircle size={12}/> Realizado</span>;
      case 'CONFIRMADO':
        return <span className="badge rounded-pill bg-info bg-opacity-10 text-info border fw-semibold d-inline-flex align-items-center gap-1 flex-shrink-0" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}><CheckCircle size={12}/> Confirmado</span>;
      case 'COORDINADO':
      default:
        return <span className="badge rounded-pill bg-light text-secondary border fw-semibold d-inline-flex align-items-center gap-1 flex-shrink-0" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}><Clock size={12}/> Pendiente</span>;
    }
  };

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      {/* Encabezado */}
      <div>
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="text-success fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>Panel de control</span>
        </div>
        <h2 className="fw-bold fs-2 text-dark mb-1">Hola, {mockData.usuario}</h2>
        <p className="text-secondary m-0">Aquí tienes el resumen de tu jardín para hoy.</p>
      </div>

      {/* KPIs Top (4 columnas en desktop, 2 en móvil) */}
      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <Card className="h-100 p-2 dashboard-kpi">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(170, 59, 255, 0.1)', color: '#1B3006' }}>
                <CalendarCheck size={24} />
              </div>
              <div>
                <p className="text-secondary small fw-semibold m-0">Turnos hoy</p>
                <h3 className="fw-bold m-0 text-dark">{turnosHoy}</h3>
              </div>
            </div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card className="h-100 p-2 dashboard-kpi">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(253, 203, 155, 0.3)', color: '#79542D' }}>
                <ClipboardList size={24} />
              </div>
              <div>
                <p className="text-secondary small fw-semibold m-0">Solicitudes nuevas</p>
                <h3 className="fw-bold m-0 text-dark">{solicitudesNuevas}</h3>
              </div>
            </div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card className="h-100 p-2 dashboard-kpi">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(186, 26, 26, 0.1)', color: '#ba1a1a' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-secondary small fw-semibold m-0">Alertas</p>
                <h3 className="fw-bold m-0 text-dark">{cargandoNotificaciones ? '...' : notificaciones.length}</h3>
              </div>
            </div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card className="h-100 p-2 dashboard-kpi">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(27, 48, 6, 0.1)', color: '#1B3006' }}>
                <MapPin size={24} />
              </div>
              <div>
                <p className="text-secondary small fw-semibold m-0">
                  Ruta diaria{logistica?.ruta?.km_aproximados ? ' (aprox.)' : ''}
                </p>
                <h3 className="fw-bold m-0 text-dark">
                  {cargandoLogistica ? '...' : formatearKm(logistica?.ruta)}
                </h3>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Middle Section: Ganancias & Agenda */}
      <div className="row g-4">
        {/* Columna Izquierda */}
        <div className="col-12 col-lg-5 d-flex flex-column gap-4">
          
          {/* Resumen de Ganancias */}
          <Card className="h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <h4 className="fw-bold text-dark m-0 fs-5">Resumen de Ganancias</h4>
              <TrendingUp size={24} className="text-secondary" />
            </div>
            <p className="text-secondary small fw-semibold m-0 mb-1">Total recaudado este mes</p>
            <h2 className="fw-bold m-0 mb-1" style={{ fontSize: 'clamp(1.9rem, 8vw, 3rem)', color: '#1B3006', letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>
              {cargandoTurnos ? '...' : formatearMontoARS(cobradoActual)}
            </h2>
            <p className={`fw-semibold small mb-5 ${variacionGanancias.diferencia < 0 ? 'text-danger' : 'text-success'}`}>
              {variacionGanancias.diferencia < 0
                ? <TrendingDown size={16} className="me-1"/>
                : <TrendingUp size={16} className="me-1"/>}
              {cargandoTurnos
                ? '...'
                : `${variacionGanancias.porcentaje === null ? 'Sin datos' : formatearPorcentaje(variacionGanancias.porcentaje, { conSigno: true })} respecto al mes pasado`}
            </p>
            <Link to="/cobros" className="text-decoration-none fw-bold mt-auto" style={{ color: '#1B3006' }}>
              Ver cobros <ArrowRight size={18} className="ms-1" />
            </Link>
          </Card>

          {/* Resumen Logística (Épica 5) */}
          <Card>
            <h4 className="fw-bold text-dark m-0 fs-5 mb-3">Logística de Hoy</h4>
            {errorLogistica ? (
              <p className="text-danger small m-0" role="alert">No se pudo cargar la logística del día.</p>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-light mb-2">
                  <span className="text-secondary fw-semibold">Clientes a visitar</span>
                  <span className="fw-bold text-dark">{cargandoLogistica ? '...' : logistica?.clientes_a_visitar ?? SIN_DATO}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-light mb-2">
                  <span className="text-secondary fw-semibold">{etiquetaConsumo(logistica?.combustible)}</span>
                  <span className="text-end">
                    <span className="fw-bold text-dark d-block">
                      {cargandoLogistica ? '...' : formatearConsumo(logistica?.combustible)}
                    </span>
                    {formatearCosto(logistica?.combustible) && (
                      <span className="text-secondary small">≈ {formatearCosto(logistica?.combustible)}</span>
                    )}
                  </span>
                </div>
                {avisosLogistica(logistica).map((aviso) => (
                  <p key={aviso} className="text-secondary small m-0 mt-2">{aviso}</p>
                ))}
              </>
            )}
          </Card>

        </div>

        {/* Columna Derecha: Agenda de hoy */}
        <div className="col-12 col-lg-7">
          <Card className="h-100">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 className="fw-bold text-dark m-0 fs-5">Próximos turnos</h4>
              <Link to="/calendar" className="text-decoration-none small fw-semibold text-secondary">Ver todos</Link>
            </div>

            <div className="d-flex flex-column gap-3">
              {cargandoTurnos && <p className="text-secondary small m-0">Cargando turnos...</p>}
              {!cargandoTurnos && proximosTurnos.length === 0 && (
                <p className="text-secondary small m-0">No hay turnos próximos.</p>
              )}
              {proximosTurnos.map((turno) => {
                const etiquetaDia = turno.fechaAsignada === hoy ? 'Hoy' : formatearDiaMes(turno.fechaAsignada);
                const hora = formatearHora(turno.franjaHoraria?.horaInicio) ?? 'Sin horario';
                const inmueble = turno.inmueble ?? {};
                const direccion = [inmueble.direccion, inmueble.barrio].filter(Boolean).join(', ') || 'Sin dirección';
                return (
                  // Day/time and state on the first line, then service and address: fits narrow screens.
                  <div key={turno.idTurno} className="d-flex align-items-start gap-3 p-3 rounded-4 border bg-white">
                    <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: '#1B3006', color: 'white' }}>
                      <CalendarCheck size={20} />
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-1">
                        <span className="fw-bold text-dark text-nowrap me-2">{etiquetaDia} · {hora}</span>
                        {getEstadoBadge(turno.estado)}
                      </div>
                      <p className="fw-semibold text-dark small m-0 mt-1 text-break">{turno.servicio?.descripcion}</p>
                      <p className="text-secondary small m-0 d-flex align-items-start gap-1">
                        <MapPin size={13} className="flex-shrink-0 mt-1" /> <span className="text-break">{direccion}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-4">
              <Link to="/calendar" className="text-decoration-none fw-bold" style={{ color: '#1B3006' }}>
                Ver agenda completa
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Notificaciones y Alertas (Épica 14) */}
      <div className="row mt-2">
        <div className="col-12">
          <AlertasNotificacionesCard
            notificaciones={notificaciones}
            historial={historialNotificaciones}
            cargando={cargandoNotificaciones}
            error={errorNotificaciones}
            onActualizar={handleNotificacionesActualizadas}
          />
        </div>
      </div>

    </div>
  );
}
