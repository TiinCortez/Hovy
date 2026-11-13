import { createPortal } from 'react-dom';
import { MapPin } from 'lucide-react';
import ConfirmarVisitaForm from './ConfirmarVisitaForm';
import Modal from '../ui/Modal';

// Mounted by the parent only while open, so the form starts fresh each time.
// The form shows API errors itself, so the modal stays open on failure.
export default function ConfirmarVisitaModal({ visita, onClose, onConfirmed }) {
  const handleDone = async (message) => {
    await onConfirmed(message);
    onClose();
  };

  return createPortal(
    <Modal
      titulo="Confirmar visita"
      subtitulo={(
        <>
          <p className="text-dark fw-semibold small m-0 text-truncate">{visita.nombre} {visita.apellido}</p>
          <p className="text-secondary small m-0 d-flex align-items-center gap-1">
            <MapPin size={13} className="flex-shrink-0" aria-hidden="true" /> {visita.direccion}
          </p>
        </>
      )}
      onCerrar={onClose}
    >
          <div className="modal-body p-4">
            <ConfirmarVisitaForm visita={visita} onDone={handleDone} embedded />
          </div>
    </Modal>,
    document.body
  );
}
