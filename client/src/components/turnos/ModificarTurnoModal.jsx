import { useMemo, useState, useEffect } from 'react';
import { Check, Info, MapPin, User } from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import TurnoService from '../../services/api/turno.service';
import TurnoFechaSelector from './TurnoFechaSelector';
import useRelojTurnos from './useRelojTurnos';
import { horarioPasadoTurnos, obtenerAhoraTurnos, PRIORIDADES, obtenerFranjasTurnos } from './agendaTurnos';

export default function ModificarTurnoModal({ isOpen, onClose, turnoData, onTurnoUpdated, turnosExistentes = [] }) {
  const ahora = useRelojTurnos();
  const [prioridad, setPrioridad] = useState(turnoData?.prioridad || 'P2_FIJO');
  const [fecha, setFecha] = useState(() => turnoData?.fechaAsignada >= ahora.fecha ? turnoData.fechaAsignada : ahora.fecha);
  const [franjaSeleccionada, setFranjaSeleccionada] = useState(() => turnoData?.fechaAsignada >= ahora.fecha ? turnoData.franjaHoraria?.horaInicio || '' : '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Se monta al abrir para iniciar los campos con el turno seleccionado.
  useEffect(() => {
    if (!isOpen) return undefined;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const cerrarConEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [isOpen, onClose]);

  const cambiarFecha = (nuevaFecha) => {
    if (!nuevaFecha || nuevaFecha < obtenerAhoraTurnos().fecha) {
      setError('La fecha del turno no puede ser anterior a hoy.');
      return;
    }
    setFecha(nuevaFecha);
    setFranjaSeleccionada('');
    setError('');
  };

  const franjas = useMemo(() => obtenerFranjasTurnos({ fecha, turnos: turnosExistentes, turnoActual: turnoData }), [fecha, turnosExistentes, turnoData]);

  const fechaInvalida = !fecha || fecha < ahora.fecha;
  const franjaActiva = franjas.find((slot) => slot.horaInicio === franjaSeleccionada);
  const horarioInvalido = !franjaActiva || horarioPasadoTurnos(fecha, franjaActiva.horaInicio, ahora);

  if (!isOpen || !turnoData) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!fecha || fecha < obtenerAhoraTurnos().fecha) {
      setError('La fecha del turno no puede ser anterior a hoy.');
      return;
    }

    const selectedSlot = franjas.find((slot) => slot.horaInicio === franjaSeleccionada);
    if (!selectedSlot) {
      setError('Seleccioná una franja horaria disponible.');
      return;
    }

    if (horarioPasadoTurnos(fecha, selectedSlot.horaInicio)) {
      setError('La fecha o el horario seleccionado ya pasó. Elegí una franja futura.');
      return;
    }

    if (selectedSlot.turnoSolapado) {
      setError('La franja seleccionada se superpone con otro turno.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Mantenemos el estado actual del turno
      const payload = {
        fecha_programada: fecha,
        inicio_desde: selectedSlot.horaInicio,
        hasta: selectedSlot.horaFin,
        prioridad: prioridad,
        estado: turnoData.estado 
      };

      const response = await TurnoService.update(turnoData.idTurno, payload);
      onTurnoUpdated(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Ocurrió un error al modificar el turno.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cliente = turnoData.cliente || {};
  const inmueble = turnoData.inmueble || {};

  return (
    <div className="modal modificar-turno-modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1080 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
          <div className="modal-header align-items-start px-3 px-md-4 py-3 border-bottom">
            <div className="min-w-0">
              <span className="text-uppercase text-secondary fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '0.06em' }}>
                Reasignación de Servicio
              </span>
              <h2 className="modal-title fw-bold text-dark mb-1">Modificar Turno #{turnoData.idTurno}</h2>
            </div>
            <CloseButton label="Cerrar modificación de turno" onClick={onClose} />
          </div>

          <form onSubmit={handleSubmit} className="d-flex flex-column min-h-0">
            <div className="modal-body p-3 p-md-4">
              {error && (
                <div className="alert alert-danger rounded-3 py-2 px-3 d-flex align-items-center gap-2 mb-3">
                  <Info size={17} className="flex-shrink-0" />
                  <span className="small fw-medium">{error}</span>
                </div>
              )}

              <div className="row g-4">
                {/* Datos de solo lectura */}
                <div className="col-12 col-lg-5">
                  <div className="border rounded-4 p-3 p-md-4 bg-light h-100">
                    <h6 className="text-secondary fw-bold small text-uppercase mb-3">Datos Actuales (No Editables)</h6>
                    
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span className="bg-white p-2 rounded-circle border shadow-sm"><User size={16} className="text-secondary"/></span>
                      <div className="min-w-0 text-break">
                        <div className="fw-bold text-dark">{cliente.nombre} {cliente.apellido}</div>
                        <div className="small text-secondary">{cliente.telefono}</div>
                      </div>
                    </div>

                    <div className="d-flex align-items-start gap-2 mb-3">
                      <span className="bg-white p-2 rounded-circle border shadow-sm"><MapPin size={16} className="text-secondary"/></span>
                      <div className="min-w-0 text-break">
                        <div className="fw-bold text-dark">{inmueble.direccion}</div>
                        <div className="small text-secondary">{inmueble.barrio || inmueble.provincia}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controles de edición */}
                <div className="col-12 col-lg-7">
                  <fieldset className="mb-4">
                    <legend className="form-label mb-2 fw-semibold small text-secondary">Prioridad operativa</legend>
                    <div className="row g-2">
                      {PRIORIDADES.map((item) => (
                        <div className="col-12 col-sm-4" key={item.value}>
                          <button
                            type="button"
                            className={`w-100 h-100 text-start rounded-3 p-3 border ${prioridad === item.value ? 'border-dark bg-dark text-white' : 'border-light-subtle bg-white text-dark'}`}
                            onClick={() => { setPrioridad(item.value); setError(''); }}
                          >
                            <span className="d-flex align-items-center gap-2 fw-bold small">
                              <span className={`rounded-circle bg-${item.color}`} style={{ width: 8, height: 8 }} />
                              {item.title}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  <div className="mb-4">
                    <label className="form-label mb-2 fw-semibold small text-secondary">Nueva Fecha</label>
                    <TurnoFechaSelector fecha={fecha} minFecha={ahora.fecha} onChange={cambiarFecha} etiqueta="Nueva fecha del turno" />
                  </div>

                  <fieldset className="mb-2">
                    <legend className="form-label mb-2 fw-semibold small text-secondary">Franjas horarias disponibles</legend>
                    <div className="row g-2">
                      {franjas.map((slot) => {
                        const isOccupied = Boolean(slot.turnoSolapado);
                        const isPast = horarioPasadoTurnos(fecha, slot.horaInicio, ahora);
                        const isSelected = !isPast && !fechaInvalida && franjaSeleccionada === slot.horaInicio;
                        return (
                          <div className="col-12 col-sm-6" key={slot.horaInicio}>
                            <button
                              type="button"
                              disabled={isOccupied || isPast || fechaInvalida}
                              onClick={() => { setFranjaSeleccionada(slot.horaInicio); setError(''); }}
                              className={`w-100 rounded-3 p-3 text-start border ${isPast ? 'border-light-subtle bg-light text-secondary opacity-75' : isSelected ? 'border-primary bg-primary text-white' : isOccupied ? 'border-danger-subtle bg-danger-subtle text-danger opacity-75' : 'border-light-subtle bg-white text-dark'}`}
                            >
                              <span className="d-flex justify-content-between align-items-center fw-bold small">
                                <span>{slot.horaInicio} – {slot.horaFin} hs</span>
                                <span className={`rounded-circle flex-shrink-0 ${isPast ? 'bg-secondary' : isOccupied ? 'bg-danger' : isSelected ? 'bg-white' : 'bg-success'}`} style={{ width: 8, height: 8 }} />
                              </span>
                              <span className={`d-block small mt-2 ${isSelected ? 'text-light' : 'text-secondary'}`}>{isPast ? 'Horario pasado' : isOccupied ? 'Ocupado' : 'Disponible'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              </div>
            </div>

            <div className="turnos-modificar-footer modal-footer border-top px-3 px-md-4 py-3 d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={isSubmitting}>Cancelar</button>
              <Button type="submit" variant="primary" disabled={fechaInvalida || horarioInvalido || Boolean(franjaActiva?.turnoSolapado) || isSubmitting}>
                <Check size={17} /> {isSubmitting ? 'Guardando...' : 'Guardar Modificación'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
