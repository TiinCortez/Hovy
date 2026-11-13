import { createPortal } from 'react-dom';
import Modal from '../ui/Modal';

// Dialog shell shared by the steps of choosing a departure point.
export default function ModalUbicacion({ titulo, size, cerrable = true, onClose, footer, children }) {
  return createPortal(
    <Modal titulo={titulo} onCerrar={onClose} bloqueado={!cerrable} tamano={size}>
      <div className="modal-body p-4 d-flex flex-column gap-3">{children}</div>

      <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
        <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={!cerrable}>
          Cancelar
        </button>
        {footer}
      </div>
    </Modal>,
    document.body
  );
}
