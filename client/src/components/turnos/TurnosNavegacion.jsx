import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cambiarMesTurnos, fechaDesdeIso, inicioSemanaTurnos, sumarDiasTurnos } from './agendaTurnos';

export default function TurnosNavegacion({ vista, fecha, hoy, onFechaChange }) {
  const esSemana = vista === 'semanal';
  const inicio = inicioSemanaTurnos(fecha);
  const formatoDia = { day: 'numeric', month: 'short', year: 'numeric' };
  const etiqueta = esSemana
    ? `${fechaDesdeIso(inicio).toLocaleDateString('es-AR', formatoDia)} – ${fechaDesdeIso(sumarDiasTurnos(inicio, 6)).toLocaleDateString('es-AR', formatoDia)}`
    : fechaDesdeIso(fecha).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const navegar = (cantidad) => onFechaChange(esSemana ? sumarDiasTurnos(fecha, cantidad * 7) : cambiarMesTurnos(fecha, cantidad));

  return (
    <nav className="turnos-periodo bg-white border rounded-4 p-2 shadow-sm" aria-label={esSemana ? 'Navegación semanal' : 'Navegación mensual'}>
      <div className="turnos-periodo-controls">
        <button type="button" className="btn btn-light turnos-nav-arrow" onClick={() => navegar(-1)} aria-label={esSemana ? 'Semana anterior' : 'Mes anterior'}><ChevronLeft size={20} /></button>
        <span className="turnos-periodo-title fw-bold text-dark text-center text-capitalize" aria-live="polite">{etiqueta}</span>
        <button type="button" className="btn btn-light turnos-nav-arrow" onClick={() => navegar(1)} aria-label={esSemana ? 'Semana siguiente' : 'Mes siguiente'}><ChevronRight size={20} /></button>
      </div>
      <div className="turnos-periodo-picker">
        <button type="button" className="btn btn-outline-dark rounded-pill px-3" onClick={() => onFechaChange(hoy)}>Hoy</button>
        <label className="turnos-periodo-input small text-secondary">
          <span>{esSemana ? 'Ir a fecha' : 'Ir a mes'}</span>
          <input
            className="form-control form-control-sm"
            type={esSemana ? 'date' : 'month'}
            value={esSemana ? fecha : fecha.slice(0, 7)}
            onChange={(event) => { if (event.target.value) onFechaChange(esSemana ? event.target.value : `${event.target.value}-01`); }}
          />
        </label>
      </div>
    </nav>
  );
}
