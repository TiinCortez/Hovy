import { UserPlus, ChevronRight, Inbox } from 'lucide-react';

const FRANJA_TEXTO = {
  Mañana: 'por la mañana',
  Tarde: 'por la tarde',
  Indistinto: 'en cualquier horario',
};

export default function VisitasNotificacionesPopover({ visitas, onVerDetalle }) {
  return (
    <div
      className="visitas-popover shadow-lg rounded-4 p-0 overflow-hidden"
      style={{ zIndex: 1050 }}
    >
      <div className="px-3 py-3 border-bottom" style={{ borderColor: '#D1D1C4' }}>
        <h6 className="fw-bold text-dark m-0">Notificaciones</h6>
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto', backgroundColor: '#ffffff' }}>
        {visitas.length === 0 && (
          <div className="d-flex flex-column align-items-center text-center gap-2 py-5 px-3 text-secondary">
            <Inbox size={28} />
            <span className="small">No hay solicitudes de visita pendientes.</span>
          </div>
        )}

        {visitas.map((visita) => {
          const franja = FRANJA_TEXTO[visita.franja_preferida] ?? FRANJA_TEXTO.Indistinto;
          return (
            <button
              key={visita.id_solicitud}
              type="button"
              onClick={() => onVerDetalle(visita.id_solicitud)}
              className="visitas-popover-item w-100 text-start bg-transparent border-0 border-bottom px-3 py-3 d-flex align-items-center gap-3"
              style={{ borderColor: '#D1D1C4' }}
            >
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 38, height: 38, backgroundColor: 'rgba(27, 48, 6, 0.08)', color: '#1B3006' }}
              >
                <UserPlus size={18} />
              </div>
              <p className="small text-dark m-0 flex-grow-1">
                <strong>¡Nueva solicitud de visita!</strong> Usuario {visita.nombre} con disponibilidad {franja}.
              </p>
              <ChevronRight size={18} className="text-secondary flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
