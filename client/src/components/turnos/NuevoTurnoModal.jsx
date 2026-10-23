import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, Clock, DollarSign, RotateCcw, ArrowLeft, ArrowRight, Pencil, CalendarDays,
  Info, MapPin, Maximize, MessageCircle, Phone, Search, Sun, User, Home, Wrench, Plus
} from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import { obtenerEnlaceWhatsApp } from '../../services/whatsapp';
import TurnoService from '../../services/api/turno.service';
import ClienteService from '../../services/api/cliente.service';
import InmuebleService from '../../services/api/inmueble.service';
import ServicioService from '../../services/api/servicio.service';
import CombustibleService from '../../services/api/combustible.service';
import TrasladoDetalle from '../combustible/TrasladoDetalle';
import useRelojTurnos from './useRelojTurnos';
import TurnoFechaSelector from './TurnoFechaSelector';
import {
  horarioPasadoTurnos, obtenerAhoraTurnos, PRIORIDADES, PRIORIDADES_CONFIG,
  horaAMinutos, obtenerFranjasTurnos, formatearHoraCorta, calcularEstimadoTurno,
  formatearMontoARS, fechaDesdeIso
} from './agendaTurnos';

const normalizarBusqueda = (valor) => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function NuevoTurnoModal({
  isOpen, onClose, onTurnoCreated, turnosExistentes = [], datosClima, fechaInicial, horaInicioInicial
}) {
  const navigate = useNavigate();
  const ahora = useRelojTurnos();
  const [pasoActual, setPasoActual] = useState(1);

  const [clientes, setClientes] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [servicios, setServicios] = useState([]);

  const [idCliente, setIdCliente] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [idInmueble, setIdInmueble] = useState('');
  const [idServicio, setIdServicio] = useState('');
  const [montoFinalEditado, setMontoFinalEditado] = useState(null);
  // Trip cost of the chosen property: { idInmueble, datos }. Kept with its id so a
  // stale answer is never used for another property.
  const [trasladoCargado, setTrasladoCargado] = useState(null);

  const [prioridad, setPrioridad] = useState('P2_FIJO');
  const [fecha, setFecha] = useState(() => fechaInicial && fechaInicial >= ahora.fecha ? fechaInicial : ahora.fecha);
  const [franjaSeleccionada, setFranjaSeleccionada] = useState(horaInicioInicial || '');

  const [error, setError] = useState('');
  const [errorServicios, setErrorServicios] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingInmuebles, setIsLoadingInmuebles] = useState(false);
  const [isLoadingServicios, setIsLoadingServicios] = useState(false);

  // Cargar clientes y servicios del usuario al abrir el modal
  useEffect(() => {
    if (!isOpen) return undefined;
    let vigente = true;

    const fetchClientes = async () => {
      setIsLoadingData(true);
      try {
        const res = await ClienteService.getAll();
        if (vigente) setClientes(res.data || []);
      } catch {
        if (vigente) setError('Error al cargar la lista de clientes.');
      } finally {
        if (vigente) setIsLoadingData(false);
      }
    };

    const fetchServicios = async () => {
      setIsLoadingServicios(true);
      setErrorServicios('');
      try {
        const res = await ServicioService.getMios();
        if (!vigente) return;
        const activos = (res.data || []).filter((s) => s.activo);
        setServicios(activos);
      } catch {
        if (vigente) setErrorServicios('Error al cargar tu catálogo de servicios.');
      } finally {
        if (vigente) setIsLoadingServicios(false);
      }
    };

    fetchClientes();
    fetchServicios();

    return () => { vigente = false; };
  }, [isOpen, fechaInicial, horaInicioInicial]);

  // Cargar inmuebles al seleccionar un cliente (auto-selecciona si tiene un único inmueble)
  useEffect(() => {
    let vigente = true;
    if (idCliente) {
      const fetchInmuebles = async () => {
        setIsLoadingInmuebles(true);
        try {
          const res = await InmuebleService.getByCliente(idCliente);
          if (!vigente) return;
          const lista = res.data || [];
          setInmuebles(lista);
          setIdInmueble(lista.length === 1 ? String(lista[0].id_inmueble) : '');
        } catch {
          if (vigente) setError('Error al cargar los inmuebles del cliente.');
        } finally {
          if (vigente) setIsLoadingInmuebles(false);
        }
      };
      fetchInmuebles();
    }
    return () => { vigente = false; };
  }, [idCliente]);

  // Costo de traslado hasta el inmueble elegido (combustible del jefe). Si no se
  // puede calcular, el presupuesto sigue igual y se explica el motivo.
  useEffect(() => {
    if (!isOpen || !idInmueble) return undefined;
    let vigente = true;
    const fetchTraslado = async () => {
      let datos;
      try {
        const res = await CombustibleService.getTraslado(idInmueble);
        datos = res.data;
      } catch {
        datos = { incluido: false, motivo: 'error', mensaje: 'No se pudo calcular el traslado.' };
      }
      if (vigente) setTrasladoCargado({ idInmueble: String(idInmueble), datos });
    };
    fetchTraslado();
    return () => { vigente = false; };
  }, [isOpen, idInmueble]);

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
  const servicioSeleccionado = servicios.find(s => String(s.id_servicio) === String(idServicio));

  const calculoPresupuesto = useMemo(
    () => calcularEstimadoTurno(inmuebleSeleccionado, servicioSeleccionado),
    [inmuebleSeleccionado, servicioSeleccionado]
  );
  const traslado = trasladoCargado && trasladoCargado.idInmueble === String(idInmueble)
    ? trasladoCargado.datos
    : null;
  // Property chosen but its trip cost not answered yet: the total is not final.
  const cargandoTraslado = Boolean(idInmueble) && !traslado;
  const montoTraslado = traslado?.incluido ? traslado.costo : 0;
  const montoEstimadoTotal = calculoPresupuesto
    ? Math.round((calculoPresupuesto.montoEstimado + montoTraslado) * 100) / 100
    : null;
  const valorMontoInput = montoFinalEditado !== null
    ? montoFinalEditado
    : (montoEstimadoTotal !== null ? String(montoEstimadoTotal) : '');
  const montoFinalNumero = valorMontoInput === '' ? NaN : Number(valorMontoInput);
  const montoEsPersonalizado = Boolean(
    montoEstimadoTotal !== null
    && montoFinalEditado !== null
    && Number.isFinite(montoFinalNumero)
    && Math.round(montoFinalNumero * 100) !== Math.round(montoEstimadoTotal * 100)
  );

  const franjas = useMemo(() => obtenerFranjasTurnos({ fecha, turnos: turnosExistentes, horaInicioInicial }), [fecha, horaInicioInicial, turnosExistentes]);
  const franjaActiva = franjas.find((slot) => slot.horaInicio === franjaSeleccionada);
  const puedeGuardarAgenda = Boolean(franjaActiva && !franjaActiva.turnoSolapado && !horarioPasadoTurnos(fecha, franjaActiva.horaInicio, ahora));

  // Validaciones por etapa del Wizard
  const paso1Completo = Boolean(idCliente && idInmueble && clienteSeleccionado && inmuebleSeleccionado);
  const paso2Completo = Boolean(paso1Completo && idServicio && servicioSeleccionado && !cargandoTraslado && Number.isFinite(montoFinalNumero) && montoFinalNumero > 0);
  const paso3Completo = Boolean(paso2Completo && puedeGuardarAgenda);

  const pasoHabilitado = (numeroPaso) => {
    if (numeroPaso === 1) return true;
    if (numeroPaso === 2) return paso1Completo;
    if (numeroPaso === 3) return paso2Completo;
    if (numeroPaso === 4) return paso3Completo;
    return false;
  };

  const pasoActualValido = (
    (pasoActual === 1 && paso1Completo)
    || (pasoActual === 2 && paso2Completo)
    || (pasoActual === 3 && paso3Completo)
    || (pasoActual === 4 && paso3Completo)
  );

  const pasosConfig = [
    {
      id: 1,
      titulo: 'Cliente y Predio',
      tituloCorto: 'Cliente',
      completado: paso1Completo,
      resumen: paso1Completo ? `${clienteSeleccionado.nombre} · ${inmuebleSeleccionado.direccion}` : 'Seleccionar cliente'
    },
    {
      id: 2,
      titulo: 'Servicio y Valor',
      tituloCorto: 'Servicio',
      completado: paso2Completo,
      resumen: paso2Completo ? `${servicioSeleccionado.servicio?.nombre || 'Servicio'} · ${formatearMontoARS(montoFinalNumero)}` : 'Servicio y monto'
    },
    {
      id: 3,
      titulo: 'Agenda y Horario',
      tituloCorto: 'Agenda',
      completado: paso3Completo,
      resumen: paso3Completo ? `${fechaDesdeIso(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} · ${formatearHoraCorta(franjaActiva.horaInicio)} hs` : 'Fecha y franja'
    },
    {
      id: 4,
      titulo: 'Confirmación',
      tituloCorto: 'Confirmar',
      completado: false,
      resumen: 'Revisión final'
    }
  ];

  const irAPaso = (destino) => {
    if (!pasoHabilitado(destino)) return;
    setError('');
    setPasoActual(destino);
  };

  const avanzarPaso = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!pasoActualValido) return;
    setError('');
    if (pasoActual < 4) setPasoActual((prev) => prev + 1);
  };

  const retrocederPaso = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setError('');
    if (pasoActual > 1) setPasoActual((prev) => prev - 1);
  };

  const cambiarFecha = (nuevaFecha) => {
    if (!nuevaFecha || nuevaFecha < obtenerAhoraTurnos().fecha) {
      setError('La fecha del turno no puede ser anterior a hoy.');
      return;
    }
    setFecha(nuevaFecha);
    setFranjaSeleccionada('');
    setError('');
  };

  const handleIrACargarServicio = () => {
    onClose();
    navigate('/servicios', { state: { openNewServiceModal: true } });
  };

  if (!isOpen) return null;

  const handleConfirmarTurno = async (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (pasoActual !== 4 || isSubmitting) return;
    setError('');

    if (!idCliente || !idInmueble) {
      setError('Debes seleccionar un cliente y un inmueble para agendar el turno.');
      setPasoActual(1);
      return;
    }

    if (!idServicio) {
      setError('Debes seleccionar un servicio para agendar el turno.');
      setPasoActual(2);
      return;
    }

    if (!Number.isFinite(montoFinalNumero) || montoFinalNumero <= 0) {
      setError('El valor final del presupuesto debe ser un número mayor a 0.');
      setPasoActual(2);
      return;
    }

    if (!fecha) {
      setError('Seleccioná la fecha del servicio.');
      setPasoActual(3);
      return;
    }

    const selectedSlot = franjas.find((slot) => slot.horaInicio === franjaSeleccionada);
    if (!selectedSlot) {
      setError('Seleccioná una franja horaria disponible.');
      setPasoActual(3);
      return;
    }

    if (horarioPasadoTurnos(fecha, selectedSlot.horaInicio)) {
      setError('La fecha o el horario seleccionado ya pasó. Elegí una franja futura.');
      setPasoActual(3);
      return;
    }

    if (selectedSlot.turnoSolapado) {
      setError('La franja seleccionada se superpone con otro turno. Elegí otra opción.');
      setPasoActual(3);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        id_inmueble: idInmueble,
        id_servicio: Number(idServicio),
        monto_total: Math.round(montoFinalNumero * 100) / 100,
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

  const prioridadConfigActual = PRIORIDADES_CONFIG[prioridad] || PRIORIDADES_CONFIG.P2_FIJO;
  const fechaFormateadaLarga = fecha
    ? fechaDesdeIso(fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="modal nuevo-turno-modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1070 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">

          {/* Cabecera Principal */}
          <div className="modal-header nuevo-turno-header align-items-start px-3 px-md-4 py-2 pt-3 border-bottom-0">
            <div className="min-w-0">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span className="text-uppercase text-secondary fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.06em' }}>
                  Etapa {pasoActual} de 4 · Programación de servicio
                </span>
                <span className="badge rounded-pill nuevo-turno-status px-2 py-1 fw-semibold" style={{ fontSize: '0.68rem' }}>
                  <span className="rounded-circle bg-warning d-inline-block me-1" style={{ width: 6, height: 6 }} />
                  Estado inicial: Coordinado
                </span>
              </div>
              <h2 className="modal-title fw-bold text-dark mb-0 fs-4">Coordinar nuevo turno</h2>
            </div>
            <CloseButton label="Cerrar nuevo turno" onClick={onClose} />
          </div>

          {/* Barra de Pestañas Progresivas (Stepper) */}
          <div className="nuevo-turno-stepper">
            <div className="nuevo-turno-progress-track">
              <div
                className="nuevo-turno-progress-fill"
                style={{ width: `${(pasoActual / 4) * 100}%` }}
              />
            </div>

            <div className="nuevo-turno-steps-grid px-2 px-md-4 py-2" role="tablist" aria-label="Etapas para coordinar nuevo turno">
              {pasosConfig.map((step) => {
                const isActivo = pasoActual === step.id;
                const habilitado = pasoHabilitado(step.id);
                const mostrarCheck = step.completado && !isActivo;

                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={isActivo}
                    disabled={!habilitado}
                    onClick={() => irAPaso(step.id)}
                    className={`nuevo-turno-step-btn ${isActivo ? 'is-active' : ''} ${step.completado ? 'is-completed' : ''}`}
                  >
                    <span className={`nuevo-turno-step-badge ${isActivo ? 'is-active' : mostrarCheck ? 'is-completed' : ''}`}>
                      {mostrarCheck ? <Check size={14} strokeWidth={3} /> : step.id}
                    </span>
                    <div className="min-w-0 flex-grow-1">
                      <div className="fw-bold text-dark d-none d-md-block text-truncate" style={{ fontSize: '0.78rem' }}>
                        {step.titulo}
                      </div>
                      <div className="fw-bold text-dark d-block d-md-none text-truncate" style={{ fontSize: '0.7rem' }}>
                        {step.tituloCorto}
                      </div>
                      <div className="text-secondary text-truncate d-none d-sm-block" style={{ fontSize: '0.67rem' }}>
                        {step.resumen}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (pasoActual < 4 && pasoActualValido) avanzarPaso(event);
            }}
            className="d-flex flex-column min-h-0"
          >
            <div className="modal-body p-3 px-md-4 py-md-3">
              {error && (
                <div className="alert alert-danger rounded-3 py-2 px-3 d-flex align-items-center gap-2 mb-3">
                  <Info size={16} className="flex-shrink-0" />
                  <span className="small fw-medium">{error}</span>
                </div>
              )}

              {/* =========================================================
                  ETAPA 1: CLIENTE (IZQ: SELECTOR / DER: TARJETA)
                           INMUEBLE (IZQ: SELECTOR / DER: TARJETA)
                 ========================================================= */}
              {pasoActual === 1 && (
                <div className="d-flex flex-column gap-3">
                  {/* Fila 1: Cliente */}
                  <div className="row g-3 align-items-stretch">
                    <div className="col-12 col-lg-5">
                      <div className="border rounded-3 p-3 bg-light bg-opacity-50 h-100">
                        <label htmlFor="turnos-buscar-cliente" className="form-label nuevo-turno-label mb-1">Buscar cliente</label>
                        <div className="input-group input-group-sm mb-2">
                          <span className="input-group-text bg-white border-end-0"><Search size={14} /></span>
                          <input
                            id="turnos-buscar-cliente"
                            type="search"
                            className="form-control border-start-0 shadow-none"
                            placeholder="Nombre, N° o teléfono"
                            value={busquedaCliente}
                            onChange={(event) => setBusquedaCliente(event.target.value)}
                            aria-controls="turnos-nuevo-cliente"
                            autoComplete="off"
                            disabled={isLoadingData}
                          />
                        </div>

                        <label htmlFor="turnos-nuevo-cliente" className="form-label nuevo-turno-label mb-1">
                          Cliente <span className="text-danger">*</span>
                        </label>
                        <select
                          id="turnos-nuevo-cliente"
                          className="form-select form-select-sm shadow-none fw-semibold"
                          value={idCliente}
                          onChange={(e) => {
                            setIdCliente(e.target.value);
                            setInmuebles([]);
                            setIdInmueble('');
                            setMontoFinalEditado(null);
                            setError('');
                          }}
                          disabled={isLoadingData}
                        >
                          <option value="">{isLoadingData ? 'Cargando clientes...' : clientesFiltrados.length ? 'Seleccionar cliente...' : 'Sin coincidencias'}</option>
                          {seleccionadoFueraDelFiltro && <option value={idCliente}>#{clienteSeleccionado.id_cliente} — {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}</option>}
                          {clientesFiltrados.map((c) => (
                            <option key={c.id_cliente} value={c.id_cliente}>
                              #{c.id_cliente} — {c.nombre} {c.apellido} — {c.telefono}
                            </option>
                          ))}
                        </select>
                        <div className="text-secondary mt-1" style={{ fontSize: '0.72rem' }} role="status">
                          {isLoadingData ? 'Cargando clientes...' : `${clientesFiltrados.length} cliente${clientesFiltrados.length === 1 ? '' : 's'} disponible${clientesFiltrados.length === 1 ? '' : 's'}`}
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-7">
                      {clienteSeleccionado ? (
                        <div className="border rounded-3 p-3 bg-white shadow-sm h-100 d-flex flex-column justify-content-center">
                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <div className="d-flex gap-2 min-w-0 align-items-center">
                              <span className="bg-light p-2 rounded-circle border text-dark flex-shrink-0"><User size={18} /></span>
                              <div className="min-w-0">
                                <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                                  Ficha del cliente #{clienteSeleccionado.id_cliente}
                                </span>
                                <div className="fw-bold text-dark text-break">{clienteSeleccionado.nombre} {clienteSeleccionado.apellido}</div>
                                <div className="small text-secondary d-flex align-items-center gap-1 mt-1">
                                  <Phone size={12} /> {clienteSeleccionado.telefono || 'Sin teléfono'}
                                </div>
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>
                                {clienteSeleccionado.tipo_cliente?.toUpperCase() || 'FIJO'}
                              </span>
                              {enlaceWhatsApp ? (
                                <a className="btn btn-outline-primary btn-sm rounded-pill px-2 py-1 d-inline-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }} href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                                </a>
                              ) : (
                                <Button variant="light" size="sm" disabled title="Sin teléfono válido para WhatsApp">
                                  <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-dashed rounded-3 p-3 bg-light bg-opacity-50 h-100 d-flex align-items-center justify-content-center text-secondary small">
                          <User size={16} className="me-2 opacity-50" /> Seleccioná un cliente para visualizar su tarjeta.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fila 2: Inmueble */}
                  <div className="row g-3 align-items-stretch">
                    <div className="col-12 col-lg-5">
                      <div className="border rounded-3 p-3 bg-light bg-opacity-50 h-100 d-flex flex-column justify-content-center">
                        <label htmlFor="turnos-nuevo-inmueble" className="form-label nuevo-turno-label mb-1">
                          Inmueble del cliente <span className="text-danger">*</span>
                        </label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text bg-white border-end-0"><Home size={14} /></span>
                          <select
                            id="turnos-nuevo-inmueble"
                            className="form-select form-select-sm border-start-0 shadow-none fw-semibold"
                            value={idInmueble}
                            onChange={(e) => { setIdInmueble(e.target.value); setMontoFinalEditado(null); setError(''); }}
                            disabled={!clienteSeleccionado || isLoadingInmuebles || inmuebles.length === 0}
                          >
                            <option value="">
                              {!clienteSeleccionado
                                ? 'Primero seleccioná un cliente'
                                : isLoadingInmuebles
                                  ? 'Cargando inmuebles...'
                                  : inmuebles.length === 0
                                    ? 'Sin inmuebles registrados'
                                    : 'Seleccionar inmueble...'}
                            </option>
                            {inmuebles.map((i) => (
                              <option key={i.id_inmueble} value={i.id_inmueble}>
                                {i.direccion} {i.barrio ? `(${i.barrio})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="text-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                          {clienteSeleccionado
                            ? `${inmuebles.length} inmueble${inmuebles.length === 1 ? '' : 's'} vinculado${inmuebles.length === 1 ? '' : 's'}`
                            : 'Se habilita al elegir cliente'}
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-7">
                      {inmuebleSeleccionado ? (
                        <div className="border rounded-3 p-3 bg-white shadow-sm h-100 d-flex flex-column justify-content-between">
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <div className="min-w-0">
                              <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                                Predio seleccionado
                              </span>
                              <div className="fw-bold text-dark small d-flex align-items-center gap-1 mt-1 text-break">
                                <MapPin size={14} className="text-success flex-shrink-0" />
                                {inmuebleSeleccionado.direccion}
                              </div>
                              <div className="text-secondary ms-4" style={{ fontSize: '0.75rem' }}>
                                {inmuebleSeleccionado.barrio || inmuebleSeleccionado.provincia || 'Ubicación registrada'}
                              </div>
                            </div>
                            <span className="badge bg-light text-secondary border flex-shrink-0">
                              {inmuebleSeleccionado.tipo_inmueble || 'Predio'}
                            </span>
                          </div>
                          <div className="bg-success-subtle text-success border border-success-subtle rounded-2 px-3 py-1 d-flex align-items-center justify-content-between">
                            <span className="small d-flex align-items-center gap-1">
                              <Maximize size={13} /> Superficie mantenible:
                            </span>
                            <strong className="small">{inmuebleSeleccionado.superficie_mantenible || 0} m²</strong>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-dashed rounded-3 p-3 bg-light bg-opacity-50 h-100 d-flex align-items-center justify-content-center text-secondary small">
                          <Home size={16} className="me-2 opacity-50" /> Seleccioná un inmueble para ver su tarjeta y m².
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================
                  ETAPA 2: SERVICIO (IZQ: SELECTOR / DER: TARJETA Y VALOR)
                 ========================================================= */}
              {pasoActual === 2 && (
                <div className="row g-3 align-items-stretch">
                  <div className="col-12 col-lg-5">
                    <div className="border rounded-3 p-3 bg-light bg-opacity-50 h-100 d-flex flex-column justify-content-between">
                      <div>
                        <label htmlFor="turnos-nuevo-servicio" className="form-label nuevo-turno-label mb-1">
                          Servicio a realizar <span className="text-danger">*</span>
                        </label>

                        {isLoadingServicios ? (
                          <div className="input-group input-group-sm">
                            <span className="input-group-text bg-white border-end-0"><Wrench size={14} /></span>
                            <select id="turnos-nuevo-servicio" className="form-select form-select-sm border-start-0 shadow-none fw-semibold" disabled value="">
                              <option value="">Cargando servicios...</option>
                            </select>
                          </div>
                        ) : errorServicios ? (
                          <div className="alert alert-danger rounded-3 py-2 px-3 d-flex align-items-center gap-2 mb-0">
                            <Info size={15} className="flex-shrink-0" />
                            <span className="small fw-medium">{errorServicios}</span>
                          </div>
                        ) : servicios.length === 0 ? (
                          <div className="border rounded-3 p-3 bg-white">
                            <div className="fw-bold text-dark small mb-1">Aún no vinculaste servicios con precios propios</div>
                            <p className="text-secondary mb-2" style={{ fontSize: '0.75rem' }}>
                              Necesitás tener al menos un servicio activo con su precio por m² en tu catálogo operativo.
                            </p>
                            <Button type="button" variant="primary" size="sm" className="w-100 justify-content-center" onClick={handleIrACargarServicio}>
                              <Plus size={15} /> Cargar nuevo servicio
                            </Button>
                          </div>
                        ) : (
                          <div className="input-group input-group-sm">
                            <span className="input-group-text bg-white border-end-0"><Wrench size={14} /></span>
                            <select
                              id="turnos-nuevo-servicio"
                              className="form-select form-select-sm border-start-0 shadow-none fw-semibold"
                              value={idServicio}
                              onChange={(e) => { setIdServicio(e.target.value); setMontoFinalEditado(null); setError(''); }}
                            >
                              <option value="">Seleccionar servicio...</option>
                              {servicios.map((s) => (
                                <option key={s.id_servicio} value={s.id_servicio}>
                                  {s.servicio?.nombre || `Servicio #${s.id_servicio}`} — ${Number(s.precio_base || 0).toLocaleString('es-AR')}/m²
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="border rounded-3 p-2 px-3 bg-white mt-3">
                        <span className="text-secondary d-block" style={{ fontSize: '0.68rem' }}>Predio seleccionado</span>
                        <div className="fw-semibold text-dark small text-truncate">{inmuebleSeleccionado?.direccion}</div>
                        <div className="text-success fw-bold" style={{ fontSize: '0.75rem' }}>
                          Superficie mantenible: {inmuebleSeleccionado?.superficie_mantenible || 0} m²
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-lg-7">
                    {servicioSeleccionado && calculoPresupuesto ? (
                      <div className="border rounded-3 p-3 bg-white shadow-sm h-100 d-flex flex-column justify-content-between">
                        <div>
                          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 pb-2 mb-2 border-bottom">
                            <div className="min-w-0">
                              <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                                Tarjeta del servicio y presupuesto
                              </span>
                              <div className="fw-bold text-dark text-break">{servicioSeleccionado.servicio?.nombre || `Servicio #${idServicio}`}</div>
                            </div>
                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1">
                              {formatearMontoARS(calculoPresupuesto.precioBase)}/m²
                            </span>
                          </div>

                          <div className="py-2 px-3 bg-light rounded-3 border mb-3">
                            <div className="d-flex justify-content-between align-items-center small text-secondary mb-1">
                              <span>Servicio ({formatearMontoARS(calculoPresupuesto.precioBase)}/m² × {calculoPresupuesto.superficieEfectiva} m²)</span>
                              <span>{formatearMontoARS(calculoPresupuesto.montoEstimado)}</span>
                            </div>
                            {cargandoTraslado ? (
                              <div className="small text-secondary mb-2">Calculando traslado...</div>
                            ) : (
                              <TrasladoDetalle traslado={traslado} formatMonto={formatearMontoARS} className="small mb-2" />
                            )}
                            <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                              <span className="small text-secondary fw-medium">Total final estimado</span>
                              <strong className="text-dark fs-5">
                                {cargandoTraslado ? '-' : formatearMontoARS(montoEstimadoTotal)}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
                            <label htmlFor="turnos-nuevo-monto-final" className="form-label nuevo-turno-label mb-0">
                              Valor final del presupuesto (editable) <span className="text-danger">*</span>
                            </label>
                            {montoEsPersonalizado && (
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0 text-decoration-none d-inline-flex align-items-center gap-1 fw-semibold"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => setMontoFinalEditado(null)}
                              >
                                <RotateCcw size={12} /> Restaurar estimado
                              </button>
                            )}
                          </div>
                          <div className="input-group input-group-sm">
                            <span className="input-group-text bg-white border-end-0 fw-bold text-success"><DollarSign size={15} /></span>
                            <input
                              id="turnos-nuevo-monto-final"
                              type="number"
                              min="0.01"
                              step="0.01"
                              className="form-control border-start-0 shadow-none fw-bold text-dark"
                              value={valorMontoInput}
                              onChange={(e) => { setMontoFinalEditado(e.target.value); setError(''); }}
                              placeholder="0.00"
                            />
                          </div>
                          <small className="text-secondary d-block mt-1" style={{ fontSize: '0.7rem' }}>
                            {montoEsPersonalizado
                              ? `Se guardará ${formatearMontoARS(montoFinalNumero)} como monto final.`
                              : 'Podés mantener el valor estimado o ajustarlo manualmente.'}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-dashed rounded-3 p-3 bg-light bg-opacity-50 h-100 d-flex align-items-center justify-content-center text-secondary small">
                        <Wrench size={16} className="me-2 opacity-50" /> Seleccioná un servicio para calcular y editar el presupuesto.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================
                  ETAPA 3: IZQ: PRIORIDAD / DER: FECHA Y FRANJAS HORARIAS
                 ========================================================= */}
              {pasoActual === 3 && (
                <div className="row g-3 align-items-start">
                  {/* Izquierda: Prioridad Operativa */}
                  <div className="col-12 col-lg-5">
                    <fieldset className="border rounded-3 p-3 bg-light bg-opacity-50">
                      <legend className="form-label nuevo-turno-label mb-2 float-none w-auto p-0">
                        Prioridad operativa <span className="text-danger">*</span>
                      </legend>
                      <div className="d-flex flex-column gap-2">
                        {PRIORIDADES.map((item) => {
                          const isSelected = prioridad === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              className={`w-100 text-start rounded-3 p-2 px-3 border ${isSelected ? 'border-dark bg-dark text-white' : 'border-light-subtle bg-white text-dark'}`}
                              onClick={() => { setPrioridad(item.value); setError(''); }}
                            >
                              <span className="d-flex align-items-center gap-2 fw-bold small">
                                <span className={`rounded-circle bg-${item.color}`} style={{ width: 8, height: 8 }} />
                                {item.title}
                              </span>
                              <span className={`d-block mt-1 ${isSelected ? 'text-light' : 'text-secondary'}`} style={{ fontSize: '0.7rem' }}>
                                {item.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    {datosClima && (
                      <div className="border bg-light rounded-3 p-2 px-3 mt-2">
                        <div className="d-flex align-items-center gap-2 small text-dark">
                          <Sun size={15} className="text-warning flex-shrink-0" />
                          <span><strong>Pronóstico:</strong> {datosClima.pronostico} · Anochecer {datosClima.horaAnochecer} hs</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Derecha: Fecha y Franjas Horarias */}
                  <div className="col-12 col-lg-7">
                    <div className="border rounded-3 p-3 bg-white shadow-sm">
                      <div className="mb-3">
                        <label className="form-label nuevo-turno-label mb-1">
                          Fecha de servicio <span className="text-danger">*</span>
                        </label>
                        <TurnoFechaSelector fecha={fecha} minFecha={ahora.fecha} onChange={cambiarFecha} etiqueta="Fecha de servicio" />
                      </div>

                      <fieldset>
                        <legend className="form-label nuevo-turno-label mb-2 float-none w-auto p-0">
                          Franjas horarias disponibles <span className="text-danger">*</span>
                        </legend>
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
                                  className={`w-100 rounded-3 p-2 px-3 text-start border ${isPast ? 'border-light-subtle bg-light text-secondary opacity-75' : isSelected ? 'border-primary bg-primary text-white' : isOccupied ? 'border-danger-subtle bg-danger-subtle text-danger opacity-75' : 'border-light-subtle bg-white text-dark'}`}
                                >
                                  <span className="d-flex justify-content-between align-items-center gap-2 fw-bold small">
                                    <span>{formatearHoraCorta(slot.horaInicio)} – {formatearHoraCorta(slot.horaFin)} hs</span>
                                    <span className={`rounded-circle flex-shrink-0 ${isPast ? 'bg-secondary' : isOccupied ? 'bg-danger' : isSelected ? 'bg-white' : 'bg-success'}`} style={{ width: 8, height: 8 }} />
                                  </span>
                                  <span className={`d-flex justify-content-between gap-2 mt-1 ${isSelected ? 'text-light' : isOccupied ? 'text-danger' : 'text-secondary'}`} style={{ fontSize: '0.7rem' }}>
                                    <span>{isPast ? 'Horario pasado' : isOccupied ? 'Ocupado' : 'Disponible'}</span>
                                    <span>{isOccupied || isPast ? 'No disp.' : `${Math.floor(duration / 60)}h ${String(duration % 60).padStart(2, '0')}m`}</span>
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </fieldset>
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================
                  ETAPA 4: RESUMEN COMPACTO Y CONFIRMACIÓN MANUAL
                 ========================================================= */}
              {pasoActual === 4 && (
                <div className="row g-3">
                  {/* Resumen 1: Cliente e Inmueble */}
                  <div className="col-12 col-lg-6">
                    <div className="border rounded-3 p-3 h-100 bg-white shadow-sm d-flex flex-column justify-content-between">
                      <div>
                        <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                          <span className="text-secondary text-uppercase fw-bold d-flex align-items-center gap-1" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                            <User size={13} /> Cliente e Inmueble
                          </span>
                          <button
                            type="button"
                            onClick={() => irAPaso(1)}
                            className="btn btn-sm btn-light border rounded-pill px-2 py-0 text-secondary fw-semibold d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '0.7rem' }}
                          >
                            <Pencil size={11} /> Editar
                          </button>
                        </div>

                        <div className="fw-bold text-dark text-break">
                          {clienteSeleccionado?.nombre} {clienteSeleccionado?.apellido}
                        </div>
                        <div className="small text-secondary mb-2">{clienteSeleccionado?.telefono || 'Sin teléfono'}</div>
                      </div>

                      <div className="pt-2 border-top">
                        <div className="fw-semibold text-dark small d-flex align-items-start gap-1">
                          <MapPin size={14} className="text-success flex-shrink-0 mt-1" />
                          <span>{inmuebleSeleccionado?.direccion}</span>
                        </div>
                        <div className="small text-secondary ms-4">
                          {inmuebleSeleccionado?.barrio || inmuebleSeleccionado?.provincia} · <strong>{inmuebleSeleccionado?.superficie_mantenible || 0} m²</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumen 2: Servicio y Presupuesto */}
                  <div className="col-12 col-lg-6">
                    <div className="border rounded-3 p-3 h-100 bg-white shadow-sm d-flex flex-column justify-content-between">
                      <div>
                        <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                          <span className="text-secondary text-uppercase fw-bold d-flex align-items-center gap-1" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                            <Wrench size={13} /> Servicio y Presupuesto
                          </span>
                          <button
                            type="button"
                            onClick={() => irAPaso(2)}
                            className="btn btn-sm btn-light border rounded-pill px-2 py-0 text-secondary fw-semibold d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '0.7rem' }}
                          >
                            <Pencil size={11} /> Editar
                          </button>
                        </div>

                        <div className="fw-bold text-dark text-break">
                          {servicioSeleccionado?.servicio?.nombre || `Servicio #${idServicio}`}
                        </div>
                        <div className="small text-secondary mb-2">
                          Tarifa base: {formatearMontoARS(servicioSeleccionado?.precio_base)}/m²
                        </div>
                      </div>

                      <div className="pt-2 border-top">
                        <div className="d-flex justify-content-between align-items-center small text-secondary">
                          <span>Servicio:</span>
                          <span>{calculoPresupuesto ? formatearMontoARS(calculoPresupuesto.montoEstimado) : '-'}</span>
                        </div>
                        {traslado?.incluido && (
                          <div className="d-flex justify-content-between align-items-center small text-secondary">
                            <span>Traslado{traslado.km_aproximados ? ' (aprox.)' : ''}:</span>
                            <span>{formatearMontoARS(traslado.costo)}</span>
                          </div>
                        )}
                        <div className="d-flex justify-content-between align-items-center small text-secondary">
                          <span>Total estimado:</span>
                          <span>{montoEstimadoTotal !== null ? formatearMontoARS(montoEstimadoTotal) : '-'}</span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="small fw-bold text-dark">Valor final del presupuesto:</span>
                          <strong className="text-success fs-6">{formatearMontoARS(montoFinalNumero)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumen 3: Agenda y Prioridad */}
                  <div className="col-12">
                    <div className="border rounded-3 p-3 bg-light shadow-sm">
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                        <span className="text-secondary text-uppercase fw-bold d-flex align-items-center gap-1" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                          <CalendarDays size={13} /> Fecha, Horario y Prioridad
                        </span>
                        <button
                          type="button"
                          onClick={() => irAPaso(3)}
                          className="btn btn-sm btn-white bg-white border rounded-pill px-2 py-0 text-secondary fw-semibold d-inline-flex align-items-center gap-1"
                          style={{ fontSize: '0.7rem' }}
                        >
                          <Pencil size={11} /> Editar
                        </button>
                      </div>

                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div>
                          <span className="fw-bold text-dark text-capitalize me-3">{fechaFormateadaLarga}</span>
                          <span className="text-secondary small d-inline-flex align-items-center gap-1">
                            <Clock size={13} className="text-success" />
                            <strong>{franjaActiva ? `${formatearHoraCorta(franjaActiva.horaInicio)} – ${formatearHoraCorta(franjaActiva.horaFin)} hs` : 'Sin seleccionar'}</strong>
                          </span>
                        </div>
                        <span className={`badge bg-${prioridadConfigActual.color}-subtle text-${prioridadConfigActual.color} border border-${prioridadConfigActual.color}-subtle rounded-pill px-3 py-1 fw-bold`}>
                          {prioridadConfigActual.short}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer contextual según la etapa */}
            <div className="nuevo-turno-footer modal-footer border-top px-3 px-md-4 py-2 d-flex justify-content-between align-items-center gap-2">
              <div className="d-flex align-items-center gap-2">
                {pasoActual > 1 && (
                  <button
                    type="button"
                    className="btn btn-light border rounded-pill px-3 fw-semibold text-dark d-inline-flex align-items-center gap-1"
                    onClick={retrocederPaso}
                    disabled={isSubmitting}
                  >
                    <ArrowLeft size={15} /> Anterior
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-light rounded-pill px-3 fw-semibold text-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
              </div>

              {pasoActual < 4 ? (
                <Button
                  key="btn-step-next"
                  type="button"
                  variant="primary"
                  className="nuevo-turno-submit"
                  disabled={!pasoActualValido}
                  onClick={avanzarPaso}
                >
                  Continuar <ArrowRight size={16} />
                </Button>
              ) : (
                <Button
                  key="btn-step-confirm"
                  type="button"
                  variant="primary"
                  className="nuevo-turno-submit"
                  disabled={!paso3Completo || isSubmitting}
                  onClick={handleConfirmarTurno}
                >
                  <Check size={16} /> {isSubmitting ? 'Guardando turno...' : 'Confirmar y guardar turno'}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
