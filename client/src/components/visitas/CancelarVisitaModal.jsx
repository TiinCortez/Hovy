import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import VisitaService from '../../services/api/visita.service';
import { getApiError } from './visitaUtils';

// Mounted by the parent only while open
export default function CancelarVisitaModal({ idSolicitud, onClose, onCancelled }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await VisitaService.cancelar(idSolicitud);
      await onCancelled();
      onClose();
    } catch (err) {
      setErrorMessage(getApiError(err, 'No se pudo cancelar la visita.'));
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4">Cancelar visita</h5>
            <CloseButton label="Cerrar" onClick={onClose} disabled={isSubmitting} />
          </div>
          <div className="modal-body p-4">
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-3" role="alert">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}
            <p className="text-dark mb-2">¿Seguro que querés cancelar esta visita?</p>
            <p className="text-secondary small mb-4">
              La solicitud pasará a Cancelada. No se crea ningún presupuesto ni turno.
            </p>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="light" onClick={onClose} disabled={isSubmitting}>Volver</Button>
              <Button variant="danger" onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? 'Cancelando...' : 'Cancelar visita'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
