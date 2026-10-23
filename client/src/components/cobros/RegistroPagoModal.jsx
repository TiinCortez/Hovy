import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Banknote, CircleCheck, Landmark, NotebookPen, QrCode, TriangleAlert, Wallet } from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import Aviso from '../ui/Aviso';
import { formatearMontoARS } from '../turnos/agendaTurnos';
import {
  FORMAS,
  analizarMonto,
  montosRapidos,
  requiereMonto,
  seleccionInicial,
  textoConfirmar,
  validarSeleccion,
} from './formaDePago';

const VERDE = '#1B3006';
const ICONOS = { anotar: NotebookPen, efectivo: Banknote, transferencia: Landmark, qr: QrCode };

// One modal for "how does the client pay?", used when finishing a turno and when
// charging a finished one. Shows what is owed, offers the ways to pay as cards, and
// for cash / transfer gives live feedback on the amount (settles the debt, partial
// payment, too much). It never closes by itself: the parent decides after the action.
//   modo      - 'finalizar' (the turno is about to be closed) | 'registrar'
//   formas    - ids to offer, in order (anotar | efectivo | transferencia | qr)
//   total     - value of the job; pendiente - what is still owed; pagado - already paid
//   aviso     - extra note shown above the buttons (for example, a QR that will be cancelled)
//   onConfirm - receives { forma, monto, referencia }
export default function RegistroPagoModal({
  modo = 'registrar',
  formas,
  formaInicial,
  subtitulo,
  total = null,
  pendiente = null,
  pagado = 0,
  aviso = null,
  isSaving = false,
  error = null,
  onConfirm,
  onClose,
}) {
  const idBase = useId();
  const dialogo = useRef(null);
  const finalizando = modo === 'finalizar';
  const [seleccion, setSeleccion] = useState(() => seleccionInicial(formaInicial ?? formas[0], pendiente));
  const [errorLocal, setErrorLocal] = useState(null);

  const deuda = pendiente ?? total;
  const necesitaMonto = requiereMonto(seleccion.forma);
  const esTransferencia = seleccion.forma === 'transferencia';
  const analisis = necesitaMonto ? analizarMonto(seleccion.monto, deuda) : { tipo: 'vacio' };
  const atajos = necesitaMonto ? montosRapidos(deuda) : [];

  // Escape closes (unless it is saving) and the page behind does not scroll.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogo.current?.focus();
    const alTeclear = (evento) => {
      if (evento.key === 'Escape' && !isSaving) onClose();
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener('keydown', alTeclear);
    };
  }, [isSaving, onClose]);

  const cambiar = (nueva) => {
    setSeleccion(nueva);
    setErrorLocal(null);
  };

  const elegirForma = (forma) => {
    const sugerir = requiereMonto(forma) && seleccion.monto === '' && Number(deuda) > 0;
    cambiar({ ...seleccion, forma, monto: sugerir ? String(deuda) : seleccion.monto });
  };

  const confirmar = () => {
    const problema = validarSeleccion(seleccion, deuda);
    if (problema) {
      setErrorLocal(problema);
      return;
    }
    onConfirm(seleccion);
  };

  const confirmarDeshabilitado = isSaving || (necesitaMonto && ['vacio', 'excede'].includes(analisis.tipo));
  const mensajeError = errorLocal ?? error;

  return createPortal(
    <div
      className="modal d-block bg-dark bg-opacity-50"
      style={{ zIndex: 1070, overflowY: 'auto' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${idBase}-titulo`}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 rounded-4 shadow-lg" ref={dialogo} tabIndex={-1}>
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4 align-items-start">
            <div>
              <h5 className="modal-title fw-bold text-dark fs-4 mb-1" id={`${idBase}-titulo`}>
                {finalizando ? 'Finalizar turno' : 'Cobrar el turno'}
              </h5>
              {subtitulo && <p className="text-secondary small mb-0">{subtitulo}</p>}
            </div>
            <CloseButton label="Cerrar" onClick={onClose} disabled={isSaving} />
          </div>

          <div className="modal-body p-4 d-flex flex-column gap-4">
            {deuda !== null && (
              <section className="pago-resumen" aria-label="Resumen del cobro">
                {total !== null && (
                  <div>
                    <span className="pago-resumen-etiqueta">Total del trabajo</span>
                    <span className="pago-resumen-cifra">{formatearMontoARS(total)}</span>
                  </div>
                )}
                {pagado > 0 && (
                  <div>
                    <span className="pago-resumen-etiqueta">Ya pagado</span>
                    <span className="pago-resumen-cifra">{formatearMontoARS(pagado)}</span>
                  </div>
                )}
                <div className="pago-resumen-principal">
                  <span className="pago-resumen-etiqueta">{finalizando ? 'A cobrar' : 'Pendiente de cobro'}</span>
                  <span className="pago-resumen-total">{formatearMontoARS(deuda)}</span>
                </div>
              </section>
            )}

            <div>
              <p className="fw-semibold text-dark mb-2" id={`${idBase}-pregunta`}>
                {finalizando ? '¿Desea registrar el pago?' : '¿Cómo paga el cliente?'}
              </p>
              <div className="forma-pago-grid" role="radiogroup" aria-labelledby={`${idBase}-pregunta`}>
                {formas.map((id) => {
                  const forma = FORMAS[id];
                  const Icono = ICONOS[id];
                  const elegida = seleccion.forma === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={elegida}
                      disabled={isSaving}
                      className={`forma-pago ${elegida ? 'is-selected' : ''}`}
                      onClick={() => elegirForma(id)}
                    >
                      <span className="forma-pago-icono"><Icono size={18} aria-hidden="true" /></span>
                      <strong>{forma.etiqueta}</strong>
                      <small>{forma.detalle}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            {necesitaMonto && (
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="combustible-label" htmlFor={`${idBase}-monto`}>Monto recibido</label>
                  <div className="input-group input-group-lg">
                    <span className="input-group-text fw-bold">$</span>
                    <input
                      id={`${idBase}-monto`}
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      className="form-control fw-bold"
                      value={seleccion.monto}
                      disabled={isSaving}
                      autoFocus
                      onChange={(e) => cambiar({ ...seleccion, monto: e.target.value })}
                    />
                  </div>

                  {atajos.length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {atajos.map((atajo) => (
                        <button
                          key={atajo.etiqueta}
                          type="button"
                          className="pago-chip"
                          disabled={isSaving}
                          onClick={() => cambiar({ ...seleccion, monto: String(atajo.valor) })}
                        >
                          {atajo.etiqueta} · {formatearMontoARS(atajo.valor)}
                        </button>
                      ))}
                    </div>
                  )}

                  {analisis.tipo === 'salda' && (
                    <p className="pago-estado is-salda" role="status"><CircleCheck size={16} aria-hidden="true" /> Con este pago se salda la deuda del turno.</p>
                  )}
                  {analisis.tipo === 'parcial' && (
                    <p className="pago-estado is-parcial" role="status"><Wallet size={16} aria-hidden="true" /> Pago parcial: quedarían {formatearMontoARS(analisis.restante)} pendientes.</p>
                  )}
                  {analisis.tipo === 'excede' && (
                    <p className="pago-estado is-excede" role="alert"><TriangleAlert size={16} aria-hidden="true" /> Supera en {formatearMontoARS(analisis.exceso)} lo que el cliente debe.</p>
                  )}
                </div>

                <div className="col-12 col-md-6">
                  <label className="combustible-label" htmlFor={`${idBase}-referencia`}>
                    {esTransferencia ? 'N° de operación (opcional)' : 'Nota (opcional)'}
                  </label>
                  <input
                    id={`${idBase}-referencia`}
                    type="text"
                    maxLength={100}
                    className="form-control form-control-lg"
                    value={seleccion.referencia}
                    disabled={isSaving}
                    placeholder={esTransferencia ? 'Ej: 884177' : 'Ej: pagó la señora'}
                    onChange={(e) => cambiar({ ...seleccion, referencia: e.target.value })}
                  />
                  <div className="form-text">
                    {esTransferencia ? 'Sirve para encontrar la transferencia en tu banco.' : 'Queda anotada junto al pago.'}
                  </div>
                </div>
              </div>
            )}

            <div className="pago-nota">
              {seleccion.forma === 'anotar' && (
                <p className="m-0">
                  El cliente queda debiendo {deuda !== null ? formatearMontoARS(deuda) : 'el total'} en su cuenta corriente.
                  Podés registrar el pago o generar el QR más tarde desde el turno.
                </p>
              )}
              {seleccion.forma === 'qr' && (
                <p className="m-0">
                  Se genera el QR de Mercado Pago{deuda !== null ? ` por ${formatearMontoARS(deuda)}` : ''}. El link vence a las
                  24 horas y esta pantalla te avisa cuando el cliente paga.
                </p>
              )}
              {necesitaMonto && (
                <p className="m-0">
                  Un pago registrado <strong>no se puede borrar</strong>: si te equivocás, se corrige con un movimiento nuevo en la cuenta corriente.
                </p>
              )}
              {aviso && <p className="m-0 mt-2">{aviso}</p>}
            </div>

            {mensajeError && <Aviso tipo="error" icono={AlertCircle}>{mensajeError}</Aviso>}
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <Button
              variant="primary"
              onClick={confirmar}
              disabled={confirmarDeshabilitado}
              style={{ backgroundColor: VERDE, borderColor: VERDE }}
            >
              {isSaving ? (finalizando ? 'Finalizando...' : 'Procesando...') : textoConfirmar(seleccion.forma, finalizando)}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
