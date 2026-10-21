import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Map, Copy, Pencil, Check, DollarSign, RotateCcw, Home, Wrench, Search, Info, Maximize, Plus,
  ClipboardList, CalendarDays, CheckCircle, XCircle, CalendarClock, MapPin, PlayCircle
} from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import TurnoService from '../../services/api/turno.service';
import ClienteService from '../../services/api/cliente.service';
import InmuebleService from '../../services/api/inmueble.service';
import ServicioService from '../../services/api/servicio.service';
import { formatearHorarioTurno, calcularEstimadoTurno, formatearMontoARS } from './agendaTurnos';

const normalizarBusqueda = (valor) => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function TurnoDetalleModal({
  isOpen, onClose, turnoData, onCancelTurno, onEditTurno, onChangeState, onTurnoUpdated
}) {
  const navigate = useNavigate();
  const [isEditingDatos, setIsEditingDatos] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');

  const [idClienteEdit, setIdClienteEdit] = useState('');
  const [idInmuebleEdit, setIdInmuebleEdit] = useState('');
  const [idServicioEdit, setIdServicioEdit] = useState('');
  const [montoFinalEditado, setMontoFinalEditado] = useState(null);

  const [isLoadingOpciones, setIsLoadingOpciones] = useState(false);
  const [isLoadingInmuebles, setIsLoadingInmuebles] = useState(false);
  const [isSavingDatos, setIsSavingDatos] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');

  const cliente = turnoData?.cliente || {};
  const inmueble = turnoData?.inmueble || {};
  const servicio = turnoData?.servicio || {};
  const presupuesto = turnoData?.presupuesto || null;
  const franja = turnoData?.franjaHoraria || {};

  const clientesFiltrados = useMemo(() => {
    const palabras = normalizarBusqueda(busquedaCliente).split(/\s+/).filter(Boolean);
    return clientes.filter((c) => {
      const datos = normalizarBusqueda(`#${c.id_cliente} ${c.nombre || ''} ${c.apellido || ''} ${c.telefono || ''} ${String(c.telefono || '').replace(/\D/g, '')}`);
      return palabras.every((palabra) => datos.includes(palabra));
    });
  }, [clientes, busquedaCliente]);

  const clienteSeleccionadoEdit = clientes.find((c) => String(c.id_cliente) === String(idClienteEdit))
    || (String(cliente.id_cliente) === String(idClienteEdit) ? cliente : null);
  const seleccionadoFueraDelFiltro = clienteSeleccionadoEdit
    && !clientesFiltrados.some((c) => String(c.id_cliente) === String(idClienteEdit));

  const inmuebleSeleccionadoEdit = inmuebles.find((i) => String(i.id_inmueble) === String(idInmuebleEdit))
    || (String(inmueble.id_inmueble) === String(idInmuebleEdit) ? inmueble : null);
  const servicioSeleccionadoEdit = servicios.find((s) => String(s.id_servicio) === String(idServicioEdit));

  const calculoPresupuestoEdit = useMemo(
    () => calcularEstimadoTurno(inmuebleSeleccionadoEdit, servicioSeleccionadoEdit),
    [inmuebleSeleccionadoEdit, servicioSeleccionadoEdit]
  );

  const montoEstimadoReferencia = calculoPresupuestoEdit?.montoEstimado
    ?? (presupuesto?.monto_estimado ? Number(presupuesto.monto_estimado) : null);

  const valorMontoInput = montoFinalEditado !== null
    ? montoFinalEditado
    : (montoEstimadoReferencia !== null ? String(montoEstimadoReferencia) : '');
  const montoFinalNumero = valorMontoInput === '' ? NaN : Number(valorMontoInput);
  const montoEsPersonalizado = Boolean(
    montoEstimadoReferencia !== null
    && montoFinalEditado !== null
    && Number.isFinite(montoFinalNumero)
    && Math.round(montoFinalNumero * 100) !== Math.round(montoEstimadoReferencia * 100)
  );

  if (!isOpen || !turnoData) return null;

  const isCancelado = turnoData.estado === 'CANCELADO';
  const isRealizado = turnoData.estado === 'REALIZADO';
  const isActivo = !isCancelado && !isRealizado;

  const abrirEdicionDatos = async () => {
    const clienteInicial = String(cliente.id_cliente ?? inmueble.id_cliente ?? '');
    const inmuebleInicial = String(inmueble.id_inmueble ?? '');
    const servicioInicial = servicio.id_servicio ? String(servicio.id_servicio) : '';

    setIdClienteEdit(clienteInicial);
    setIdInmuebleEdit(inmuebleInicial);
    setIdServicioEdit(servicioInicial);
    setMontoFinalEditado(presupuesto?.monto_total ? String(presupuesto.monto_total) : null);
    setBusquedaCliente('');
    setErrorEdicion('');
    setIsEditingDatos(true);
    setIsLoadingOpciones(true);

    try {
      const promesas = [
        ClienteService.getAll(),
        ServicioService.getMios(),
        clienteInicial ? InmuebleService.getByCliente(clienteInicial) : Promise.resolve({ data: [] }),
      ];
      const [resClientes, resServicios, resInmuebles] = await Promise.all(promesas);
      setClientes(resClientes.data || []);
      const activos = (resServicios.data || []).filter((s) => s.activo);
      setServicios(activos);
      setInmuebles(resInmuebles.data || []);

      // Si el turno tenía servicio por nombre pero sin id_servicio, preseleccionar por coincidencia de nombre
      if (!servicioInicial && servicio.nombres?.length > 0) {
        const coincidencia = activos.find((s) => s.servicio?.nombre === servicio.nombres[0]);
        if (coincidencia) setIdServicioEdit(String(coincidencia.id_servicio));
      }
    } catch {
      setErrorEdicion('Error al cargar las opciones de clientes, inmuebles o servicios.');
    } finally {
      setIsLoadingOpciones(false);
    }
  };

  const handleCambiarClienteEdit = async (nuevoIdCliente) => {
    setIdClienteEdit(nuevoIdCliente);
    setIdInmuebleEdit('');
    setInmuebles([]);
    setMontoFinalEditado(null);
    setErrorEdicion('');

    if (!nuevoIdCliente) return;
    setIsLoadingInmuebles(true);
    try {
      const res = await InmuebleService.getByCliente(nuevoIdCliente);
      setInmuebles(res.data || []);
    } catch {
      setErrorEdicion('Error al cargar los inmuebles del cliente seleccionado.');
    } finally {
      setIsLoadingInmuebles(false);
    }
  };

  const handleGuardarDatos = async (event) => {
    event.preventDefault();
    setErrorEdicion('');

    if (!idClienteEdit || !idInmuebleEdit) {
      setErrorEdicion('Debes seleccionar un cliente y un inmueble.');
      return;
    }
    if (!idServicioEdit) {
      setErrorEdicion('Debes seleccionar un servicio activo.');
      return;
    }
    if (!Number.isFinite(montoFinalNumero) || montoFinalNumero <= 0) {
      setErrorEdicion('El valor final del presupuesto debe ser un número mayor a 0.');
      return;
    }

    setIsSavingDatos(true);
    try {
      const payload = {
        id_inmueble: Number(idInmuebleEdit),
        id_servicio: Number(idServicioEdit),
        monto_total: Math.round(montoFinalNumero * 100) / 100,
      };
      const response = await TurnoService.update(turnoData.idTurno, payload);
      if (onTurnoUpdated) onTurnoUpdated(response.data);
      setIsEditingDatos(false);
    } catch (err) {
      setErrorEdicion(err.response?.data?.error || 'No se pudieron guardar los cambios del turno.');
    } finally {
      setIsSavingDatos(false);
    }
  };

  const handleIrACargarServicio = () => {
    onClose();
    navigate('/servicios', { state: { openNewServiceModal: true } });
  };

  const handleCopyLocation = () => {
    const ubicacion = `${inmueble.direccion}, ${inmueble.barrio || ''}, ${inmueble.provincia || ''}`;
    navigator.clipboard.writeText(ubicacion);
  };

  const handleOpenMaps = () => {
    if (inmueble.latitud && inmueble.longitud) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${inmueble.latitud},${inmueble.longitud}`, '_blank');
    } else {
      const query = encodeURIComponent(`${inmueble.direccion}, ${inmueble.provincia}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  const handleCancelClick = () => {
    if(window.confirm('¿Estás seguro de que deseas cancelar este turno?')) {
      onCancelTurno(turnoData.idTurno);
    }
  };

  return (
    <div className="modal d-block bg-dark bg-opacity-50 tab-index-1" style={{ zIndex: 1060, overflowY: 'auto' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg my-4">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
          
          <div className="modal-header border-bottom-0 pb-2 pt-4 px-3 px-md-4 align-items-start">
            <div className="min-w-0 flex-grow-1">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h4 className="modal-title fw-bold text-dark m-0">Detalle del Turno #{turnoData.idTurno || 'TU-000'}</h4>
                {isActivo && !isEditingDatos && (
                  <button
                    type="button"
                    onClick={abrirEdicionDatos}
                    className="btn btn-sm btn-outline-dark rounded-pill fw-semibold d-inline-flex align-items-center gap-1 px-3"
                  >
                    <Pencil size={14} /> Editar datos y presupuesto
                  </button>
                )}
              </div>
              <div className="d-flex flex-wrap gap-2">
                <span className={`badge border rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-2
                  ${turnoData.estado === 'EN_EJECUCION' ? 'bg-primary-subtle text-primary border-primary-subtle' : 
                    turnoData.estado === 'REALIZADO' ? 'bg-secondary text-white border-secondary' :
                    turnoData.estado === 'CANCELADO' ? 'bg-danger-subtle text-danger border-danger-subtle' :
                    'bg-warning-subtle text-warning-emphasis border-warning-subtle'}`
                }>
                  {turnoData.estado === 'EN_EJECUCION' ? 'EN EJECUCIÓN' : turnoData.estado}
                </span>
                <span className="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-2">
                  <span className="rounded-circle bg-danger" style={{ width: 8, height: 8 }}></span>
                  {turnoData.prioridad}
                </span>
              </div>
            </div>
            <CloseButton label="Cerrar detalle del turno" onClick={onClose} />
          </div>

          <div className="modal-body p-3 p-md-4 bg-white">
            {errorEdicion && (
              <div className="alert alert-danger rounded-3 py-2 px-3 d-flex align-items-center gap-2 mb-3">
                <Info size={17} className="flex-shrink-0" />
                <span className="small fw-medium">{errorEdicion}</span>
              </div>
            )}

            {isEditingDatos ? (
              <form id="form-editar-datos-turno" onSubmit={handleGuardarDatos}>
                <div className="row g-4">
                  {/* Edición de Cliente e Inmueble */}
                  <div className="col-12 col-lg-6">
                    <div className="border border-light-subtle rounded-4 p-3 p-md-4 h-100 shadow-sm bg-light bg-opacity-50">
                      <h6 className="text-secondary fw-bold small text-uppercase d-flex align-items-center gap-2 mb-3" style={{ letterSpacing: '0.05em' }}>
                        <User size={16} /> Editar Cliente e Inmueble
                      </h6>

                      <div className="mb-3">
                        <label htmlFor="detalle-buscar-cliente" className="form-label small fw-semibold text-secondary mb-1">Buscar cliente</label>
                        <div className="input-group input-group-sm mb-2">
                          <span className="input-group-text bg-white border-end-0"><Search size={14} /></span>
                          <input
                            id="detalle-buscar-cliente"
                            type="search"
                            className="form-control border-start-0 shadow-none"
                            placeholder="Nombre, N° de cliente o teléfono"
                            value={busquedaCliente}
                            onChange={(e) => setBusquedaCliente(e.target.value)}
                            disabled={isLoadingOpciones}
                          />
                        </div>
                        <label htmlFor="detalle-select-cliente" className="form-label small fw-semibold text-secondary mb-1">
                          Cliente <span className="text-danger">*</span>
                        </label>
                        <select
                          id="detalle-select-cliente"
                          className="form-select shadow-none fw-semibold"
                          value={idClienteEdit}
                          onChange={(e) => handleCambiarClienteEdit(e.target.value)}
                          disabled={isLoadingOpciones}
                        >
                          <option value="">{isLoadingOpciones ? 'Cargando clientes...' : 'Seleccionar cliente...'}</option>
                          {seleccionadoFueraDelFiltro && (
                            <option value={idClienteEdit}>
                              #{clienteSeleccionadoEdit.id_cliente} — {clienteSeleccionadoEdit.nombre} {clienteSeleccionadoEdit.apellido}
                            </option>
                          )}
                          {clientesFiltrados.map((c) => (
                            <option key={c.id_cliente} value={c.id_cliente}>
                              #{c.id_cliente} — {c.nombre} {c.apellido} — {c.telefono}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mb-3">
                        <label htmlFor="detalle-select-inmueble" className="form-label small fw-semibold text-secondary mb-1">
                          Inmueble <span className="text-danger">*</span>
                        </label>
                        <div className="input-group">
                          <span className="input-group-text bg-white border-end-0"><Home size={16} /></span>
                          <select
                            id="detalle-select-inmueble"
                            className="form-select border-start-0 shadow-none fw-semibold"
                            value={idInmuebleEdit}
                            onChange={(e) => { setIdInmuebleEdit(e.target.value); setMontoFinalEditado(null); setErrorEdicion(''); }}
                            disabled={isLoadingOpciones || isLoadingInmuebles || inmuebles.length === 0}
                          >
                            <option value="">
                              {isLoadingInmuebles ? 'Cargando inmuebles...' : inmuebles.length === 0 ? 'Sin inmuebles registrados' : 'Seleccionar inmueble...'}
                            </option>
                            {inmuebles.map((i) => (
                              <option key={i.id_inmueble} value={i.id_inmueble}>
                                {i.direccion} {i.barrio ? `(${i.barrio})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {inmuebleSeleccionadoEdit && (
                        <div className="bg-success-subtle text-success border-success-subtle border rounded-3 p-2 px-3 d-flex align-items-center gap-2 mt-3">
                          <Maximize size={15} className="flex-shrink-0" />
                          <span className="small">Superficie mantenible: <strong>{inmuebleSeleccionadoEdit.superficie_mantenible || '0'} m²</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edición de Servicio y Valor Final del Presupuesto */}
                  <div className="col-12 col-lg-6">
                    <div className="border border-light-subtle rounded-4 p-3 p-md-4 h-100 shadow-sm bg-light bg-opacity-50">
                      <h6 className="text-secondary fw-bold small text-uppercase d-flex align-items-center gap-2 mb-3" style={{ letterSpacing: '0.05em' }}>
                        <ClipboardList size={16} /> Editar Servicio y Presupuesto
                      </h6>

                      <div className="mb-3">
                        <label htmlFor="detalle-select-servicio" className="form-label small fw-semibold text-secondary mb-1">
                          Servicio seleccionado <span className="text-danger">*</span>
                        </label>
                        {!isLoadingOpciones && servicios.length === 0 ? (
                          <div className="border rounded-3 p-3 bg-white">
                            <p className="small text-secondary mb-2">No tenés servicios activos configurados con precio propio.</p>
                            <Button type="button" variant="primary" size="sm" onClick={handleIrACargarServicio}>
                              <Plus size={15} /> Cargar nuevo servicio
                            </Button>
                          </div>
                        ) : (
                          <div className="input-group">
                            <span className="input-group-text bg-white border-end-0"><Wrench size={16} /></span>
                            <select
                              id="detalle-select-servicio"
                              className="form-select border-start-0 shadow-none fw-semibold"
                              value={idServicioEdit}
                              onChange={(e) => { setIdServicioEdit(e.target.value); setMontoFinalEditado(null); setErrorEdicion(''); }}
                              disabled={isLoadingOpciones}
                            >
                              <option value="">{isLoadingOpciones ? 'Cargando servicios...' : 'Seleccionar servicio...'}</option>
                              {servicios.map((s) => (
                                <option key={s.id_servicio} value={s.id_servicio}>
                                  {s.servicio?.nombre || `Servicio #${s.id_servicio}`} — ${Number(s.precio_base || 0).toLocaleString('es-AR')}/m²
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {montoEstimadoReferencia !== null && (
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 px-3 bg-white rounded-3 border mb-3">
                          <div>
                            <span className="small text-secondary d-block">Total final estimado:</span>
                            {calculoPresupuestoEdit && (
                              <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                                {calculoPresupuestoEdit.superficie > 0 ? `${calculoPresupuestoEdit.superficie} m²` : '1 m² (mín.)'} × {formatearMontoARS(calculoPresupuestoEdit.precioBase)}/m²
                              </span>
                            )}
                          </div>
                          <strong className="text-dark fs-6">{formatearMontoARS(montoEstimadoReferencia)}</strong>
                        </div>
                      )}

                      <div>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
                          <label htmlFor="detalle-monto-final" className="form-label small fw-semibold text-secondary mb-0">
                            Valor final del presupuesto <span className="text-danger">*</span>
                          </label>
                          {montoEsPersonalizado && (
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-decoration-none d-inline-flex align-items-center gap-1 fw-semibold"
                              onClick={() => setMontoFinalEditado(null)}
                            >
                              <RotateCcw size={13} /> Restaurar estimado
                            </button>
                          )}
                        </div>
                        <div className="input-group">
                          <span className="input-group-text bg-white border-end-0 fw-bold text-secondary"><DollarSign size={16} /></span>
                          <input
                            id="detalle-monto-final"
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="form-control border-start-0 shadow-none fw-bold text-dark"
                            value={valorMontoInput}
                            onChange={(e) => { setMontoFinalEditado(e.target.value); setErrorEdicion(''); }}
                            placeholder="0.00"
                            disabled={isLoadingOpciones}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <div className="row g-4">
                <div className="col-12 col-lg-6">
                  <div className="border border-light-subtle rounded-4 p-4 h-100 shadow-sm d-flex flex-column bg-white">
                    <h6 className="text-secondary fw-bold small text-uppercase d-flex align-items-center gap-2 mb-3" style={{ letterSpacing: '0.05em' }}>
                      <User size={16} /> Cliente e Inmueble
                    </h6>
                    
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="min-w-0 pe-2">
                        <h5 className="fw-bold text-dark m-0 fs-5 text-break">{cliente.nombre} {cliente.apellido}</h5>
                        {cliente.telefono && <span className="text-secondary small d-block mt-1">{cliente.telefono}</span>}
                      </div>
                      <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 fw-bold d-flex align-items-center gap-1 flex-shrink-0" style={{ fontSize: '0.65rem' }}>
                        <span className="rounded-circle bg-success" style={{ width: 6, height: 6 }}></span>
                        {cliente.tipo_cliente?.toUpperCase() || 'CLIENTE'}
                      </span>
                    </div>

                    <hr className="text-light-subtle my-3" />

                    <div className="mb-3">
                      <span className="text-secondary small d-block mb-1">Dirección y Condición:</span>
                      <strong className="text-dark d-block d-flex align-items-start gap-1">
                        <MapPin size={16} className="text-dark flex-shrink-0 mt-1 d-lg-none" />
                        {inmueble.direccion} {inmueble.manzana ? `- Mz ${inmueble.manzana}` : ''} {inmueble.lote ? `Lote ${inmueble.lote}` : ''}
                      </strong>
                      <span className="text-secondary small d-block">
                        B° {inmueble.barrio || 'Centro'}, {inmueble.provincia}
                      </span>
                      {inmueble.superficie_mantenible !== undefined && inmueble.superficie_mantenible !== null && (
                        <span className="badge bg-light text-secondary border mt-2">
                          Superficie mantenible: {inmueble.superficie_mantenible} m²
                        </span>
                      )}
                    </div>

                    <div className="d-flex flex-wrap gap-2 mb-2 mt-auto">
                      <button onClick={handleOpenMaps} className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-2 fw-semibold px-3">
                        <Map size={14} /> Abrir en Maps
                      </button>
                      <button onClick={handleCopyLocation} className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-2 fw-semibold px-3">
                        <Copy size={14} /> Copiar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="border border-light-subtle rounded-4 p-4 h-100 shadow-sm d-flex flex-column bg-white">
                    <h6 className="text-secondary fw-bold small text-uppercase d-flex align-items-center gap-2 mb-3" style={{ letterSpacing: '0.05em' }}>
                      <ClipboardList size={16} /> Servicio y Planificación
                    </h6>
                    <h5 className="fw-bold text-dark m-0 fs-5 mb-2 text-break">{servicio.descripcion || 'Mantenimiento General'}</h5>
                    
                    <hr className="text-light-subtle my-2" />

                    <div className="my-2 p-3 rounded-3 bg-light border">
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                        <span className="text-secondary small">Total estimado:</span>
                        <span className="fw-semibold text-secondary small">
                          {presupuesto ? formatearMontoARS(presupuesto.monto_estimado) : 'Sin calcular'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center gap-2">
                        <span className="text-dark small fw-bold">Valor final del presupuesto:</span>
                        <strong className="text-success fs-5">
                          {presupuesto ? formatearMontoARS(presupuesto.monto_total) : 'Sin presupuesto'}
                        </strong>
                      </div>
                    </div>

                    <div className="mt-3">
                      <span className="text-secondary small d-block mb-2">Fecha y Franja Asignada:</span>
                      <strong className="text-dark d-flex align-items-center gap-2 mb-1">
                        <CalendarDays size={18} className="text-success" /> 
                        {franja.fecha || turnoData.fechaAsignada} · {formatearHorarioTurno(turnoData)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-3 px-md-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
            {isEditingDatos ? (
              <div className="d-flex flex-column flex-sm-row justify-content-end w-100 gap-2">
                <button
                  type="button"
                  className="btn btn-light rounded-pill px-4 fw-semibold text-secondary border"
                  onClick={() => { setIsEditingDatos(false); setErrorEdicion(''); }}
                  disabled={isSavingDatos}
                >
                  Cancelar edición
                </button>
                <Button
                  type="submit"
                  form="form-editar-datos-turno"
                  variant="primary"
                  className="rounded-pill px-4 shadow-sm d-flex align-items-center justify-content-center gap-2"
                  disabled={!idClienteEdit || !idInmuebleEdit || !idServicioEdit || !Number.isFinite(montoFinalNumero) || montoFinalNumero <= 0 || isSavingDatos}
                >
                  <Check size={17} /> {isSavingDatos ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            ) : (
              <>
                {/* Solo permite cancelar si el turno no está en un estado final ni en ejecución */}
                {isActivo && turnoData.estado !== 'EN_EJECUCION' ? (
                  <button 
                    onClick={handleCancelClick}
                    className="btn btn-link text-danger text-decoration-none fw-semibold p-0 align-items-center gap-2 d-none d-md-flex hover-opacity"
                  >
                    <XCircle size={18} /> Cancelar Turno
                  </button>
                ) : (
                  <div></div> // Spacer
                )}

                <div className="d-flex flex-column flex-md-row w-100 w-md-auto gap-2">
                  <button className="btn btn-light rounded-pill px-4 fw-semibold text-secondary d-none d-md-block border" onClick={onClose}>
                    Cerrar
                  </button>

                  {/* Botones de acción dinámicos según el estado del turno */}
                  {turnoData.estado === 'COORDINADO' && (
                    <>
                      <button onClick={() => onEditTurno(turnoData)} className="btn btn-white border border-secondary-subtle rounded-pill fw-semibold d-flex align-items-center justify-content-center gap-2 px-4 text-dark shadow-sm">
                        <CalendarClock size={16} /> Modificar Horario
                      </button>
                      <Button variant="primary" onClick={() => onChangeState(turnoData.idTurno, 'CONFIRMADO', turnoData)} className="rounded-pill px-5 shadow-sm d-flex align-items-center justify-content-center gap-2" style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}>
                        <CheckCircle size={18} /> Confirmar Turno
                      </Button>
                    </>
                  )}

                  {turnoData.estado === 'CONFIRMADO' && (
                    <>
                      <button onClick={() => onEditTurno(turnoData)} className="btn btn-white border border-secondary-subtle rounded-pill fw-semibold d-flex align-items-center justify-content-center gap-2 px-4 text-dark shadow-sm">
                        <CalendarClock size={16} /> Modificar Horario
                      </button>
                      <Button variant="info" onClick={() => onChangeState(turnoData.idTurno, 'EN_EJECUCION', turnoData)}>
                        <PlayCircle size={18} /> Iniciar Ejecución
                      </Button>
                    </>
                  )}

                  {turnoData.estado === 'EN_EJECUCION' && (
                    <Button variant="success" onClick={() => onChangeState(turnoData.idTurno, 'REALIZADO', turnoData)} className="rounded-pill px-5 shadow-sm d-flex align-items-center justify-content-center gap-2">
                      <CheckCircle size={18} /> Marcar como Realizado
                    </Button>
                  )}

                  {/* Mobile fallback cancelar */}
                  {isActivo && turnoData.estado !== 'EN_EJECUCION' && (
                    <button onClick={handleCancelClick} className="btn btn-danger bg-danger-subtle text-danger border-0 rounded-pill fw-semibold d-flex align-items-center justify-content-center gap-2 w-100 d-md-none mt-2">
                      <XCircle size={16} /> Cancelar Turno
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
