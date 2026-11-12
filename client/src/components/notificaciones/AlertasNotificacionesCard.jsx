import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Clock, MoreVertical, X } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Paginacion from './Paginacion.jsx';
import CancelarNotificacionModal from './CancelarNotificacionModal.jsx';
import { obtenerTipo, destinoNotificacion, formatearTiempo } from './notificacionesConfig.js';
import './notificaciones.scss';

const POR_PAGINA = 3;

const fechaMs = (notificacion) => new Date(notificacion.fecha_notificacion).getTime() || 0;
const masNuevasPrimero = (a, b) => fechaMs(b) - fechaMs(a);

// Sección "Alertas y Notificaciones" del Dashboard (Épica 14).
// Shows the active notifications first and then the past ones (resolved or
// cancelled, from the history), 3 per page, so the card never looks empty when
// everything was already handled.
export default function AlertasNotificacionesCard({ notificaciones, historial = [], cargando, error, onActualizar }) {
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);
  const [aCancelar, setACancelar] = useState(null);

  const todas = [
    ...[...notificaciones].sort(masNuevasPrimero),
    ...[...historial].sort(masNuevasPrimero),
  ];
  const totalPaginas = Math.max(1, Math.ceil(todas.length / POR_PAGINA));
  // Si se eliminó la última de una página, se queda en la anterior.
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = todas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const irADestino = (notificacion) => {
    const destino = destinoNotificacion(notificacion);
    if (destino) navigate(destino.to, { state: destino.state });
  };

  return (
    <Card id="alertas-notificaciones">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3 mb-md-4">
        <h4 className="fw-bold text-dark m-0 fs-5" style={{ minWidth: 0 }}>Alertas y Notificaciones</h4>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          <Link
            to="/notificaciones/historial"
            className="btn btn-light btn-sm border rounded-3 d-flex align-items-center gap-1 fw-semibold text-secondary"
            title="Ver historial de notificaciones"
            aria-label="Ver historial de notificaciones"
          >
            <Clock size={14} /> <span className="d-none d-sm-inline">Ver historial</span>
          </Link>
          <button type="button" className="btn btn-light btn-icon" aria-label="Opciones"><MoreVertical size={20}/></button>
        </div>
      </div>

      {error && <p className="text-danger small m-0" role="alert">No se pudieron cargar las notificaciones.</p>}

      {!error && (
        <>
          <div className="table-responsive">
            {/* w-100: the Bootstrap tables module is not imported, so .table has no width */}
            <table className="table table-hover align-middle m-0 w-100 notificaciones-tabla">
              <thead className="text-dark small">
                <tr>
                  <th className="border-0 pb-3 fw-semibold">Tipo de Alerta</th>
                  <th className="border-0 pb-3 fw-semibold">Mensaje</th>
                  <th className="border-0 pb-3 fw-semibold text-end">Tiempo</th>
                  <th className="border-0 pb-3" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody className="border-top">
                {cargando && (
                  <tr><td colSpan={4} className="py-4 text-center text-secondary small">Cargando notificaciones...</td></tr>
                )}
                {!cargando && todas.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-secondary small">No tenés alertas ni notificaciones pendientes.</td></tr>
                )}
                {!cargando && visibles.map((notificacion) => {
                  const tipo = obtenerTipo(notificacion.tipo);
                  const Icono = tipo.Icono;
                  const destino = destinoNotificacion(notificacion);
                  // Past notifications come with estado Resuelta / Cancelada; active ones are actionable.
                  const pasada = notificacion.estado === 'Resuelta' || notificacion.estado === 'Cancelada';
                  return (
                    <tr key={notificacion.id_notificacion}>
                      <td className="py-3 notif-td-tipo">
                        <div className="d-flex align-items-center gap-3">
                          <span className="notificacion-icono" style={{ backgroundColor: tipo.fondo, color: tipo.color }}>
                            <Icono size={16} />
                          </span>
                          <span className="fw-bold text-dark text-nowrap">{tipo.etiqueta}</span>
                        </div>
                      </td>
                      <td className="py-3 text-dark notif-td-mensaje">{notificacion.mensaje}</td>
                      <td className="py-3 text-dark text-end small text-nowrap notif-td-tiempo">
                        {formatearTiempo(notificacion.fecha_notificacion)}
                      </td>
                      <td className="py-3 text-end text-nowrap notif-td-acciones">
                        {pasada ? (
                          notificacion.estado === 'Cancelada'
                            ? <span className="notificacion-estado cancelada"><X size={14} /> Cancelada</span>
                            : <span className="notificacion-estado resuelta"><Check size={14} /> Resuelto</span>
                        ) : (
                        <div className="d-inline-flex align-items-center gap-2">
                          {destino && (
                            <button
                              type="button"
                              className="btn btn-light btn-sm border rounded-pill px-3 fw-semibold"
                              style={{ color: '#1B3006' }}
                              onClick={() => irADestino(notificacion)}
                            >
                              {tipo.textoBoton}
                            </button>
                          )}
                          <button
                            type="button"
                            className="notificacion-accion cancelar"
                            title="Descartar notificación"
                            aria-label="Descartar notificación"
                            onClick={() => setACancelar(notificacion)}
                          >
                            <X size={16} />
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!cargando && todas.length > 0 && (
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-3 mt-2 border-top">
              <span className="small text-dark fw-medium">
                {notificaciones.length === 0
                  ? 'Sin alertas pendientes · mostrando las anteriores'
                  : `${notificaciones.length} ${notificaciones.length === 1 ? 'alerta pendiente' : 'alertas pendientes'}`}
              </span>
              <Paginacion pagina={paginaActual} totalPaginas={totalPaginas} onCambiar={setPagina} compacta />
            </div>
          )}
        </>
      )}

      <CancelarNotificacionModal
        isOpen={!!aCancelar}
        notificacion={aCancelar}
        onClose={() => setACancelar(null)}
        onCancelled={onActualizar}
      />
    </Card>
  );
}
