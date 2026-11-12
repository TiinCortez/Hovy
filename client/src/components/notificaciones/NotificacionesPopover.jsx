import { useState } from 'react';
import { Inbox, ArrowRight } from 'lucide-react';
import Paginacion from './Paginacion.jsx';
import { obtenerTipo, destinoNotificacion, formatearTiempo } from './notificacionesConfig.js';
import './notificaciones.scss';

const POR_PAGINA = 2;

// Popover de la campana del Header. Usa las clases visitas-popover de main.scss.
export default function NotificacionesPopover({ notificaciones, onAbrir, onVerTodas }) {
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(notificaciones.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = notificaciones.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  return (
    <div className="visitas-popover shadow-lg rounded-4 p-0 overflow-hidden" style={{ zIndex: 1050 }}>
      <div className="px-3 py-3 border-bottom d-flex align-items-center justify-content-between" style={{ borderColor: '#D1D1C4' }}>
        <h6 className="fw-bold text-dark m-0">Notificaciones</h6>
        {notificaciones.length > 0 && (
          <span className="small text-secondary">{notificaciones.length} sin resolver</span>
        )}
      </div>

      <div style={{ backgroundColor: '#ffffff' }}>
        {notificaciones.length === 0 && (
          <div className="d-flex flex-column align-items-center text-center gap-2 py-5 px-3 text-secondary">
            <Inbox size={28} />
            <span className="small">No tenés notificaciones pendientes.</span>
          </div>
        )}

        {visibles.map((notificacion) => {
          const tipo = obtenerTipo(notificacion.tipo);
          const Icono = tipo.Icono;
          const destino = destinoNotificacion(notificacion);
          return (
            <button
              key={notificacion.id_notificacion}
              type="button"
              onClick={() => destino && onAbrir(destino)}
              disabled={!destino}
              className="visitas-popover-item w-100 text-start bg-transparent border-0 border-bottom px-3 py-3 d-flex align-items-center gap-3"
              style={{ borderColor: '#D1D1C4' }}
            >
              <span className="notificacion-icono" style={{ backgroundColor: tipo.fondo, color: tipo.color }}>
                <Icono size={16} />
              </span>
              <span className="flex-grow-1">
                <span className="small fw-bold text-dark d-block">{tipo.etiqueta}</span>
                <span className="small text-secondary d-block">{notificacion.mensaje}</span>
                <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>
                  {formatearTiempo(notificacion.fecha_notificacion)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-3 py-2 border-top d-flex align-items-center justify-content-between gap-2" style={{ borderColor: '#D1D1C4' }}>
        <Paginacion pagina={paginaActual} totalPaginas={totalPaginas} onCambiar={setPagina} compacta />
        <button
          type="button"
          onClick={onVerTodas}
          className="btn btn-link p-0 ms-auto small fw-semibold text-decoration-none d-flex align-items-center gap-1"
          style={{ color: '#1B3006', fontSize: '0.8rem' }}
        >
          Ver todas <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
