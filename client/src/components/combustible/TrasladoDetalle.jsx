import { Fuel } from 'lucide-react';
import { formulaTraslado } from './combustibleUtils';

// Trip cost line of a budget, with the formula that produced it.
// `traslado` is the answer of GET /combustible/traslado; `formatMonto` is the
// money formatter of the screen that renders it.
export default function TrasladoDetalle({ traslado, formatMonto, className = '' }) {
  if (!traslado) return null;

  if (!traslado.incluido) {
    return (
      <div className={`text-secondary small d-flex align-items-start gap-2 ${className}`}>
        <Fuel size={14} className="flex-shrink-0 mt-1" aria-hidden="true" />
        <span>Sin costo de traslado: {traslado.mensaje}</span>
      </div>
    );
  }

  const aproximado = traslado.km_aproximados === true;

  return (
    <div className={className}>
      <div className="d-flex justify-content-between align-items-center gap-2">
        <span className="fw-semibold text-dark d-flex align-items-center gap-2 flex-wrap">
          <Fuel size={14} aria-hidden="true" /> Traslado
          {aproximado && <span className="combustible-pill ms-0">Aproximado</span>}
        </span>
        <strong className="text-dark">{formatMonto(traslado.costo)}</strong>
      </div>
      <small className="text-secondary d-block">{formulaTraslado(traslado, formatMonto)}</small>
      {aproximado && (
        <small className="text-secondary d-block">
          Distancia estimada en línea recta con un margen por calles; no es una ruta real.
        </small>
      )}
      {traslado.desactualizado && (
        <small className="d-block" style={{ color: '#8a5b00' }}>
          El precio del combustible podría estar desactualizado.
        </small>
      )}
    </div>
  );
}
