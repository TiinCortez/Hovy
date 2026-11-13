import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import MercadoPagoService from '../../services/api/mercadopago.service';
import Modal from '../ui/Modal';

export default function DesvincularMercadoPagoModal({ isOpen, onClose, onUnlinked }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await MercadoPagoService.desvincular();
      await onUnlinked();
      onClose();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'No se pudo desvincular la cuenta de Mercado Pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <Modal titulo="Desvincular Mercado Pago" onCerrar={onClose} bloqueado={isSubmitting}>

          <div className="modal-body p-4">
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-3" role="alert">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}
            <p className="mb-2">¿Seguro que querés desvincular tu cuenta de Mercado Pago?</p>
            <p className="mb-0 small text-secondary">
              Solo se elimina el vínculo en Hovy: no podrás cobrar con QR hasta volver a vincularla,
              y podés hacerlo cuando quieras.
            </p>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <Button variant="danger" onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Desvinculando…' : 'Desvincular'}
            </Button>
          </div>
    </Modal>,
    document.body
  );
}
