import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Calendar as CalendarIcon, Check, RefreshCw, RotateCcw, Search, X } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Paginacion from '../components/notificaciones/Paginacion.jsx';
import NotificacionService from '../services/api/notificacion.service';
import {
  TIPOS_NOTIFICACION,
  obtenerTipo,
  avisarNotificacionesActualizadas,
  formatearFechaLarga,
  formatearTiempo,
} from '../components/notificaciones/notificacionesConfig.js';
import '../components/notificaciones/notificaciones.scss';
import { VERDE } from '../styles/colores';

const POR_PAGINA = 10;
const DIAS_HISTORIAL = 60;

export default function NotificacionesHistorialPage() {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [restaurandoId, setRestaurandoId] = useState(null);
  const [errorRestaurar, setErrorRestaurar] = useState(null);
  // Se incrementa para volver a pedir el historial (actualizar / restaurar).
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const fetchHistorial = async () => {
      try {
        const response = await NotificacionService.getHistorial();
        setRegistros(response.data ?? []);
        setError(false);
      } catch (err) {
        console.error('No se pudo obtener el historial de notificaciones:', err);
        setError(true);
      } finally {
        setCargando(false);
      }
    };

    fetchHistorial();
  }, [version]);

  const recargar = () => {
    setCargando(true);
    setVersion((v) => v + 1);
  };

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return registros.filter((n) => {
      if (filtroTipo !== 'todos' && n.tipo !== filtroTipo) return false;
      if (!texto) return true;
      return `${obtenerTipo(n.tipo).etiqueta} ${n.mensaje}`.toLowerCase().includes(texto);
    });
  }, [registros, filtroTipo, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const inicioRango = new Date();
  inicioRango.setDate(inicioRango.getDate() - DIAS_HISTORIAL);

  const cambiarFiltro = (tipo) => {
    setFiltroTipo(tipo);
    setPagina(1);
  };

  // Cancelada -> Activa. Si ya no aplica, la próxima sincronización la deja Resuelta.
  const handleRestaurar = async (notificacion) => {
    setRestaurandoId(notificacion.id_notificacion);
    setErrorRestaurar(null);
    try {
      await NotificacionService.restaurar(notificacion.id_notificacion);
      recargar();
      avisarNotificacionesActualizadas();
    } catch (err) {
      setErrorRestaurar(err.response?.data?.error || err.message || 'No se pudo restaurar la notificación.');
    } finally {
      setRestaurandoId(null);
    }
  };

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      {/* Breadcrumb y título */}
      <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
        <div>
          <nav className="d-flex align-items-center gap-2 small fw-medium text-secondary mb-1" aria-label="breadcrumb">
            <Link to="/dashboard" className="text-secondary text-decoration-none">Panel</Link>
            <span>/</span>
            <span className="text-success fw-semibold">Historial de Notificaciones</span>
          </nav>
          <h2 className="fw-bold fs-4 text-dark m-0">Centro de Registro de Eventos</h2>
        </div>
        <span className="notificaciones-filtro-activo">
          <span className="punto" /> Filtro activo: Últimos {DIAS_HISTORIAL} días
        </span>
      </div>

      <Card>
        {/* Encabezado de la tarjeta */}
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div>
            <h4 className="fw-bold text-dark m-0 fs-5">Alertas y Notificaciones</h4>
            <p className="small text-secondary m-0 mt-1">
              Notificaciones resueltas y canceladas de los últimos {DIAS_HISTORIAL} días
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="btn btn-light btn-sm border rounded-3 d-flex align-items-center gap-1 fw-semibold" style={{ color: VERDE, cursor: 'default' }}>
              <CalendarIcon size={14} /> Últimos {DIAS_HISTORIAL} días
            </span>
            <button
              type="button"
              className="btn btn-light btn-icon"
              aria-label="Actualizar datos"
              title="Actualizar datos"
              onClick={recargar}
              disabled={cargando}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-4 pt-1 pb-3 border-bottom">
          <div className="d-flex flex-wrap align-items-center gap-2 small">
            <span className="text-secondary fw-medium me-1">Filtrar por:</span>
            <button type="button" className={`notificaciones-chip${filtroTipo === 'todos' ? ' activo' : ''}`} onClick={() => cambiarFiltro('todos')}>
              Todos ({registros.length})
            </button>
            {Object.entries(TIPOS_NOTIFICACION).map(([clave, tipo]) => (
              <button
                key={clave}
                type="button"
                className={`notificaciones-chip${filtroTipo === clave ? ' activo' : ''}`}
                onClick={() => cambiarFiltro(clave)}
              >
                {tipo.etiqueta}
              </button>
            ))}
          </div>
          <div className="position-relative" style={{ width: '100%', maxWidth: 260 }}>
            <Search size={14} className="position-absolute text-secondary" style={{ left: 10, top: 9 }} />
            <input
              type="text"
              className="form-control form-control-sm ps-4"
              placeholder="Buscar por cliente, lote o mensaje…"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            />
          </div>
        </div>

        {errorRestaurar && (
          <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mt-3 mb-0" role="alert">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span className="small fw-medium">{errorRestaurar}</span>
          </div>
        )}

        {error ? (
          <p className="text-danger small m-0 mt-3" role="alert">No se pudo cargar el historial de notificaciones.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle m-0 w-100 notificaciones-tabla">
              <thead className="text-secondary small">
                <tr>
                  <th className="border-0 py-3 fw-semibold">Estado</th>
                  <th className="border-0 py-3 fw-semibold">Tipo de Alerta</th>
                  <th className="border-0 py-3 fw-semibold">Mensaje</th>
                  <th className="border-0 py-3 fw-semibold text-end">Tiempo</th>
                  <th className="border-0 py-3" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody className="border-top">
                {cargando && (
                  <tr><td colSpan={5} className="py-4 text-center text-secondary small">Cargando historial…</td></tr>
                )}
                {!cargando && filtrados.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-secondary small">No hay notificaciones en el historial.</td></tr>
                )}
                {!cargando && visibles.map((notificacion) => {
                  const tipo = obtenerTipo(notificacion.tipo);
                  const Icono = tipo.Icono;
                  const cancelada = notificacion.estado === 'Cancelada';
                  return (
                    <tr key={notificacion.id_notificacion}>
                      <td className="py-3 notif-td-estado">
                        {cancelada ? (
                          <span className="notificacion-estado cancelada"><X size={14} /> Cancelada</span>
                        ) : (
                          <span className="notificacion-estado resuelta"><Check size={14} /> Resuelto</span>
                        )}
                      </td>
                      <td className="py-3 notif-td-tipo">
                        <div className="d-flex align-items-center gap-3">
                          <span className="notificacion-icono" style={{ backgroundColor: tipo.fondo, color: tipo.color }}>
                            <Icono size={16} />
                          </span>
                          <span className="fw-bold text-dark text-nowrap">{tipo.etiqueta}</span>
                        </div>
                      </td>
                      <td className="py-3 text-secondary notif-td-mensaje">{notificacion.mensaje}</td>
                      <td className="py-3 text-secondary text-end small text-nowrap notif-td-tiempo">
                        {formatearTiempo(notificacion.fecha_cierre)}
                      </td>
                      <td className="py-3 text-end notif-td-acciones">
                        {cancelada && (
                          <button
                            type="button"
                            className="notificacion-accion restaurar"
                            title="Restaurar notificación"
                            aria-label="Restaurar notificación"
                            onClick={() => handleRestaurar(notificacion)}
                            disabled={restaurandoId === notificacion.id_notificacion}
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pie: resumen y paginación */}
        {!cargando && !error && (
          <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3 pt-3 mt-2 border-top small text-secondary">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span>Mostrando <strong>{visibles.length}</strong> de <strong>{filtrados.length}</strong> registros en la ventana seleccionada</span>
              <span className="rounded-circle bg-secondary d-inline-block" style={{ width: 4, height: 4 }} />
              <span className="text-success fw-medium">Rango: {formatearFechaLarga(inicioRango)} – Hoy</span>
            </div>
            <Paginacion pagina={paginaActual} totalPaginas={totalPaginas} onCambiar={setPagina} />
          </div>
        )}
      </Card>
    </div>
  );
}
