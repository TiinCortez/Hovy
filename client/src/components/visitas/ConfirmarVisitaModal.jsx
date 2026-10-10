import { createPortal } from 'react-dom';
import { MapPin } from 'lucide-react';
import CloseButton from '../ui/CloseButton';
import ConfirmarVisitaForm from './ConfirmarVisitaForm';

// Mounted by the parent only while open, so the form starts fresh each time.
// The form shows API errors itself, so the modal stays open on failure.
export default function ConfirmarVisitaModal({ visita, onClose, onConfirmed }) {
  const handleDone = async (message) => {
    await onConfirmed(message);
    onClose();
  };

  return createPortal(
    <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <div className="overflow-hidden">
              <h5 className="modal-title fw-bold text-dark fs-4">Confirmar visita</h5>
              <p className="text-dark fw-semibold small m-0 text-truncate">{visita.nombre} {visita.apellido}</p>
              <p className="text-secondary small m-0 d-flex align-items-center gap-1">
                <MapPin size={13} className="flex-shrink-0" /> {visita.direccion}
              </p>
            </div>
            <CloseButton label="Cerrar" onClick={onClose} />
          </div>
          <div className="modal-body p-4">
            <ConfirmarVisitaForm visita={visita} onDone={handleDone} embedded />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
