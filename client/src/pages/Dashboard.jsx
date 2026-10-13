import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import Card from '../components/ui/Card.jsx';
import VisitaService from '../services/api/visita.service';
import TurnoService from '../services/api/turno.service';
import { obtenerAhoraTurnos, compararHorarioTurnos } from '../components/turnos/agendaTurnos';

export default function Dashboard() {
  const navigate = useNavigate();
  const [solicitudesNuevas, setSolicitudesNuevas] = useState(0);
  const [turnosHoy, setTurnosHoy] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [visitasResp, turnosResp] = await Promise.all([
          VisitaService.getPendientes().catch((err) => {
            console.error('No se pudieron obtener las solicitudes de visita pendientes:', err);
            return { data: [] };
          }),
          TurnoService.getAll().catch((err) => {
            console.error('No se pudieron obtener los turnos del día:', err);
            return { data: [] };
          })
        ]);

        setSolicitudesNuevas(visitasResp.data?.length ?? 0);

        const hoyIso = obtenerAhoraTurnos().fecha;
        const turnosDeHoy = (turnosResp.data || [])
          .filter((t) => t.estado !== 'CANCELADO' && t.fechaAsignada === hoyIso)
          .sort(compararHorarioTurnos);

        setTurnosHoy(turnosDeHoy);
      } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
      }
    };

    fetchDashboardData();
  }, []);

  // Objeto JSON de prueba (Mock) para secciones pendientes de integración
  const mockData = {
    usuario: "Admin",
    kpis: {
      alertasPendientes: 3,
      kilometrosRuta: 48
    },
    ganancias: {
      total: "1.250.000",
      variacion: "+12.5%"
    },
    logistica: {
      clientesAVisitar: 12,
      combustibleEstimado: "15 L",
      zonaPrincipal: "Zona Norte"
    },
    // Épica 14 y 4: Notificaciones y Alertas del negocio
    alertas: [
      { id: 1, tipo: "Ciclo de corte", mensaje: "Césped en Residencia Lomas excede los 15 días sin corte.", severidad: "alta", fecha: "Hace 1 hora" },
      { id: 2, tipo: "Altura límite", mensaje: "Lote 4B en Country Los Olivos reportado con maleza alta.", severidad: "media", fecha: "Hace 3 horas" },
      { id: 3, tipo: "Nueva solicitud", mensaje: "Juan Pérez solicitó presupuesto para instalación de riego.", severidad: "baja", fecha: "Ayer, 16:00" }
    ]
  };

  // Función auxiliar para renderizar los badges de estado de la agenda
  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'EN_EJECUCION':
        return <span className="badge rounded-pill bg-warning text-dark px-3 py-2 fw-semibold d-flex align-items-center gap-1"><PlayCircle size={14}/> En curso</span>;
      case 'REALIZADO':
        return <span className="badge rounded-pill bg-success text-white px-3 py-2 fw-semibold d-flex align-items-center gap-1"><CheckCircle size={14}/> Realizado</span>;
      case 'CONFIRMADO':
        return <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-3 py-2 fw-semibold d-flex align-items-center gap-1"><CheckCircle size={14}/> Confirmado</span>;
      case 'COORDINADO':
      default:
        return <span className="badge rounded-pill bg-light text-secondary border px-3 py-2 fw-semibold d-flex align-items-center gap-1"><Clock size={14}/> Coordinado</span>;
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
                <h3 className="fw-bold m-0 text-dark">{turnosHoy.length}</h3>
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
                <p className="text-secondary small fw-semibold m-0">Ruta diaria (Km)</p>
                <h3 className="fw-bold m-0 text-dark">{mockData.kpis.kilometrosRuta}</h3>
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
            <div className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-light mb-2">
              <span className="text-secondary fw-semibold">Clientes a visitar</span>
              <span className="fw-bold text-dark">{mockData.logistica.clientesAVisitar}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-light mb-2">
              <span className="text-secondary fw-semibold">Combustible est.</span>
              <span className="fw-bold text-dark">{mockData.logistica.combustibleEstimado}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-light">
              <span className="text-secondary fw-semibold">Zona principal</span>
              <span className="fw-bold text-dark">{mockData.logistica.zonaPrincipal}</span>
            </div>
          </Card>

        </div>

        {/* Columna Derecha: Agenda de hoy */}
        <div className="col-12 col-lg-7">
          <Card className="h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="fw-bold text-dark m-0 fs-5">Turnos de hoy</h4>
              </div>
              
              <div className="d-flex flex-column gap-3">
                {turnosHoy.length === 0 ? (
                  <div className="text-center py-4 text-secondary small">
                    No hay turnos programados para hoy.
                  </div>
                ) : (
                  turnosHoy.map((turno) => {
                    const nombreCliente = turno.cliente?.razon_social || `${turno.cliente?.nombre || ''} ${turno.cliente?.apellido || ''}`.trim() || turno.inmueble?.direccion || 'Cliente';
                    const horarioStr = turno.franjaHoraria?.horaInicio
                      ? `${turno.franjaHoraria.horaInicio.slice(0, 5)}${turno.franjaHoraria.horaFin ? ` - ${turno.franjaHoraria.horaFin.slice(0, 5)}` : ''} hs`
                      : 'Sin horario';
                    const servicioStr = turno.servicio?.descripcion || 'Mantenimiento General';

                    return (
                      <div key={turno.idTurno} className="d-flex align-items-center p-3 rounded-4 border bg-white shadow-sm" style={{ transition: 'all 0.2s' }}>
                        <div className="p-3 rounded-4 me-3 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#1B3006', color: 'white' }}>
                          <CalendarCheck size={24} />
                        </div>
                        <div className="flex-grow-1">
                          <h5 className="fw-bold text-dark m-0 fs-6">{nombreCliente}</h5>
                          <p className="text-secondary small m-0">{horarioStr} - {servicioStr}</p>
                        </div>
                        <div>
                          {getEstadoBadge(turno.estado)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => navigate('/calendar')}
                className="btn btn-link text-decoration-none fw-bold p-0"
                style={{ color: '#1B3006' }}
              >
                Ver agenda completa
              </button>
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
