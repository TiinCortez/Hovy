import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';

const MODOS = [
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' },
  { value: 'rango', label: 'Rango' },
];

// Selector único de período: un mes, un año completo o un rango libre de meses.
// Los cambios se aplican al momento; el desplegable se cierra con click afuera o Escape.
export default function PeriodoSelector({ periodo, etiqueta, anios, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const handleClickOutside = (event) => {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target)) setAbierto(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [abierto]);

  // input[type=month] devuelve '' mientras el valor está incompleto: se ignora.
  const cambiar = (campo, valor) => {
    if (!valor) return;
    onChange({ ...periodo, [campo]: valor });
  };

  return (
    <div className="metricas-periodo position-relative" ref={contenedorRef}>
      <button
        type="button"
        className="metricas-periodo-boton"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => setAbierto((actual) => !actual)}
      >
        <CalendarDays size={16} className="flex-shrink-0" aria-hidden="true" />
        <span className="text-truncate">{etiqueta}</span>
        <ChevronDown size={16} className="flex-shrink-0" aria-hidden="true" />
      </button>

      {abierto && (
        <div className="metricas-periodo-panel" role="dialog" aria-label="Seleccionar período">
          <div className="metricas-periodo-modos" role="radiogroup" aria-label="Tipo de período">
            {MODOS.map((modo) => (
              <button
                key={modo.value}
                type="button"
                role="radio"
                aria-checked={periodo.modo === modo.value}
                className={`btn btn-sm rounded-pill fw-semibold flex-grow-1 ${periodo.modo === modo.value ? 'btn-primary' : 'btn-light'}`}
                onClick={() => onChange({ ...periodo, modo: modo.value })}
              >
                {modo.label}
              </button>
            ))}
          </div>

          {periodo.modo === 'mes' && (
            <label className="metricas-periodo-campo">
              <span>Mes</span>
              <input
                type="month"
                className="form-control form-control-sm"
                value={periodo.mes}
                onChange={(e) => cambiar('mes', e.target.value)}
              />
            </label>
          )}

          {periodo.modo === 'anio' && (
            <label className="metricas-periodo-campo">
              <span>Año</span>
              <select
                className="form-select form-select-sm"
                value={periodo.anio}
                onChange={(e) => cambiar('anio', e.target.value)}
              >
                {anios.map((anio) => <option key={anio} value={anio}>{anio}</option>)}
              </select>
            </label>
          )}

          {periodo.modo === 'rango' && (
            <div className="d-flex flex-column gap-2">
              <label className="metricas-periodo-campo">
                <span>Desde</span>
                <input
                  type="month"
                  className="form-control form-control-sm"
                  value={periodo.desde}
                  onChange={(e) => cambiar('desde', e.target.value)}
                />
              </label>
              <label className="metricas-periodo-campo">
                <span>Hasta</span>
                <input
                  type="month"
                  className="form-control form-control-sm"
                  value={periodo.hasta}
                  onChange={(e) => cambiar('hasta', e.target.value)}
                />
              </label>
              {periodo.desde > periodo.hasta && (
                <p className="text-secondary small m-0">Las fechas están invertidas: se toma el rango en orden.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}