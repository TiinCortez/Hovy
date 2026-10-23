import { useId } from 'react';
import { FORMAS, requiereMonto } from './formaDePago';
import { formatearMontoARS } from '../turnos/agendaTurnos';

// "How does the client pay?" selector, shared by the finish-turno dialog and the
// payment panel. It is controlled: `value` is { forma, monto, referencia } and the
// parent owns the confirm button and the validation.
//   formas    - ids to offer, in order (anotar | efectivo | transferencia | qr)
//   pendiente - what the client owes (null when unknown): suggested amount and cap
export default function ElegirFormaDePago({ formas, value, onChange, pendiente = null, disabled = false }) {
  const idBase = useId();
  const necesitaMonto = requiereMonto(value.forma);
  const esTransferencia = value.forma === 'transferencia';

  const elegir = (forma) => {
    const sugerir = requiereMonto(forma) && value.monto === '' && Number(pendiente) > 0;
    onChange({ ...value, forma, monto: sugerir ? String(pendiente) : value.monto });
  };

  const monto = Number(String(value.monto).replace(',', '.'));
  const quedaria = pendiente !== null && Number.isFinite(monto) && monto > 0 && monto < Number(pendiente)
    ? Math.round((Number(pendiente) - monto) * 100) / 100
    : null;

  return (
    <div>
      <div className="forma-pago-grid" role="radiogroup" aria-label="Forma de pago">
        {formas.map((id) => {
          const forma = FORMAS[id];
          const elegida = value.forma === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={elegida}
              disabled={disabled}
              className={`forma-pago ${elegida ? 'is-selected' : ''}`}
              onClick={() => elegir(id)}
            >
              <strong>{forma.etiqueta}</strong>
              <small>{forma.detalle}</small>
            </button>
          );
        })}
      </div>

      {necesitaMonto && (
        <div className="row g-2 mt-1">
          <div className="col-12 col-sm-5">
            <label className="combustible-label" htmlFor={`${idBase}-monto`}>Monto recibido</label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <input
                id={`${idBase}-monto`}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                max={pendiente ?? undefined}
                className="form-control"
                value={value.monto}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, monto: e.target.value })}
              />
            </div>
            {pendiente !== null && (
              <div className="form-text">
                Debe {formatearMontoARS(pendiente)}.{quedaria !== null && ` Quedaría pendiente ${formatearMontoARS(quedaria)}.`}
              </div>
            )}
          </div>
          <div className="col-12 col-sm-7">
            <label className="combustible-label" htmlFor={`${idBase}-referencia`}>
              {esTransferencia ? 'N° de operación (opcional)' : 'Nota (opcional)'}
            </label>
            <input
              id={`${idBase}-referencia`}
              type="text"
              maxLength={100}
              className="form-control"
              value={value.referencia}
              disabled={disabled}
              placeholder={esTransferencia ? 'Ej: 884177' : 'Ej: pagó la señora'}
              onChange={(e) => onChange({ ...value, referencia: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
