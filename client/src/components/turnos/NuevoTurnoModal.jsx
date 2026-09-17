import { useMemo, useState, useEffect } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  Maximize,
  MessageCircle,
  Phone,
  Search,
  Sun,
  User,
  X
} from 'lucide-react';
import Button from '../ui/Button';

const PRIORIDADES = [
  {
    value: 'P1_REASIGNADO',
    title: 'P1 – Reasignado',
    description: 'Turno postergado o urgente',
    color: 'danger'
  },
  {
    value: 'P2_FIJO',
    title: 'P2 – Fijo',
    description: 'Cliente frecuente o abono',
    color: 'success'
  },
  {
    value: 'P3_CASUAL',
    title: 'P3 – Casual',
    description: 'Según vacante diaria',
    color: 'secondary'
  }
];

const FRANJAS_BASE = [
  { horaInicio: '08:30', horaFin: '11:00' },
  { horaInicio: '11:30', horaFin: '13:30' },
  { horaInicio: '14:00', horaFin: '16:30' },
  { horaInicio: '16:30', horaFin: '18:30' }
];

const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours * 60) + minutes;
};

const fromMinutes = (totalMinutes) => {
  const normalized = Math.min(totalMinutes, (23 * 60) + 59);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftIsoDate = (isoDate, amount) => {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
};

const formatDate = (isoDate) => {
  if (!isoDate) return 'Seleccionar fecha';
  const date = new Date(`${isoDate}T12:00:00`);
  const text = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const formatCurrency = (value) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
}).format(value);

export default function NuevoTurnoModal({
  isOpen,
  onClose,
  onTurnoCreated,
  presupuestosAprobados,
  turnosExistentes,
  datosClima,
  fechaInicial,
  horaInicioInicial
}) {
  const primerPresupuesto = presupuestosAprobados[0];
  const [idPresupuesto, setIdPresupuesto] = useState(primerPresupuesto?.idPresupuesto ?? '');
  const [prioridad, setPrioridad] = useState(primerPresupuesto?.prioridadSugerida ?? 'P2_FIJO');
  const [fecha, setFecha] = useState(fechaInicial || toIsoDate(new Date()));
  const [franjaSeleccionada, setFranjaSeleccionada] = useState(horaInicioInicial || '');
  const [error, setError] = useState('');

  const presupuestoSeleccionado = presupuestosAprobados.find(
    (presupuesto) => presupuesto.idPresupuesto === Number(idPresupuesto)
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const franjas = useMemo(() => {
    const slots = [...FRANJAS_BASE];

    if (horaInicioInicial && !slots.some((slot) => slot.horaInicio === horaInicioInicial)) {
      const duration = presupuestoSeleccionado?.duracionEstimadaMin || 120;
      slots.push({
        horaInicio: horaInicioInicial,
        horaFin: fromMinutes(toMinutes(horaInicioInicial) + duration)
      });
      slots.sort((a, b) => toMinutes(a.horaInicio) - toMinutes(b.horaInicio));
    }

    return slots.map((slot) => {
      const turnoSolapado = turnosExistentes.find((turno) => {
        if (turno.estado === 'CANCELADO' || turno.fechaAsignada !== fecha) return false;
        const existingStart = toMinutes(turno.franjaHoraria.horaInicio);
        const existingEnd = toMinutes(turno.franjaHoraria.horaFin);
        return toMinutes(slot.horaInicio) < existingEnd && toMinutes(slot.horaFin) > existingStart;
      });

      return { ...slot, turnoSolapado };
    });
  }, [fecha, horaInicioInicial, presupuestoSeleccionado, turnosExistentes]);

  if (!isOpen) return null;

  const handlePresupuestoChange = (event) => {
    const nextId = Number(event.target.value);
    const nextBudget = presupuestosAprobados.find((item) => item.idPresupuesto === nextId);
    setIdPresupuesto(nextId);
    setPrioridad(nextBudget?.prioridadSugerida ?? 'P2_FIJO');
    setFranjaSeleccionada('');
    setError('');
  };

  const handleFechaChange = (nextDate) => {
    setFecha(nextDate);
    setFranjaSeleccionada('');
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (!presupuestoSeleccionado) {
      setError('Seleccioná un presupuesto aprobado para continuar.');
      return;
    }

    if (!fecha) {
      setError('Seleccioná la fecha del servicio.');
      return;
    }

    const selectedSlot = franjas.find((slot) => slot.horaInicio === franjaSeleccionada);
    if (!selectedSlot) {
      setError('Seleccioná una franja horaria disponible.');
      return;
    }

    if (selectedSlot.turnoSolapado) {
      setError('La franja seleccionada se superpone con otro turno. Elegí otra opción.');
      return;
    }

    onTurnoCreated({
      idPresupuesto: presupuestoSeleccionado.idPresupuesto,
      fecha,
      horaInicio: selectedSlot.horaInicio,
      horaFin: selectedSlot.horaFin,
      prioridad,
      estado: 'COORDINADO'
    });
    onClose();
  };

  return (
    <div
      className="modal nuevo-turno-modal d-block bg-dark bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nuevo-turno-title"
      style={{ zIndex: 1070 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
          <div className="modal-header nuevo-turno-header align-items-start px-3 px-md-4 py-3 border-bottom">
            <div className="min-w-0">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span className="text-uppercase text-secondary fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '0.06em' }}>
                  Programación de servicio
                </span>
                <span className="badge rounded-pill nuevo-turno-status px-3 py-2 fw-semibold">
                  <span className="rounded-circle bg-warning d-inline-block me-1" style={{ width: 7, height: 7 }} />
                  Estado inicial: Coordinado
                </span>
              </div>
              <h2 id="nuevo-turno-title" className="modal-title fw-bold text-dark mb-1">Coordinar nuevo turno</h2>
              <p className="text-secondary small mb-0">Asignación de fecha y franja horaria según disponibilidad operativa.</p>
            </div>
            <button type="button" className="nuevo-turno-close btn border-0 rounded-circle p-2 flex-shrink-0" aria-label="Cerrar" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="d-flex flex-column min-h-0">
            <div className="modal-body p-3 p-md-4">
              {error && (
                <div className="alert alert-danger rounded-3 py-2 px-3 d-flex align-items-center gap-2 mb-3" role="alert">
                  <Info size={17} className="flex-shrink-0" />
                  <span className="small fw-medium">{error}</span>
                </div>
              )}

              {presupuestosAprobados.length === 0 ? (
                <div className="nuevo-turno-empty text-center p-5 rounded-4 border">
                  <CalendarDays size={36} className="text-secondary mb-3" />
                  <h5 className="fw-bold text-dark">No hay presupuestos disponibles</h5>
                  <p className="text-secondary small mb-0">Los presupuestos aprobados que ya tienen turno no vuelven a aparecer aquí.</p>
                </div>
              ) : (
                <div className="row g-4">
                  <div className="col-12 col-lg-6">
                    <label htmlFor="turno-presupuesto" className="form-label nuevo-turno-label">Presupuesto aprobado vinculado <span className="text-danger">*</span></label>
                    <div className="input-group nuevo-turno-select-group mb-3">
                      <span className="input-group-text bg-white border-end-0"><Search size={16} /></span>
                      <select
                        id="turno-presupuesto"
                        className="form-select border-start-0 shadow-none fw-semibold"
                        value={idPresupuesto}
                        onChange={handlePresupuestoChange}
                      >
                        {presupuestosAprobados.map((presupuesto) => (
                          <option key={presupuesto.idPresupuesto} value={presupuesto.idPresupuesto}>
                            {presupuesto.codigo} – {presupuesto.cliente.nombre} ({presupuesto.inmueble.direccion})
                          </option>
                        ))}
                      </select>
                    </div>

                    {presupuestoSeleccionado && (
                      <div className="nuevo-turno-budget-card border rounded-4 p-3 p-md-4">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pb-3 border-bottom">
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <span className="badge nuevo-turno-approved rounded-pill px-3 py-2"><Check size={13} /> {presupuestoSeleccionado.codigo} (Aprobado)</span>
                            <span className="badge bg-light text-secondary border rounded-pill px-2 py-2">Vigente</span>
                          </div>
                          <strong className="text-dark small">Importe: {formatCurrency(presupuestoSeleccionado.importe)}</strong>
                        </div>

                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 py-3">
                          <div className="d-flex gap-2 min-w-0">
                            <span className="nuevo-turno-icon"><User size={16} /></span>
                            <div className="min-w-0">
                              <div className="fw-bold text-dark text-break">{presupuestoSeleccionado.cliente.nombre}</div>
                              <div className="small text-secondary d-flex align-items-center gap-1 mt-1"><Phone size={13} /> {presupuestoSeleccionado.cliente.telefono}</div>
                            </div>
                          </div>
                          <div className="d-flex flex-column align-items-end gap-2">
                            <span className="badge bg-success-subtle text-success rounded-pill px-2">{presupuestoSeleccionado.cliente.tipo.toUpperCase()}</span>
                            <span className="badge bg-white text-success border border-success-subtle rounded-pill px-2 py-1"><MessageCircle size={12} /> WhatsApp</span>
                          </div>
                        </div>

                        <div className="nuevo-turno-property rounded-3 border p-3 mb-3">
                          <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                            <span className="text-secondary text-uppercase" style={{ fontSize: '0.7rem' }}>Inmueble y condición</span>
                            <span className="badge bg-white text-secondary border">{presupuestoSeleccionado.inmueble.tipo}</span>
                          </div>
                          <div className="d-flex align-items-start gap-2 fw-semibold text-dark small"><MapPin size={15} className="flex-shrink-0 mt-1" /> {presupuestoSeleccionado.inmueble.direccion}</div>
                          <div className="small text-secondary mt-1 ms-4">{presupuestoSeleccionado.inmueble.zona}</div>
                        </div>

                        <div className="nuevo-turno-surface rounded-3 p-3 mb-3 d-flex align-items-start gap-2">
                          <Maximize size={16} className="flex-shrink-0 mt-1" />
                          <span className="small">Superficie mantenible: <strong>{presupuestoSeleccionado.superficieMantenible}</strong></span>
                        </div>

                        <div>
                          <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem' }}>Labor presupuestada</div>
                          <div className="fw-bold text-dark small">{presupuestoSeleccionado.servicio.descripcion}</div>
                          <div className="small text-secondary mt-1">{presupuestoSeleccionado.servicio.detalle}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-lg-6">
                    <fieldset className="mb-4">
                      <legend className="nuevo-turno-label mb-2">Prioridad operativa <span className="text-danger">*</span></legend>
                      <div className="row g-2">
                        {PRIORIDADES.map((item) => {
                          const isSelected = prioridad === item.value;
                          return (
                            <div className="col-12 col-sm-4" key={item.value}>
                              <button
                                type="button"
                                className={`nuevo-turno-priority w-100 h-100 text-start rounded-3 p-3 ${isSelected ? 'is-selected' : ''}`}
                                aria-pressed={isSelected}
                                onClick={() => { setPrioridad(item.value); setError(''); }}
                              >
                                <span className="d-flex align-items-center gap-2 fw-bold text-dark small">
                                  <span className={`rounded-circle bg-${item.color}`} style={{ width: 8, height: 8 }} />
                                  {item.title}
                                </span>
                                <span className="d-block text-secondary mt-1" style={{ fontSize: '0.7rem' }}>{item.description}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="nuevo-turno-rule d-flex align-items-start gap-2 rounded-3 p-3 mt-2">
                        <Info size={15} className="flex-shrink-0 mt-1" />
                        <span className="small"><strong>Regla operativa:</strong> la prioridad sugerida surge del tipo de cliente y puede ajustarse antes de coordinar.</span>
                      </div>
                    </fieldset>

                    <div className="mb-4">
                      <label htmlFor="turno-fecha" className="form-label nuevo-turno-label">Fecha de servicio <span className="text-danger">*</span></label>
                      <div className="nuevo-turno-date d-flex align-items-stretch rounded-3 overflow-hidden border">
                        <button type="button" className="btn btn-light rounded-0 border-0 border-end px-3" aria-label="Día anterior" onClick={() => handleFechaChange(shiftIsoDate(fecha, -1))}><ChevronLeft size={16} /></button>
                        <label htmlFor="turno-fecha" className="flex-grow-1 d-flex align-items-center justify-content-center gap-2 px-2 text-center fw-semibold small">
                          <CalendarDays size={15} className="flex-shrink-0" />
                          <span>{formatDate(fecha)}</span>
                        </label>
                        <input id="turno-fecha" type="date" value={fecha} onChange={(event) => handleFechaChange(event.target.value)} className="nuevo-turno-date-input" />
                        <button type="button" className="btn btn-light rounded-0 border-0 border-start px-3" aria-label="Día siguiente" onClick={() => handleFechaChange(shiftIsoDate(fecha, 1))}><ChevronRight size={16} /></button>
                      </div>
                    </div>

                    <fieldset className="mb-4">
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                        <legend className="nuevo-turno-label mb-0">Franjas horarias disponibles <span className="text-danger">*</span></legend>
                        <span className="text-secondary text-nowrap" style={{ fontSize: '0.7rem' }}>Sin solapamientos</span>
                      </div>
                      <div className="row g-2">
                        {franjas.map((slot) => {
                          const isOccupied = Boolean(slot.turnoSolapado);
                          const isSelected = franjaSeleccionada === slot.horaInicio;
                          const duration = toMinutes(slot.horaFin) - toMinutes(slot.horaInicio);
                          return (
                            <div className="col-12 col-sm-6" key={`${slot.horaInicio}-${slot.horaFin}`}>
                              <button
                                type="button"
                                disabled={isOccupied}
                                aria-pressed={isSelected}
                                onClick={() => { setFranjaSeleccionada(slot.horaInicio); setError(''); }}
                                className={`nuevo-turno-slot w-100 rounded-3 p-3 text-start ${isSelected ? 'is-selected' : ''} ${isOccupied ? 'is-occupied' : ''}`}
                              >
                                <span className="d-flex justify-content-between align-items-center gap-2 fw-bold small">
                                  <span>{slot.horaInicio} – {slot.horaFin} hs</span>
                                  <span className={`rounded-circle ${isOccupied ? 'bg-danger' : 'bg-success'}`} style={{ width: 8, height: 8 }} />
                                </span>
                                <span className={`d-flex justify-content-between gap-2 mt-2 ${isOccupied ? 'text-danger' : 'text-secondary'}`} style={{ fontSize: '0.72rem' }}>
                                  <span>{isOccupied ? `Ocupado (${slot.turnoSolapado.cliente.nombre})` : 'Disponible'}</span>
                                  <span>{isOccupied ? 'No disp.' : `${Math.floor(duration / 60)}h ${String(duration % 60).padStart(2, '0')}m`}</span>
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>

                    {datosClima && (
                      <div className="nuevo-turno-weather border rounded-4 p-3">
                        <div className="d-flex align-items-start gap-2 pb-2 mb-2 border-bottom">
                          <Sun size={19} className="text-warning flex-shrink-0" />
                          <span className="small"><strong>Pronóstico:</strong> {datosClima.pronostico}</span>
                        </div>
                        <div className="d-flex align-items-start gap-2">
                          <Clock size={18} className="text-secondary flex-shrink-0" />
                          <span className="small"><strong>Anochecer:</strong> {datosClima.horaAnochecer} hs. Verificá que la franja finalice con luz suficiente.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer nuevo-turno-footer border-top px-3 px-md-4 py-3 d-flex justify-content-between gap-2 flex-nowrap">
              <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose}>Cancelar</button>
              <Button type="submit" variant="primary" disabled={presupuestosAprobados.length === 0} className="nuevo-turno-submit">
                <Check size={17} /> Guardar turno coordinado
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
