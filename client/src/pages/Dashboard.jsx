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
import AuthService from '../services/auth.service';
import VisitaService from '../services/api/visita.service';
import TurnoService from '../services/api/turno.service';
import LogisticaService from '../services/api/logistica.service';
import NotificacionService from '../services/api/notificacion.service';
import AlertasNotificacionesCard from '../components/notificaciones/AlertasNotificacionesCard.jsx';
import { avisarNotificacionesActualizadas } from '../components/notificaciones/notificacionesConfig.js';
import { esSolicitudNueva } from '../components/visitas/visitaUtils.js';
import { compararHorarioTurnos, formatearMontoARS, obtenerAhoraTurnos } from '../components/turnos/agendaTurnos';
import {
  avisosLogistica, etiquetaConsumo, formatearConsumo, formatearCosto, formatearKm, SIN_DATO
} from '../components/dashboard/logisticaUtils';
import {
  resolverPeriodo, filtrarRealizados, resumirPeriodo, calcularVariacion, formatearPorcentaje
} from '../components/metricas/metricasUtils';
import { VERDE } from '../styles/colores';
import Badge from '../components/ui/Badge';

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
  // Se incrementa para volver a pedir las notificaciones (tras eliminar una).
  const [versionNotificaciones, setVersionNotificaciones] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const fetchNotificaciones = async () => {
      try {
        // Only the active ones: the history lives in /notificaciones/historial.
        const response = await NotificacionService.getActivas();
        setNotificaciones(response.data ?? []);
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
    // Not only estado Pendiente: an existing client's request arrives already
    // Confirmada (waiting for its budget) and also counts as new.
    const fetchSolicitudesNuevas = async () => {
      try {
        const response = await VisitaService.getAll();
        setSolicitudesNuevas((response.data ?? []).filter(esSolicitudNueva).length);
      } catch (err) {
        console.error('No se pudieron obtener las solicitudes nuevas:', err);
      }
    };

    fetchSolicitudesNuevas();
  }, []);

  const nombreUsuario = AuthService.getSession()?.user?.usuario?.trim();

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
        return <Badge tipo="en-curso" conPunto={false} className="flex-shrink-0"><PlayCircle size={12}/> En curso</Badge>;
      case 'REALIZADO':
        return <Badge tipo="exito" conPunto={false} className="flex-shrink-0"><CheckCircle size={12}/> Realizado</Badge>;
      case 'CONFIRMADO':
        return <Badge tipo="info" conPunto={false} className="flex-shrink-0"><CheckCircle size={12}/> Confirmado</Badge>;
      case 'COORDINADO':
      default:
        return <Badge tipo="pendiente" conPunto={false} className="flex-shrink-0"><Clock size={12}/> Pendiente</Badge>;
    }
  };

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      {/* Encabezado */}
      <div>
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="hovy-rotulo">Panel de control</span>
        </div>
        <h2 className="fw-bold fs-2 text-dark m-0">{nombreUsuario ? `Hola, ${nombreUsuario}` : 'Hola'}</h2>
      </div>

      {/* KPIs Top (4 columnas en desktop, 2 en móvil) */}
      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <Card className="h-100 p-2 dashboard-kpi">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(170, 59, 255, 0.1)', color: VERDE }}>
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
              <div className="p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(253, 203, 155, 0.3)', color: 'var(--hovy-ambar-800)' }}>
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
              <div className="p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(186, 26, 26, 0.1)', color: 'var(--hovy-rojo-600)' }}>
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
              <div className="p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(27, 48, 6, 0.1)', color: VERDE }}>
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
          <Card className="h-100 dashboard-ganancias-card overflow-hidden">
            <div className="dashboard-ganancias-deco" aria-hidden="true" />
            <div className="dashboard-ganancias-cuerpo">
              <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                <div>
                  <h4 className="fw-bold text-dark m-0 fs-5">Resumen de Ganancias</h4>
                  <p className="text-secondary small fw-medium m-0 mt-1">Total recaudado este mes</p>
                </div>
                <span className="dashboard-ganancias-icono" aria-hidden="true">
                  <TrendingUp size={20} />
                </span>
              </div>

              <div className="my-auto py-2">
                <h2
                  className="fw-bold m-0 mb-2"
                  style={{ fontSize: 'clamp(1.85rem, 7vw, 2.75rem)', color: VERDE, letterSpacing: '-0.025em', lineHeight: 1.08, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
                >
                  {cargandoTurnos ? '...' : formatearMontoARS(cobradoActual)}
                </h2>
                <span className={`dashboard-ganancias-variacion ${variacionGanancias.diferencia < 0 ? 'is-baja' : 'is-sube'}`}>
                  {variacionGanancias.diferencia < 0
                    ? <TrendingDown size={14} aria-hidden="true" />
                    : <TrendingUp size={14} aria-hidden="true" />}
                  {cargandoTurnos
                    ? '...'
                    : `${variacionGanancias.porcentaje === null ? 'Sin datos' : formatearPorcentaje(variacionGanancias.porcentaje, { conSigno: true })} respecto al mes pasado`}
                </span>
              </div>
            </div>

            <div className="dashboard-ganancias-pie">
              <span className="text-secondary small fw-semibold">Detalle mensual</span>
              <Link to="/cobros" className="btn btn-primary btn-sm dashboard-ganancias-btn">
                Ver cobros <ArrowRight size={15} className="dashboard-ganancias-flecha" aria-hidden="true" />
              </Link>
            </div>
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
              {cargandoTurnos && <p className="text-secondary small m-0">Cargando turnos…</p>}
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
                    <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: VERDE, color: 'white' }}>
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
              <Link to="/calendar" className="text-decoration-none fw-bold" style={{ color: VERDE }}>
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
            cargando={cargandoNotificaciones}
            error={errorNotificaciones}
            onActualizar={handleNotificacionesActualizadas}
          />
        </div>
      </div>

    </div>
  );
}
