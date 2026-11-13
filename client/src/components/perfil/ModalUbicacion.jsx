import { useId } from 'react';
import { createPortal } from 'react-dom';
import CloseButton from '../ui/CloseButton';
import useCerrarConEscape from '../ui/useCerrarConEscape';

// Dialog shell shared by the steps of choosing a departure point.
export default function ModalUbicacion({ titulo, size, cerrable = true, onClose, footer, children }) {
  useCerrarConEscape(cerrable, onClose);
  const idTitulo = useId();

  return createPortal(
    <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1060 }} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
      <div className={`modal-dialog modal-dialog-centered${size ? ` modal-${size}` : ''}`}>
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4" id={idTitulo}>{titulo}</h5>
            <CloseButton label="Cerrar" onClick={onClose} disabled={!cerrable} />
          </div>

          <div className="modal-body p-4 d-flex flex-column gap-3">{children}</div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={!cerrable}>
              Cancelar
            </button>
            {footer}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
