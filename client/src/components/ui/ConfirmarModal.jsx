import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Aviso from './Aviso';
import { CAPAS } from '../../styles/capas';

// Confirmación de una acción que no se puede deshacer, en lugar de window.confirm.
// Se abre encima del modal desde el que se pidió (capa modalEncima).
export default function ConfirmarModal({
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Volver',
  peligro = true,
  procesando = false,
  error,
  onConfirmar,
  onCancelar,
}) {
  return createPortal(
    <Modal titulo={titulo} onCerrar={onCancelar} bloqueado={procesando} zIndex={CAPAS.modalEncima}>
      <div className="modal-body p-4 d-flex flex-column gap-3">
        <p className="m-0 text-dark">{mensaje}</p>
        {error && <Aviso tipo="error" icono={AlertCircle}>{error}</Aviso>}
      </div>
      <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
        <Button variant="light" onClick={onCancelar} disabled={procesando}>{textoCancelar}</Button>
        <Button variant={peligro ? 'danger' : 'primary'} onClick={onConfirmar} disabled={procesando}>
          {procesando ? 'Procesando…' : textoConfirmar}
        </Button>
      </div>
    </Modal>,
    document.body
  );
}
