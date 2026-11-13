import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import NotificacionService from '../../services/api/notificacion.service';
import useCerrarConEscape from '../ui/useCerrarConEscape';
import useFocoModal from '../ui/useFocoModal';

export default function CancelarNotificacionModal({ isOpen, onClose, notificacion, onCancelled }) {
  const refModal = useRef(null);
  useFocoModal(isOpen, refModal);
  useCerrarConEscape(isOpen, onClose);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen || !notificacion) return null;

  const handleClose = () => {
    setErrorMessage(null);
    onClose();
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await NotificacionService.cancelar(notificacion.id_notificacion);
      await onCancelled();
      onClose();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Ocurrió un error al eliminar la notificación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div ref={refModal} className="modal d-block bg-dark bg-opacity-50" role="dialog" aria-modal="true" style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4">Eliminar notificación</h5>
            <CloseButton label="Cerrar" onClick={handleClose} disabled={isSubmitting} />
          </div>

          <div className="modal-body p-4">
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-3" role="alert">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}
            <p className="mb-2">¿Seguro que querés eliminar esta notificación?</p>
            <p className="small text-secondary fst-italic mb-3">{notificacion.mensaje}</p>
            <p className="small text-secondary mb-0">
              Va a pasar al historial como <strong>Cancelada</strong> durante 60 días. Desde ahí la podés restaurar.
            </p>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <Button variant="danger" onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
