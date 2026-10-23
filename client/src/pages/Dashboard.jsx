import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  ClipboardList,
  AlertTriangle,
  MapPin,
  TrendingUp,
  MoreVertical,
  ArrowRight,
  Clock,
  CheckCircle,
  PlayCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import VisitaService from '../services/api/visita.service';
import TurnoService from '../services/api/turno.service';
import LogisticaService from '../services/api/logistica.service';
import { compararHorarioTurnos, obtenerAhoraTurnos } from '../components/turnos/agendaTurnos';
import {
  avisosLogistica, etiquetaConsumo, formatearConsumo, formatearCosto, formatearKm, SIN_DATO
} from '../components/dashboard/logisticaUtils';

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
  // y combustible). Ganancias y alertas del panel siguen mockeadas.
  const [solicitudesNuevas, setSolicitudesNuevas] = useState(0);
  const [turnos, setTurnos] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(true);
  const [logistica, setLogistica] = useState(null);
  const [cargandoLogistica, setCargandoLogistica] = useState(true);
  const [errorLogistica, setErrorLogistica] = useState(false);

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

  // Objeto JSON de prueba (Mock) realista basado en las Épicas 4, 5 y 14
  const mockData = {
    usuario: "Admin",
    kpis: {
      alertasPendientes: 3
    },
    ganancias: {
      total: "1.250.000",
      variacion: "+12.5%"
    },
    // Épica 14 y 4: Notificaciones y Alertas del negocio
    alertas: [
      { id: 1, tipo: "Ciclo de corte", mensaje: "Césped en Residencia Lomas excede los 15 días sin corte.", severidad: "alta", fecha: "Hace 1 hora" },
      { id: 2, tipo: "Altura límite", mensaje: "Lote 4B en Country Los Olivos reportado con maleza alta.", severidad: "media", fecha: "Hace 3 horas" },
      { id: 3, tipo: "Nueva solicitud", mensaje: "Juan Pérez solicitó presupuesto para instalación de riego.", severidad: "baja", fecha: "Ayer, 16:00" }
    ]
  };

  const hoy = obtenerAhoraTurnos().fecha;
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
        return <span className="badge rounded-pill bg-warning text-dark px-3 py-2 fw-semibold d-flex align-items-center gap-1"><PlayCircle size={14}/> En curso</span>;
      case 'REALIZADO':
        return <span className="badge rounded-pill bg-success text-white px-3 py-2 fw-semibold d-flex align-items-center gap-1"><CheckCircle size={14}/> Realizado</span>;
      case 'CONFIRMADO':
        return <span className="badge rounded-pill bg-info bg-opacity-10 text-info border px-3 py-2 fw-semibold d-flex align-items-center gap-1"><CheckCircle size={14}/> Confirmado</span>;
      case 'COORDINADO':
      default:
        return <span className="badge rounded-pill bg-light text-secondary border px-3 py-2 fw-semibold d-flex align-items-center gap-1"><Clock size={14}/> Pendiente</span>;
    }
  };

  // Función auxiliar para renderizar los íconos de las alertas según severidad
  const getAlertaIcon = (severidad) => {
    switch (severidad) {
      case 'alta': return <div className="p-2 rounded-circle bg-danger bg-opacity-10 text-danger"><AlertTriangle size={20} /></div>;
      case 'media': return <div className="p-2 rounded-circle bg-warning bg-opacity-10 text-warning"><AlertTriangle size={20} /></div>;
      case 'baja': return <div className="p-2 rounded-circle bg-info bg-opacity-10 text-info"><ClipboardList size={20} /></div>;
      default: return <AlertTriangle size={20} />;
    }
  };

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      {/* Encabezado */}
      <div>
        <h2 className="fw-bold fs-2 text-dark mb-1">Hola, {mockData.usuario}</h2>
        <p className="text-secondary m-0">Aquí tienes el resumen de tu jardín para hoy.</p>
      </div>

      {/* KPIs Top (4 columnas en desktop, 2 en móvil) */}
      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <Card className="h-100 p-2">
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
          <Card className="h-100 p-2">
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
          <Card className="h-100 p-2">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(186, 26, 26, 0.1)', color: '#ba1a1a' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-secondary small fw-semibold m-0">Alertas</p>
                <h3 className="fw-bold m-0 text-dark">{mockData.kpis.alertasPendientes}</h3>
              </div>
            </div>
          </Card>
        </div>
        <div className="col-6 col-lg-3">
          <Card className="h-100 p-2">
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
            <h2 className="fw-bold m-0 mb-1" style={{ fontSize: '3rem', color: '#1B3006', letterSpacing: '-0.02em' }}>
              ${mockData.ganancias.total}
            </h2>
            <p className="fw-semibold text-success small mb-5">
              <TrendingUp size={16} className="me-1"/> {mockData.ganancias.variacion} respecto al mes pasado
            </p>
            <a href="#estadisticas" className="text-decoration-none fw-bold mt-auto" style={{ color: '#1B3006' }}>
              Ver estadísticas detalladas <ArrowRight size={18} className="ms-1" />
            </a>
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
                  <div key={turno.idTurno} className="d-flex align-items-center p-3 rounded-4 border bg-white shadow-sm" style={{ transition: 'all 0.2s' }}>
                    <div className="p-3 rounded-4 me-3 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#1B3006', color: 'white' }}>
                      <CalendarCheck size={24} />
                    </div>
                    <div className="flex-grow-1">
                      <h5 className="fw-bold text-dark m-0 fs-6">{etiquetaDia} · {hora} - {turno.servicio?.descripcion}</h5>
                      <p className="text-secondary small m-0 d-flex align-items-center gap-1"><MapPin size={14} /> {direccion}</p>
                    </div>
                    <div>
                      {getEstadoBadge(turno.estado)}
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
          <Card>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 className="fw-bold text-dark m-0 fs-5">Alertas y Notificaciones</h4>
              <button type="button" className="btn btn-light btn-icon" aria-label="Opciones"><MoreVertical size={20}/></button>
            </div>
            
            <div className="table-responsive">
              <table className="table table-hover align-middle m-0">
                <thead className="text-secondary small">
                  <tr>
                    <th className="border-0 pb-3 fw-semibold">Tipo de Alerta</th>
                    <th className="border-0 pb-3 fw-semibold">Mensaje</th>
                    <th className="border-0 pb-3 fw-semibold text-end">Tiempo</th>
                  </tr>
                </thead>
                <tbody className="border-top">
                  {mockData.alertas.map((alerta) => (
                    <tr key={alerta.id}>
                      <td className="py-3">
                        <div className="d-flex align-items-center gap-3">
                          {getAlertaIcon(alerta.severidad)}
                          <span className="fw-bold text-dark">{alerta.tipo}</span>
                        </div>
                      </td>
                      <td className="py-3 text-secondary">{alerta.mensaje}</td>
                      <td className="py-3 text-secondary text-end small">{alerta.fecha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
}
