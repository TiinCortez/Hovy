import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import Aviso from '../ui/Aviso';
import ElegirFormaDePago from './ElegirFormaDePago';
import { formatearMontoARS } from '../turnos/agendaTurnos';
import { requiereMonto, seleccionInicial, textoConfirmar, validarSeleccion } from './formaDePago';

const VERDE = '#1B3006';
const FORMAS_AL_FINALIZAR = ['anotar', 'efectivo', 'transferencia', 'qr'];

// Shown when a turno is finished: asks how the client pays before closing it.
// `onConfirm` receives { forma, monto, referencia }; the payment itself is carried
// out after the turno is Realizado (that is when the debt exists), by the payment
// panel. Mounted only while open, so it starts fresh every time.
export default function FinalizarTurnoModal({ total, isSaving, onConfirm, onClose }) {
  const [seleccion, setSeleccion] = useState(() => seleccionInicial('anotar', total));
  const [error, setError] = useState(null);

  const pendiente = Number.isFinite(Number(total)) && Number(total) > 0 ? Number(total) : null;

  const cambiar = (nueva) => {
    setSeleccion(nueva);
    setError(null);
  };

  const confirmar = () => {
    const problema = validarSeleccion(seleccion, pendiente);
    if (problema) {
      setError(problema);
      return;
    }
    onConfirm(seleccion);
  };

  return createPortal(
    <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1070, overflowY: 'auto' }} role="dialog" aria-modal="true" aria-labelledby="finalizar-turno-titulo">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4" id="finalizar-turno-titulo">Finalizar turno</h5>
            <CloseButton label="Cerrar" onClick={onClose} disabled={isSaving} />
          </div>

          <div className="modal-body p-4 d-flex flex-column gap-3">
            <div>
              <p className="fw-semibold text-dark mb-1">¿Desea registrar el pago?</p>
              <p className="small text-secondary mb-0">
                {pendiente !== null
                  ? `Total del trabajo: ${formatearMontoARS(pendiente)}. `
                  : ''}
                Elegí cómo paga el cliente, o anotalo para cobrarlo después.
              </p>
            </div>

            {error && <Aviso tipo="error" icono={AlertCircle}>{error}</Aviso>}

            <ElegirFormaDePago
              formas={FORMAS_AL_FINALIZAR}
              value={seleccion}
              onChange={cambiar}
              pendiente={pendiente}
              disabled={isSaving}
            />

            {requiereMonto(seleccion.forma) && (
              <p className="small text-secondary mb-0">
                Un pago registrado no se puede borrar: si te equivocás, se corrige con un movimiento nuevo en la cuenta corriente.
              </p>
            )}
            {seleccion.forma === 'qr' && (
              <p className="small text-secondary mb-0">
                Al finalizar se genera el QR de Mercado Pago por lo que el cliente debe.
              </p>
            )}
            {seleccion.forma === 'anotar' && (
              <p className="small text-secondary mb-0">
                El cliente queda debiendo en su cuenta corriente. Podés registrar el pago o generar el QR más tarde desde el turno.
              </p>
            )}
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <Button
              variant="primary"
              onClick={confirmar}
              disabled={isSaving}
              style={{ backgroundColor: VERDE, borderColor: VERDE }}
            >
              {isSaving ? 'Finalizando...' : textoConfirmar(seleccion.forma, true)}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
