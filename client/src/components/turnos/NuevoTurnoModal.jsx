import { useMemo, useState, useEffect } from 'react';
import {
  Check, Clock,
  Info, MapPin, Maximize, MessageCircle, Phone, Search, Sun, User, Home
} from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import { obtenerEnlaceWhatsApp } from '../../services/whatsapp';
import TurnoService from '../../services/api/turno.service';
import ClienteService from '../../services/api/cliente.service';
import InmuebleService from '../../services/api/inmueble.service';
import useRelojTurnos from './useRelojTurnos';
import TurnoFechaSelector from './TurnoFechaSelector';
import { horarioPasadoTurnos, obtenerAhoraTurnos, PRIORIDADES, horaAMinutos, obtenerFranjasTurnos } from './agendaTurnos';

const normalizarBusqueda = (valor) => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function NuevoTurnoModal({
  isOpen, onClose, onTurnoCreated, turnosExistentes = [], datosClima, fechaInicial, horaInicioInicial
}) {
  const ahora = useRelojTurnos();
  const [clientes, setClientes] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);

  const [idCliente, setIdCliente] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [idInmueble, setIdInmueble] = useState('');

  const [prioridad, setPrioridad] = useState('P2_FIJO');
  const [fecha, setFecha] = useState(() => fechaInicial && fechaInicial >= ahora.fecha ? fechaInicial : ahora.fecha);
  const [franjaSeleccionada, setFranjaSeleccionada] = useState(horaInicioInicial || '');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Cargar clientes al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const fetchClientes = async () => {
        setIsLoadingData(true);
        try {
          const res = await ClienteService.getAll();
          setClientes(res.data || []);
        } catch {
          setError('Error al cargar la lista de clientes.');
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchClientes();

    }
  }, [isOpen, fechaInicial, horaInicioInicial]);

  // Cargar inmuebles al seleccionar un cliente
  useEffect(() => {
    let vigente = true;
    if (idCliente) {
      const fetchInmuebles = async () => {
        try {
          const res = await InmuebleService.getByCliente(idCliente);
          if (!vigente) return;
          setInmuebles(res.data || []);
          setIdInmueble(''); // Resetear inmueble seleccionado
        } catch {
          if (vigente) setError('Error al cargar los inmuebles del cliente.');
        }
      };
      fetchInmuebles();
    }
    return () => { vigente = false; };
  }, [idCliente]);

  // Bloquear scroll de fondo
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const clienteSeleccionado = clientes.find(c => String(c.id_cliente) === String(idCliente));
  const enlaceWhatsApp = obtenerEnlaceWhatsApp(clienteSeleccionado?.telefono);
  const clientesFiltrados = useMemo(() => {
    const palabras = normalizarBusqueda(busquedaCliente).split(/\s+/).filter(Boolean);
    return clientes.filter((cliente) => {
      const datos = normalizarBusqueda(`#${cliente.id_cliente} ${cliente.nombre || ''} ${cliente.apellido || ''} ${cliente.telefono || ''} ${String(cliente.telefono || '').replace(/\D/g, '')}`);
      return palabras.every((palabra) => datos.includes(palabra));
    });
  }, [clientes, busquedaCliente]);
  const seleccionadoFueraDelFiltro = clienteSeleccionado && !clientesFiltrados.some((cliente) => String(cliente.id_cliente) === String(idCliente));
  const inmuebleSeleccionado = inmuebles.find(i => String(i.id_inmueble) === String(idInmueble));

  const franjas = useMemo(() => obtenerFranjasTurnos({ fecha, turnos: turnosExistentes, horaInicioInicial }), [fecha, horaInicioInicial, turnosExistentes]);

  const franjaActiva = franjas.find((slot) => slot.horaInicio === franjaSeleccionada);
  const puedeGuardar = franjaActiva && !franjaActiva.turnoSolapado && !horarioPasadoTurnos(fecha, franjaActiva.horaInicio, ahora);

  const cambiarFecha = (nuevaFecha) => {
    if (!nuevaFecha || nuevaFecha < obtenerAhoraTurnos().fecha) {
      setError('La fecha del turno no puede ser anterior a hoy.');
      return;
    }
    setFecha(nuevaFecha);
    setFranjaSeleccionada('');
    setError('');
  };

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!idCliente || !idInmueble) {
      setError('Debes seleccionar un cliente y un inmueble para agendar el turno.');
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

    if (horarioPasadoTurnos(fecha, selectedSlot.horaInicio)) {
      setError('La fecha o el horario seleccionado ya pasó. Elegí una franja futura.');
      return;
    }

    if (selectedSlot.turnoSolapado) {
      setError('La franja seleccionada se superpone con otro turno. Elegí otra opción.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        id_inmueble: idInmueble,
        fecha_programada: fecha,
        inicio_desde: selectedSlot.horaInicio,
        hasta: selectedSlot.horaFin,
        prioridad: prioridad,
        estado: 'Coordinado'
      };

      const response = await TurnoService.create(payload);
      onTurnoCreated(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Ocurrió un error de red al agendar el turno. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal nuevo-turno-modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1070 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
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
              <h2 className="modal-title fw-bold text-dark mb-1">Coordinar nuevo turno</h2>
              <p className="text-secondary small mb-0">Asignación de fecha y franja horaria según disponibilidad operativa.</p>
            </div>
            <CloseButton label="Cerrar nuevo turno" onClick={onClose} />
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
                {/* Columna Izquierda: Cliente e Inmueble */}
                <div className="col-12 col-lg-6">

                  {/* Selector de Cliente */}
                  <div className="mb-4">
                    <label htmlFor="turnos-buscar-cliente" className="form-label nuevo-turno-label">Buscar cliente</label>
                    <div className="input-group mb-2 turnos-cliente-busqueda">
                      <span className="input-group-text bg-white border-end-0"><Search size={16} /></span>
                      <input
                        id="turnos-buscar-cliente"
                        type="search"
                        className="form-control border-start-0 shadow-none"
                        placeholder="Nombre, N° de cliente o teléfono"
                        value={busquedaCliente}
                        onChange={(event) => setBusquedaCliente(event.target.value)}
                        aria-controls="turnos-nuevo-cliente"
                        autoComplete="off"
                        disabled={isLoadingData}
                      />
                    </div>
                    <label htmlFor="turnos-nuevo-cliente" className="form-label nuevo-turno-label">Cliente <span className="text-danger">*</span></label>
                    <select
                      id="turnos-nuevo-cliente"
                      className="form-select shadow-none fw-semibold"
                      value={idCliente}
                      onChange={(e) => { setIdCliente(e.target.value); setInmuebles([]); setIdInmueble(''); }}
                      disabled={isLoadingData}
                    >
                      <option value="">{isLoadingData ? 'Cargando clientes...' : clientesFiltrados.length ? 'Seleccionar cliente...' : 'Sin coincidencias'}</option>
                      {seleccionadoFueraDelFiltro && <option value={idCliente}>#{clienteSeleccionado.id_cliente} — {clienteSeleccionado.nombre} {clienteSeleccionado.apellido} (seleccionado)</option>}
                      {clientesFiltrados.map((c) => (
                        <option key={c.id_cliente} value={c.id_cliente}>
                          #{c.id_cliente} — {c.nombre} {c.apellido} — {c.telefono}
                        </option>
                      ))}
                    </select>
                    <p className="small text-secondary mt-2 mb-0" role="status">{isLoadingData ? 'Cargando clientes...' : `${clientesFiltrados.length} cliente${clientesFiltrados.length === 1 ? '' : 's'} encontrado${clientesFiltrados.length === 1 ? '' : 's'}`}</p>
                  </div>

                  {/* Selector de Inmueble (Aparece solo si hay cliente seleccionado) */}
                  {clienteSeleccionado && (
                    <div className="mb-4">
                      <label className="form-label nuevo-turno-label">Inmueble del cliente <span className="text-danger">*</span></label>
                      <div className="input-group mb-3">
                        <span className="input-group-text bg-white border-end-0"><Home size={16} /></span>
                        <select
                          className="form-select border-start-0 shadow-none fw-semibold"
                          value={idInmueble}
                          onChange={(e) => setIdInmueble(e.target.value)}
                          disabled={inmuebles.length === 0}
                        >
                          <option value="">{inmuebles.length === 0 ? 'Sin inmuebles registrados' : 'Seleccionar inmueble...'}</option>
                          {inmuebles.map((i) => (
                            <option key={i.id_inmueble} value={i.id_inmueble}>
                              {i.direccion} {i.barrio ? `(${i.barrio})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {inmuebleSeleccionado && (
                        <div className="border rounded-4 p-3 p-md-4">
                          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 pb-3 border-bottom">
                            <div className="d-flex gap-2 min-w-0">
                              <span className="bg-light p-2 rounded-circle border"><User size={16} /></span>
                              <div className="min-w-0">
                                <div className="fw-bold text-dark text-break">{clienteSeleccionado.nombre} {clienteSeleccionado.apellido}</div>
                                <div className="small text-secondary d-flex align-items-center gap-1 mt-1"><Phone size={13} /> {clienteSeleccionado.telefono}</div>
                              </div>
                            </div>
                            <div className="d-flex flex-column align-items-end gap-2">
                              <span className="badge bg-success-subtle text-success rounded-pill px-2">{clienteSeleccionado.tipo_cliente?.toUpperCase() || 'FIJO'}</span>
                              {enlaceWhatsApp ? (
                                <a className="btn btn-outline-primary btn-sm" href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp de ${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido || ''}`}>
                                  <MessageCircle size={16} aria-hidden="true" /> WhatsApp
                                </a>
                              ) : (
                                <Button variant="light" size="sm" disabled title="El cliente no tiene un teléfono válido para WhatsApp"><MessageCircle size={16} aria-hidden="true" /> WhatsApp</Button>
                              )}
                            </div>
                          </div>

                          <div className="bg-light rounded-3 border p-3 mt-3 mb-3">
                            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                              <span className="text-secondary text-uppercase" style={{ fontSize: '0.7rem' }}>Inmueble y condición</span>
                              <span className="badge bg-white text-secondary border">{inmuebleSeleccionado.tipo_inmueble}</span>
                            </div>
                            <div className="d-flex align-items-start gap-2 fw-semibold text-dark small"><MapPin size={15} className="flex-shrink-0 mt-1 text-secondary" /> {inmuebleSeleccionado.direccion}</div>
                            <div className="small text-secondary mt-1 ms-4">{inmuebleSeleccionado.barrio || inmuebleSeleccionado.provincia}</div>
                          </div>

                          <div className="bg-success-subtle text-success border-success-subtle border rounded-3 p-3 d-flex align-items-start gap-2">
                            <Maximize size={16} className="flex-shrink-0 mt-1" />
                            <span className="small">Superficie mantenible: <strong>{inmuebleSeleccionado.superficie_mantenible || '0'} m²</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Prioridad, Fecha y Horarios */}
                <div className="col-12 col-lg-6">
                  <fieldset className="mb-4">
                    <legend className="form-label mb-2 fw-semibold small text-secondary">Prioridad operativa <span className="text-danger">*</span></legend>
                    <div className="row g-2">
                      {PRIORIDADES.map((item) => {
                        const isSelected = prioridad === item.value;
                        return (
                          <div className="col-12 col-sm-4" key={item.value}>
                            <button
                              type="button"
                              className={`w-100 h-100 text-start rounded-3 p-3 border ${isSelected ? 'border-dark bg-dark text-white' : 'border-light-subtle bg-white text-dark'}`}
                              onClick={() => { setPrioridad(item.value); setError(''); }}
                            >
                              <span className="d-flex align-items-center gap-2 fw-bold small">
                                <span className={`rounded-circle bg-${item.color}`} style={{ width: 8, height: 8 }} />
                                {item.title}
                              </span>
                              <span className={`d-block mt-1 ${isSelected ? 'text-light' : 'text-secondary'}`} style={{ fontSize: '0.7rem' }}>{item.description}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="mb-4">
                    <label className="form-label mb-2 fw-semibold small text-secondary">Fecha de servicio <span className="text-danger">*</span></label>
                    <TurnoFechaSelector fecha={fecha} minFecha={ahora.fecha} onChange={cambiarFecha} etiqueta="Fecha de servicio" />
                  </div>

                  <fieldset className="mb-4">
                    <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                      <legend className="form-label mb-0 fw-semibold small text-secondary">Franjas horarias disponibles <span className="text-danger">*</span></legend>
                    </div>
                    <div className="row g-2">
                      {franjas.map((slot) => {
                        const isOccupied = Boolean(slot.turnoSolapado);
                        const isPast = horarioPasadoTurnos(fecha, slot.horaInicio, ahora);
                        const isSelected = !isPast && !isOccupied && franjaSeleccionada === slot.horaInicio;
                        const duration = horaAMinutos(slot.horaFin) - horaAMinutos(slot.horaInicio);
                        return (
                          <div className="col-12 col-sm-6" key={`${slot.horaInicio}-${slot.horaFin}`}>
                            <button
                              type="button"
                              disabled={isOccupied || isPast}
                              onClick={() => { setFranjaSeleccionada(slot.horaInicio); setError(''); }}
                              className={`w-100 rounded-3 p-3 text-start border ${isPast ? 'border-light-subtle bg-light text-secondary opacity-75' : isSelected ? 'border-primary bg-primary text-white' : isOccupied ? 'border-danger-subtle bg-danger-subtle text-danger opacity-75' : 'border-light-subtle bg-white text-dark'}`}
                            >
                              <span className="d-flex justify-content-between align-items-center gap-2 fw-bold small">
                                <span>{slot.horaInicio} – {slot.horaFin} hs</span>
                                <span className={`rounded-circle flex-shrink-0 ${isPast ? 'bg-secondary' : isOccupied ? 'bg-danger' : isSelected ? 'bg-white' : 'bg-success'}`} style={{ width: 8, height: 8 }} />
                              </span>
                              <span className={`d-flex justify-content-between gap-2 mt-2 ${isSelected ? 'text-light' : isOccupied ? 'text-danger' : 'text-secondary'}`} style={{ fontSize: '0.72rem' }}>
                                <span>{isPast ? 'Horario pasado' : isOccupied ? 'Ocupado' : 'Disponible'}</span>
                                <span>{isOccupied || isPast ? 'No disp.' : `${Math.floor(duration / 60)}h ${String(duration % 60).padStart(2, '0')}m`}</span>
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>

                  {datosClima && (
                    <div className="border bg-light rounded-4 p-3 mt-4">
                      <div className="d-flex align-items-start gap-2 pb-2 mb-2 border-bottom">
                        <Sun size={19} className="text-warning flex-shrink-0" />
                        <span className="small text-dark"><strong>Pronóstico:</strong> {datosClima.pronostico}</span>
                      </div>
                      <div className="d-flex align-items-start gap-2">
                        <Clock size={18} className="text-secondary flex-shrink-0" />
                        <span className="small text-dark"><strong>Anochecer:</strong> {datosClima.horaAnochecer} hs. Verificá que la franja finalice con luz suficiente.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="nuevo-turno-footer modal-footer border-top px-3 px-md-4 py-3 d-flex justify-content-between gap-2">
              <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={isSubmitting}>Cancelar</button>
              <Button type="submit" variant="primary" className="nuevo-turno-submit" disabled={!idInmueble || !puedeGuardar || isSubmitting}>
                <Check size={17} /> {isSubmitting ? 'Guardando turno...' : 'Guardar turno coordinado'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
