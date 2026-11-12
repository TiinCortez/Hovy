import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, MoreVertical, X } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Paginacion from './Paginacion.jsx';
import CancelarNotificacionModal from './CancelarNotificacionModal.jsx';
import { obtenerTipo, destinoNotificacion, formatearTiempo } from './notificacionesConfig.js';
import './notificaciones.scss';

const POR_PAGINA = 5;

// Sección "Alertas y Notificaciones" del Dashboard (Épica 14).
export default function AlertasNotificacionesCard({ notificaciones, cargando, error, onActualizar }) {
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);
  const [aCancelar, setACancelar] = useState(null);

  const totalPaginas = Math.max(1, Math.ceil(notificaciones.length / POR_PAGINA));
  // Si se eliminó la última de una página, se queda en la anterior.
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = notificaciones.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const irADestino = (notificacion) => {
    const destino = destinoNotificacion(notificacion);
    if (destino) navigate(destino.to, { state: destino.state });
  };

  return (
    <Card id="alertas-notificaciones">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold text-dark m-0 fs-5">Alertas y Notificaciones</h4>
        <div className="d-flex align-items-center gap-2">
          <Link
            to="/notificaciones/historial"
            className="btn btn-light btn-sm border rounded-3 d-flex align-items-center gap-1 fw-semibold text-secondary"
            title="Ver historial de notificaciones"
          >
            <Clock size={14} /> Ver historial
          </Link>
          <button type="button" className="btn btn-light btn-icon" aria-label="Opciones"><MoreVertical size={20}/></button>
        </div>
      </div>

      {error && <p className="text-danger small m-0" role="alert">No se pudieron cargar las notificaciones.</p>}

      {!error && (
        <>
          <div className="table-responsive">
            <table className="table table-hover align-middle m-0">
              <thead className="text-secondary small">
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
                {!cargando && notificaciones.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-secondary small">No tenés alertas ni notificaciones pendientes.</td></tr>
                )}
                {!cargando && visibles.map((notificacion) => {
                  const tipo = obtenerTipo(notificacion.tipo);
                  const Icono = tipo.Icono;
                  const destino = destinoNotificacion(notificacion);
                  return (
                    <tr key={notificacion.id_notificacion}>
                      <td className="py-3">
                        <div className="d-flex align-items-center gap-3">
                          <span className="notificacion-icono" style={{ backgroundColor: tipo.fondo, color: tipo.color }}>
                            <Icono size={16} />
                          </span>
                          <span className="fw-bold text-dark text-nowrap">{tipo.etiqueta}</span>
                        </div>
                      </td>
                      <td className="py-3 text-secondary">{notificacion.mensaje}</td>
                      <td className="py-3 text-secondary text-end small text-nowrap">
                        {formatearTiempo(notificacion.fecha_notificacion)}
                      </td>
                      <td className="py-3 text-end text-nowrap">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!cargando && notificaciones.length > 0 && (
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-3 mt-2 border-top">
              <span className="small text-secondary fw-medium">
                Mostrando {visibles.length} de {notificaciones.length} alertas
              </span>
              <Paginacion pagina={paginaActual} totalPaginas={totalPaginas} onCambiar={setPagina} />
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
