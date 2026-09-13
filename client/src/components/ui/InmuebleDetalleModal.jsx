import { MapPin, Maximize, Clock, Leaf, Trash2, Edit2, Navigation, Home, Grid } from 'lucide-react';
import Button from './Button';

export default function InmuebleDetalleModal({ isOpen, onClose, inmuebleData, onEdit, onDelete }) {
  if (!isOpen || !inmuebleData) return null;

  // Imagen por defecto si el inmueble no tiene una cargada
  const defaultImg = inmuebleData.tipo_inmueble === 'Lote Vacio' ? '/Lote.webp' : '/Habitada.webp';
  const bgImage = inmuebleData.img || defaultImg;

  const handleOpenMap = () => {
    if (inmuebleData.latitud && inmuebleData.longitud) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${inmuebleData.latitud},${inmuebleData.longitud}`, '_blank');
    }
  };

  // Color de punto de Estado Vegetación
  const estadoVeg = inmuebleData.estado_vegetacion || 'Sin Dato';
  const dotClass = estadoVeg === 'Alto' ? 'bg-danger' : 
                   estadoVeg === 'Medio' ? 'bg-warning' : 
                   estadoVeg === 'Bajo' || estadoVeg === 'Controlado' ? 'bg-success' : 
                   'bg-secondary';

  return (
    <div className="modal d-block bg-dark bg-opacity-50 tab-index-1" style={{ zIndex: 1060, overflowY: 'auto' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg my-4">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
          
          {/* HEADER */}
          <div className="modal-header border-bottom-0 pb-3 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-5 d-flex align-items-center gap-2">
              <div className="p-2 bg-success-subtle rounded-3 d-flex align-items-center justify-content-center">
                <Home size={18} className="text-success" /> 
              </div>
              Detalle del Inmueble
            </h5>
            <button type="button" className="btn-close shadow-none" onClick={onClose} />
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
              <div className="position-absolute top-0 end-0 p-3">
                <span className="badge bg-white bg-opacity-75 text-dark rounded-pill px-3 py-2 d-flex align-items-center gap-2 shadow-sm fw-semibold" style={{ backdropFilter: 'blur(4px)' }}>
                  <Grid size={14} className="text-secondary" /> Manzana {inmuebleData.manzana || '-'} • Lote {inmuebleData.lote || '-'}
                </span>
              </div>
              <div className="position-absolute bottom-0 start-0 p-3 w-100">
                <span className="badge bg-dark bg-opacity-75 text-white rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2 text-truncate border border-secondary border-opacity-25" style={{ backdropFilter: 'blur(4px)', maxWidth: '90%' }}>
                  <MapPin size={14} className="flex-shrink-0" /> {inmuebleData.direccion} • {inmuebleData.provincia}
                </span>
              </div>
            </div>

            {/* UBICACIÓN Y CATASTRO */}
            <div className="mb-4">
              <h6 className="text-secondary fw-bold small text-uppercase mb-3 d-flex align-items-center gap-2" style={{ letterSpacing: '0.05em' }}>
                <MapPin size={16} /> Ubicación y Catastro
              </h6>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Dirección</span>
                    <span className="fw-bold text-dark text-truncate d-block">{inmuebleData.direccion || 'Sin registro'}</span>
                    <span className="text-secondary small d-block">{inmuebleData.provincia}, Argentina</span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Barrio</span>
                    <span className="fw-bold text-dark d-block text-truncate">{inmuebleData.barrio || 'No especificado'}</span>
                    {!inmuebleData.barrio && <span className="text-secondary small d-block">Sin registro</span>}
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Manzana y Lote</span>
                    <span className="fw-bold text-dark d-block">Mz {inmuebleData.manzana || '-'} | Lote {inmuebleData.lote || '-'}</span>
                    <span className="text-secondary small d-block text-truncate">Tipo: {inmuebleData.tipo_inmueble || '-'}</span>
                  </div>
                </div>
              </div>
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

            {/* CONDICIÓN Y TIEMPOS */}
            <div className="mb-4">
              <h6 className="text-secondary fw-bold small text-uppercase mb-3 d-flex align-items-center gap-2" style={{ letterSpacing: '0.05em' }}>
                <Leaf size={16} /> Condición y Tiempos
              </h6>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Estado de Vegetación</span>
                    <div className="fw-bold text-dark d-flex align-items-center gap-2 mt-2">
                      <div className={`rounded-circle ${dotClass}`} style={{width: 10, height: 10}}></div>
                      {estadoVeg}
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Altura de Césped</span>
                    <div className="fw-bold text-dark d-flex align-items-center flex-wrap gap-2 mt-1">
                      {inmuebleData.altura_cesped_cm || '0.00'} cm
                      {Number(inmuebleData.altura_cesped_cm) > 10 && (
                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill">Corte</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                    <span className="text-secondary d-block small mb-1">Tiempo Promedio Servicio</span>
                    <div className="fw-bold text-dark d-flex align-items-center gap-2 mt-2">
                      <Clock size={16} className="text-secondary" />
                      {inmuebleData.tiempo_promedio_min || '0'} min
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COORDENADAS GPS */}
            <div className="p-3 bg-light rounded-4 border border-light-subtle d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-white p-2 rounded-circle border shadow-sm text-secondary">
                  <MapPin size={20} />
                </div>
                <div>
                  <span className="text-dark fw-bold small d-block">Coordenadas GPS (Provincia: {inmuebleData.provincia || 'N/A'})</span>
                  <span className="text-secondary small font-monospace">Lat: {inmuebleData.latitud || 'N/A'} | Long: {inmuebleData.longitud || 'N/A'}</span>
                </div>
              </div>
              <button 
                onClick={handleOpenMap} 
                disabled={!inmuebleData.latitud || !inmuebleData.longitud} 
                className="btn btn-sm btn-light border shadow-sm fw-semibold text-dark px-3 py-2 d-flex align-items-center gap-2 rounded-3 bg-white"
              >
                <Navigation size={16} /> Abrir en Mapa
              </button>
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