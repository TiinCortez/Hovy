import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { fechaDesdeIso, sumarDiasTurnos } from './agendaTurnos';

export default function TurnoFechaSelector({ fecha, minFecha, onChange, etiqueta }) {
  const abrirCalendario = (event) => {
    const input = event.currentTarget;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // En WebViews sin soporte se conserva el selector nativo del input.
        input.focus();
      }
    }
  };

  return (
    <div className="turnos-fecha-selector d-flex align-items-stretch rounded-3 border">
      <button
        type="button"
        aria-label="Día anterior"
        disabled={!fecha || fecha <= minFecha}
        className="btn btn-light btn-icon"
        onClick={() => onChange(sumarDiasTurnos(fecha, -1))}
      ><ChevronLeft size={18} /></button>
      <label className="turnos-fecha-control d-flex align-items-center justify-content-center gap-2 px-2 text-center fw-semibold small bg-white">
        <CalendarDays size={16} className="flex-shrink-0 text-secondary" aria-hidden="true" />
        <span>{fecha ? fechaDesdeIso(fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Seleccionar fecha'}</span>
        <input
          type="date"
          aria-label={etiqueta}
          min={minFecha}
          required
          value={fecha}
          onChange={(event) => onChange(event.target.value)}
          onClick={abrirCalendario}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); abrirCalendario(event); } }}
        />
      </label>
      <button
        type="button"
        aria-label="Día siguiente"
        className="btn btn-light btn-icon"
        onClick={() => onChange(fecha && fecha >= minFecha ? sumarDiasTurnos(fecha, 1) : minFecha)}
      ><ChevronRight size={18} /></button>
    </div>
  );
}
