import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import VisitaService from '../../services/api/visita.service';
import { getApiError } from './visitaUtils';
import Modal from '../ui/Modal';

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
    <Modal titulo="Cancelar visita" onCerrar={onClose} bloqueado={isSubmitting}>
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
    </Modal>,
    document.body
  );
}
