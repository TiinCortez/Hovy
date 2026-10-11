import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import Button from './Button';
import CloseButton from './CloseButton';
import ServicioService from '../../services/api/servicio.service';

export default function ServicioEliminarModal({ isOpen, onClose, servicio, onDeleted }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen || !servicio) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await ServicioService.remove(servicio.id_usuario_servicio);
      await onDeleted();
      onClose();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Ocurrió un error al eliminar el servicio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4">Eliminar Servicio</h5>
            <CloseButton label="Cerrar" onClick={onClose} disabled={isSubmitting} />
          </div>

          <div className="modal-body p-4">
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-3" role="alert">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}
            <p className="mb-0">
              ¿Seguro que querés eliminar <strong>{servicio.servicio?.nombre}</strong> de tu catálogo?
            </p>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={isSubmitting}>
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
