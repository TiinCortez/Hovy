import { 
  User, Map, Copy,
  ClipboardList, CalendarDays, CheckCircle, XCircle, CalendarClock, MapPin, PlayCircle
} from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import { formatearHorarioTurno } from './agendaTurnos';

export default function TurnoDetalleModal({ isOpen, onClose, turnoData, onCancelTurno, onEditTurno, onChangeState }) {
  if (!isOpen || !turnoData) return null;

  const cliente = turnoData.cliente || {};
  const inmueble = turnoData.inmueble || {};
  const servicio = turnoData.servicio || {};
  const franja = turnoData.franjaHoraria || {};
  
  const isCancelado = turnoData.estado === 'CANCELADO';
  const isRealizado = turnoData.estado === 'REALIZADO';
  const isActivo = !isCancelado && !isRealizado;

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
          
          <div className="modal-header border-bottom-0 pb-2 pt-4 px-4 align-items-start">
            <div>
              <h4 className="modal-title fw-bold text-dark mb-2">Detalle del Turno #{turnoData.idTurno || 'TU-000'}</h4>
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

          <div className="modal-body p-4 bg-white">
            <div className="row g-4">
              <div className="col-12 col-lg-6">
                <div className="border border-light-subtle rounded-4 p-4 h-100 shadow-sm d-flex flex-column bg-white">
                  <h6 className="text-secondary fw-bold small text-uppercase d-flex align-items-center gap-2 mb-3" style={{ letterSpacing: '0.05em' }}>
                    <User size={16} /> Cliente e Inmueble
                  </h6>
                  
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="fw-bold text-dark m-0 fs-5 pe-2">{cliente.nombre} {cliente.apellido}</h5>
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
                  </div>

                  <div className="d-flex flex-wrap gap-2 mb-4 mt-auto">
                    <button onClick={handleOpenMaps} className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-2 fw-semibold px-3">

                    <Map size={14} />
                    Abrir en Maps
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
                  <h5 className="fw-bold text-dark m-0 fs-5 mb-2">{servicio.descripcion || 'Mantenimiento General'}</h5>
                  
                  <hr className="text-light-subtle my-2" />

                  <div className="my-3">
                    <span className="text-secondary small d-block mb-2">Fecha y Franja Asignada:</span>
                    <strong className="text-dark d-flex align-items-center gap-2 mb-1">
                      <CalendarDays size={18} className="text-success" /> 
                      {franja.fecha || turnoData.fechaAsignada} · {formatearHorarioTurno(turnoData)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
            
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
          </div>
          
        </div>
      </div>
    </div>
  );
}
