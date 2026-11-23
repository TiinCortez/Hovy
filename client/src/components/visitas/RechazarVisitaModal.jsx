import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import VisitaService from '../../services/api/visita.service';
import { getApiError } from './visitaUtils';
import Modal from '../ui/Modal';

const MAX_MOTIVO = 500;

// Mounted by the parent only while open. onRejected receives the API response
// ({ aviso_enviado, aviso_motivo, sesion_borrada }) so the page can tell the admin.
export default function RechazarVisitaModal({ idSolicitud, onClose, onRejected }) {
  const [motivo, setMotivo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const respuesta = await VisitaService.rechazar(idSolicitud, motivo.trim());
      await onRejected(respuesta);
      onClose();
    } catch (err) {
      setErrorMessage(getApiError(err, 'No se pudo rechazar la solicitud.'));
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <Modal titulo="Rechazar solicitud" onCerrar={onClose} bloqueado={isSubmitting}>
          <div className="modal-body p-4">
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-3" role="alert">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}
            <p className="text-dark mb-2">¿Seguro que querés rechazar esta solicitud?</p>
            <p className="text-secondary small mb-3">
              Pasa a Rechazada y queda en el historial. Se borra la conversación del bot con ese número:
              si vuelve a escribir, empieza de cero. Le avisamos por WhatsApp con el motivo (solo llega si
              escribió en las últimas 24 h).
            </p>
            <label htmlFor="motivo-rechazo" className="form-label small fw-semibold text-dark">
              Motivo <span className="text-secondary fw-normal">(opcional, se le envía a la persona)</span>
            </label>
            <textarea
              id="motivo-rechazo"
              className="form-control mb-1"
              rows={3}
              maxLength={MAX_MOTIVO}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={isSubmitting}
              placeholder="Por ejemplo: la dirección está fuera de nuestra zona de trabajo."
            />
            <p className="text-secondary text-end mb-4" style={{ fontSize: 'var(--hovy-texto-xs)' }}>
              {motivo.length}/{MAX_MOTIVO}
            </p>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="light" onClick={onClose} disabled={isSubmitting}>Volver</Button>
              <Button variant="danger" onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? 'Rechazando…' : 'Rechazar solicitud'}
              </Button>
            </div>
          </div>
    </Modal>,
    document.body
  );
}
