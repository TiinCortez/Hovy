import { MapPin, Maximize, Trash2, Edit2, Navigation, Home } from 'lucide-react';
import Button from './Button';
import CloseButton from './CloseButton';
import InmuebleMapa from './InmuebleMapa';
import { obtenerCoordenadas } from './inmuebleUbicacion';

export default function InmuebleDetalleModal({ isOpen, onClose, inmuebleData, onEdit, onDelete }) {
  if (!isOpen || !inmuebleData) return null;

  // Imagen por defecto si el inmueble no tiene una cargada
  const defaultImg = inmuebleData.tipo_inmueble === 'Lote Vacio' ? '/Lote.webp' : '/Habitada.webp';
  const bgImage = inmuebleData.img || defaultImg;
  const posicion = obtenerCoordenadas(inmuebleData.latitud, inmuebleData.longitud);
  const manzana = String(inmuebleData.manzana ?? '').trim();
  const lote = String(inmuebleData.lote ?? '').trim();

  const handleOpenMap = () => {
    if (posicion) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${posicion.join(',')}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="modal d-block bg-dark bg-opacity-50 tab-index-1" style={{ zIndex: 1060, overflowY: 'auto' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg my-4">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
          
          {/* HEADER */}
          <div className="modal-header justify-content-between align-items-start border-bottom-0 pb-3 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-5 d-flex align-items-center gap-2">
              <div className="p-2 bg-success-subtle rounded-3 d-flex align-items-center justify-content-center flex-shrink-0">
                <Home size={18} className="text-success" /> 
              </div>
              Detalle del Inmueble
            </h5>
            <CloseButton label="Cerrar detalle del inmueble" onClick={onClose} />
          </div>

          <div className="modal-body p-4 pt-0">
            {/* HERO BANNER CON IMAGEN */}
            <div 
              className="position-relative w-100 rounded-4 overflow-hidden mb-4 shadow-sm" 
              style={{ height: '220px', backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-25"></div>
              <div className="position-absolute top-0 start-0 p-3">
                <span className="badge bg-dark bg-opacity-75 text-white rounded-pill px-3 py-2 d-flex align-items-center gap-2 border border-secondary border-opacity-25" style={{ backdropFilter: 'blur(4px)' }}>
                  <Home size={14} /> {inmuebleData.tipo_inmueble || 'Sin tipo'}
                </span>
              </div>
              <div className="position-absolute bottom-0 start-0 p-3 w-100">
                <span className="badge bg-dark bg-opacity-75 text-white rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2 text-truncate border border-secondary border-opacity-25" style={{ backdropFilter: 'blur(4px)', maxWidth: '90%' }}>
                  <MapPin size={14} className="flex-shrink-0" /> {inmuebleData.direccion} • {inmuebleData.provincia}
                </span>
              </div>
            </div>

            {/* UBICACIÓN */}
            <div className="mb-4">
              <h6 className="text-secondary fw-bold small text-uppercase mb-3 d-flex align-items-center gap-2" style={{ letterSpacing: '0.05em' }}>
                <MapPin size={16} /> Ubicación
              </h6>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Dirección</span>
                    <span className="fw-bold text-dark text-break d-block">{inmuebleData.direccion || 'Sin registro'}</span>
                    <span className="text-secondary small d-block">{inmuebleData.provincia}, Argentina</span>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Barrio</span>
                    <span className="fw-bold text-dark d-block text-break">{inmuebleData.barrio || 'No especificado'}</span>
                    {!inmuebleData.barrio && <span className="text-secondary small d-block">Sin registro</span>}
                  </div>
                </div>
              </div>
              {(manzana || lote) && (
                <div className="p-3 mt-3 bg-light rounded-4 border border-light-subtle">
                  <span className="text-secondary d-block small mb-1">Referencias adicionales</span>
                  <div className="d-flex flex-wrap gap-3 fw-bold text-dark small">
                    {manzana && <span className="text-break">Manzana: {manzana}</span>}
                    {lote && <span className="text-break">Lote: {lote}</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <h6 className="text-secondary fw-bold small text-uppercase m-0 d-flex align-items-center gap-2" style={{ letterSpacing: '0.05em' }}>
                  <MapPin size={16} /> Ubicación en el mapa
                </h6>
                <button type="button" onClick={handleOpenMap} disabled={!posicion} className="btn btn-sm btn-light border d-flex align-items-center gap-2">
                  <Navigation size={16} /> Abrir en Mapa
                </button>
              </div>
              <InmuebleMapa posicion={posicion} />
              {!posicion && <p className="small text-secondary mt-2 mb-0">Este inmueble todavía no tiene una ubicación marcada. Podés agregarla desde Editar Inmueble.</p>}
            </div>

            {/* SUPERFICIES */}
            <div className="mb-4">
              <h6 className="text-secondary fw-bold small text-uppercase mb-3 d-flex align-items-center gap-2" style={{ letterSpacing: '0.05em' }}>
                <Maximize size={16} /> Superficies
              </h6>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Superficie Total</span>
                    <div className="fs-4 fw-bold text-dark">{inmuebleData.superficie_total || '0.00'} <span className="fs-6 fw-normal text-secondary">m²</span></div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Superficie Construida</span>
                    <div className="fs-4 fw-bold text-dark">{inmuebleData.superficie_construida || '0.00'} <span className="fs-6 fw-normal text-secondary">m²</span></div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-success-subtle rounded-4 h-100 border border-success-subtle">
                    <span className="text-success d-block small mb-1 fw-bold">Superficie Mantenible (Verde)</span>
                    <div className="fs-4 fw-bold text-success">{inmuebleData.superficie_mantenible || '0.00'} <span className="fs-6 fw-normal">m²</span></div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* FOOTER */}
          <div className="modal-footer border-top-0 pt-0 pb-4 px-4 bg-white d-flex justify-content-between align-items-center">
            <button 
              type="button" 
              className="btn btn-link text-danger text-decoration-none fw-semibold p-0 d-flex align-items-center gap-2" 
              onClick={() => { onClose(); onDelete(inmuebleData); }}
            >
              <Trash2 size={18} /> Eliminar Inmueble
            </button>
            <div className="d-flex gap-2">
              <button 
                type="button" 
                className="btn btn-light rounded-pill px-4 fw-semibold text-secondary border shadow-sm bg-white" 
                onClick={onClose}
              >
                Cerrar
              </button>
              <Button 
                variant="primary" 
                className="rounded-pill px-4 shadow-sm d-flex align-items-center gap-2" 
                style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}} 
                onClick={() => { onClose(); onEdit(inmuebleData); }}
              >
                <Edit2 size={16} /> Editar Inmueble
              </Button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
