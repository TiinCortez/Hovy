import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Building2, MapPin, Map, Maximize, Clock, Leaf, AlertCircle, Navigation } from 'lucide-react';
import Button from './Button';
import InmuebleService from '../../services/api/inmueble.service';

export default function InmuebleModal({ isOpen, onClose, inmuebleData, idCliente, onSaved }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const isEditMode = !!inmuebleData;

  const { register, handleSubmit, reset, formState: { errors, isValid, isSubmitted } } = useForm({
    defaultValues: {
      tipo_inmueble: 'Casa Habitada',
      provincia: 'Córdoba'
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        reset({
          direccion: inmuebleData.direccion || '',
          provincia: inmuebleData.provincia || 'Córdoba',
          barrio: inmuebleData.barrio || '',
          manzana: inmuebleData.manzana || '',
          lote: inmuebleData.lote || '',
          tipo_inmueble: inmuebleData.tipo_inmueble || 'Casa Habitada',
          superficie_total: inmuebleData.superficie_total || '',
          superficie_construida: inmuebleData.superficie_construida || '',
          superficie_mantenible: inmuebleData.superficie_mantenible || '',
          estado_vegetacion: inmuebleData.estado_vegetacion || '',
          altura_cesped_cm: inmuebleData.altura_cesped_cm || '',
          tiempo_promedio_min: inmuebleData.tiempo_promedio_min || '',
          latitud: inmuebleData.latitud || '',
          longitud: inmuebleData.longitud || ''
        });
      } else {
        reset({
          direccion: '',
          provincia: 'Córdoba',
          barrio: '',
          manzana: '',
          lote: '',
          tipo_inmueble: 'Casa Habitada',
          superficie_total: '',
          superficie_construida: '',
          superficie_mantenible: '',
          estado_vegetacion: '',
          altura_cesped_cm: '',
          tiempo_promedio_min: '',
          latitud: '',
          longitud: ''
        });
      }
    }
  }, [isOpen, inmuebleData, reset, isEditMode]);

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        ...data,
        id_cliente: idCliente,
        superficie_total: data.superficie_total ? Number(data.superficie_total) : null,
        superficie_construida: data.superficie_construida ? Number(data.superficie_construida) : null,
        superficie_mantenible: data.superficie_mantenible ? Number(data.superficie_mantenible) : null,
        altura_cesped_cm: data.altura_cesped_cm ? Number(data.altura_cesped_cm) : null,
        tiempo_promedio_min: data.tiempo_promedio_min ? Number(data.tiempo_promedio_min) : null,
        latitud: data.latitud ? String(data.latitud) : null,
        longitud: data.longitud ? String(data.longitud) : null,
      };

      let response;
      if (isEditMode) {
        response = await InmuebleService.update(inmuebleData.id_inmueble, payload);
      } else {
        response = await InmuebleService.create(payload);
      }

      onSaved(response.data);
      onClose();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Ocurrió un error al guardar el inmueble.';
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal d-block bg-dark bg-opacity-50 tab-index-1" style={{ zIndex: 1060, overflowY: 'auto' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg my-4">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4">
              {isEditMode ? 'Editar Inmueble' : 'Registrar Nuevo Inmueble'}
            </h5>
            <button type="button" className="btn-close shadow-none" onClick={onClose} />
          </div>

          <div className="modal-body p-4">
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-4">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}

            {!isValid && isSubmitted && (
              <div className="alert alert-warning d-flex align-items-center gap-2 rounded-3 mb-4">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">Revisa los campos marcados en rojo antes de continuar.</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} id="inmueble-form">
              
              {/* UBICACIÓN */}
              <p className="text-secondary fw-semibold small text-uppercase mb-3" style={{ letterSpacing: '0.05em' }}>
                Ubicación Principal
              </p>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-8">
                  <label className="form-label small fw-bold text-secondary">Dirección / Calle y Número *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-secondary"><MapPin size={16} /></span>
                    <input 
                      type="text" 
                      className={`form-control bg-light border-start-0 small ${errors.direccion ? 'is-invalid' : ''}`}
                      placeholder="Ej: Francisco N. de laprida 459"
                      {...register('direccion', { required: 'La dirección es obligatoria' })}
                    />
                  </div>
                  {errors.direccion && <div className="text-danger small mt-1">{errors.direccion.message}</div>}
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small fw-bold text-secondary">Provincia *</label>
                  <input 
                    type="text" 
                    className={`form-control bg-light small ${errors.provincia ? 'is-invalid' : ''}`}
                    {...register('provincia', { required: 'Provincia obligatoria' })}
                  />
                  {errors.provincia && <div className="text-danger small mt-1">{errors.provincia.message}</div>}
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Barrio</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-secondary"><Map size={16} /></span>
                    <input 
                      type="text" 
                      className="form-control bg-light border-start-0 small"
                      placeholder="Ej: Cerro de las Rosas"
                      {...register('barrio')}
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label small fw-bold text-secondary">Manzana</label>
                  <input type="text" className="form-control bg-light small" placeholder="Ej: 12" {...register('manzana')} />
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label small fw-bold text-secondary">Lote</label>
                  <input type="text" className="form-control bg-light small" placeholder="Ej: 4B" {...register('lote')} />
                </div>
              </div>

              {/* COORDENADAS GPS */}
              <div className="row g-3 mb-4 p-3 bg-light rounded-3 border">
                <p className="text-secondary fw-semibold small text-uppercase m-0 mb-2" style={{ letterSpacing: '0.05em' }}>
                  <Navigation size={14} className="me-1 d-inline" /> Coordenadas GPS (Opcional)
                </p>
                <div className="col-6">
                  <label className="form-label small fw-bold text-secondary">Latitud</label>
                  <input type="text" className="form-control bg-white small" placeholder="-31.41910110" {...register('latitud')} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-bold text-secondary">Longitud</label>
                  <input type="text" className="form-control bg-white small" placeholder="-64.20893510" {...register('longitud')} />
                </div>
                <div className="col-12 text-muted" style={{fontSize: '0.75rem'}}>Si se deja en blanco, el sistema intentará autocompletar utilizando la dirección ingresada.</div>
              </div>

              {/* CARACTERÍSTICAS Y MEDIDAS */}
              <p className="text-secondary fw-semibold small text-uppercase mb-3 pt-2 border-top" style={{ letterSpacing: '0.05em' }}>
                Características y Medidas
              </p>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-12">
                  <label className="form-label small fw-bold text-secondary">Tipo de Inmueble *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-secondary"><Building2 size={16} /></span>
                    <select 
                      className={`form-select bg-light border-start-0 small ${errors.tipo_inmueble ? 'is-invalid' : ''}`} 
                      {...register('tipo_inmueble', { required: 'Seleccione un tipo' })}
                    >
                      <option value="Casa Habitada">Casa Habitada</option>
                      <option value="Lote Vacio">Lote Vacio</option>
                    </select>
                  </div>
                  {errors.tipo_inmueble && <div className="text-danger small mt-1">{errors.tipo_inmueble.message}</div>}
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-bold text-secondary">Sup. Total (m²)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-secondary"><Maximize size={16} /></span>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control bg-light border-start-0 small" 
                      placeholder="Ej: 450.00"
                      {...register('superficie_total', { min: { value: 1, message: 'Debe ser > 0'} })} 
                    />
                  </div>
                  {errors.superficie_total && <div className="text-danger small mt-1">{errors.superficie_total.message}</div>}
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label small fw-bold text-secondary">Sup. Construida</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control bg-light small" 
                    placeholder="Ej: 180.00"
                    {...register('superficie_construida', { min: { value: 0, message: 'Inválido'} })} 
                  />
                  {errors.superficie_construida && <div className="text-danger small mt-1">{errors.superficie_construida.message}</div>}
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label small fw-bold text-success">Sup. Mantenible</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control bg-success-subtle border-success-subtle text-success small" 
                    placeholder="Auto (Calculado)"
                    {...register('superficie_mantenible')} 
                  />
                </div>
              </div>

              {/* CONDICIONES OPERATIVAS */}
              <p className="text-secondary fw-semibold small text-uppercase mb-3 pt-2 border-top" style={{ letterSpacing: '0.05em' }}>
                Condiciones Operativas
              </p>

              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-bold text-secondary">Estado Vegetación</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-secondary"><Leaf size={16} /></span>
                    <select className="form-select bg-light border-start-0 small" {...register('estado_vegetacion')}>
                      <option value="">Seleccione...</option>
                      <option value="Bajo">Bajo</option>
                      <option value="Medio">Medio</option>
                      <option value="Alto">Alto</option>
                    </select>
                  </div>
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label small fw-bold text-secondary">Altura Césped (cm)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control bg-light small" 
                    placeholder="Ej: 15.50"
                    {...register('altura_cesped_cm')} 
                  />
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label small fw-bold text-secondary">Tiempo Est. (min)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-secondary"><Clock size={16} /></span>
                    <input 
                      type="number" 
                      className="form-control bg-light border-start-0 small" 
                      placeholder="Ej: 45" 
                      {...register('tiempo_promedio_min', { min: { value: 1, message: 'Debe ser > 0'} })} 
                    />
                  </div>
                  {errors.tiempo_promedio_min && <div className="text-danger small mt-1">{errors.tiempo_promedio_min.message}</div>}
                </div>
              </div>

            </form>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4 d-flex justify-content-end">
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary border" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </button>
              <Button type="submit" form="inmueble-form" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Inmueble'}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}