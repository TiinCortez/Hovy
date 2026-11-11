import { useState, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Building2, MapPin, Map, Maximize, AlertCircle, Search } from 'lucide-react';
import Button from './Button';
import CloseButton from './CloseButton';
import InmuebleMapa from './InmuebleMapa';
import { obtenerCoordenadas } from './inmuebleUbicacion';
import InmuebleService from '../../services/api/inmueble.service';

const PROVINCIAS_ARG = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires", 
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", 
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", 
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

export default function InmuebleModal({ isOpen, onClose, inmuebleData, idCliente, onSaved }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const errorRef = useRef(null);
  const geocodeRequestRef = useRef(null);

  const isEditMode = !!inmuebleData;

  // Extraemos 'control' en lugar de 'watch'
  const { register, handleSubmit, reset, formState: { errors }, setValue, getValues, setError, clearErrors, setFocus, control } = useForm({
    defaultValues: {
      tipo_inmueble: 'Casa Habitada',
      provincia: 'Córdoba',
      localidad: 'Córdoba Capital'
    }
  });

  // Usamos el hook useWatch (recomendado por React Hook Form para evitar problemas de memoización)
  const supTotal = useWatch({ control, name: 'superficie_total' }) || 0;
  const supConstruida = useWatch({ control, name: 'superficie_construida' }) || 0;
  const supMantenibleCalculada = Math.max(0, parseFloat(supTotal) - parseFloat(supConstruida)).toFixed(2);
  const [latitud, longitud] = useWatch({ control, name: ['latitud', 'longitud'] });
  const posicion = obtenerCoordenadas(latitud, longitud);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        reset({
          direccion: inmuebleData.direccion || '',
          provincia: inmuebleData.provincia || 'Córdoba',
          localidad: 'Córdoba Capital',
          barrio: inmuebleData.barrio || '',
          manzana: inmuebleData.manzana || '',
          lote: inmuebleData.lote || '',
          tipo_inmueble: inmuebleData.tipo_inmueble || 'Casa Habitada',
          superficie_total: inmuebleData.superficie_total ?? '',
          superficie_construida: inmuebleData.superficie_construida ?? '',
          latitud: inmuebleData.latitud ?? '',
          longitud: inmuebleData.longitud ?? ''
        });
      } else {
        reset({
          direccion: '',
          provincia: 'Córdoba',
          localidad: 'Córdoba Capital',
          barrio: '',
          manzana: '',
          lote: '',
          tipo_inmueble: 'Casa Habitada',
          superficie_total: '',
          superficie_construida: '',
          latitud: '',
          longitud: ''
        });
      }
    }
    return () => geocodeRequestRef.current?.abort();
  }, [isOpen, inmuebleData, reset, isEditMode]);

  // Los errores que no son de un campo (conexión, servidor) se muestran arriba: llevamos la vista hasta ahí
  useEffect(() => {
    if (errorMessage) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [errorMessage]);

  if (!isOpen) return null;

  const handleUbicacionChange = ({ lat, lng }) => {
    geocodeRequestRef.current?.abort();
    clearErrors('root.ubicacion');
    setValue('latitud', lat.toFixed(6), { shouldDirty: true });
    setValue('longitud', lng.toFixed(6), { shouldDirty: true });
  };

  const handleGeocode = async () => {
    const dir = getValues('direccion')?.trim();
    const loc = getValues('localidad')?.trim();
    const prov = getValues('provincia');
    const barrio = getValues('barrio')?.trim();
    
    if (!dir) {
      setError('direccion', { type: 'required', message: 'Ingresá una dirección para buscarla en el mapa' });
      setFocus('direccion');
      return;
    }

    geocodeRequestRef.current?.abort();
    const request = new AbortController();
    geocodeRequestRef.current = request;
    clearErrors(['direccion', 'root.ubicacion']);
    setIsGeocoding(true);
    try {
      const query = [dir, barrio, loc, prov, 'Argentina'].filter(Boolean).join(', ');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=${encodeURIComponent(query)}`, { signal: request.signal });
      if (!res.ok) throw new Error('No se pudo consultar la dirección. Intentá nuevamente.');
      const data = await res.json();
      if (request.signal.aborted) return;
      const coordenadas = obtenerCoordenadas(data?.[0]?.lat, data?.[0]?.lon);

      if (coordenadas) {
        setValue('latitud', String(coordenadas[0]), { shouldDirty: true });
        setValue('longitud', String(coordenadas[1]), { shouldDirty: true });
      } else {
        setError('root.ubicacion', { type: 'geocode', message: 'No encontramos esa dirección. Revisá los datos o marcá la ubicación directamente en el mapa.' });
      }
    } catch (error) {
      if (!request.signal.aborted) {
        setError('root.ubicacion', { type: 'geocode', message: error.message === 'Failed to fetch' ? 'No se pudo conectar con el buscador. Podés marcar la ubicación en el mapa.' : error.message });
      }
    } finally {
      if (geocodeRequestRef.current === request) {
        geocodeRequestRef.current = null;
        setIsGeocoding(false);
      }
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const coordenadas = obtenerCoordenadas(data.latitud, data.longitud);
      const payload = {
        direccion: data.direccion.trim(),
        provincia: data.provincia,
        barrio: data.barrio.trim(),
        manzana: data.manzana?.trim() || null,
        lote: data.lote?.trim() || null,
        tipo_inmueble: data.tipo_inmueble,
        id_cliente: idCliente,
        superficie_total: data.superficie_total ? Number(data.superficie_total) : null,
        superficie_construida: data.superficie_construida ? Number(data.superficie_construida) : null,
        superficie_mantenible: Number(supMantenibleCalculada),
        latitud: coordenadas ? String(coordenadas[0]) : null,
        longitud: coordenadas ? String(coordenadas[1]) : null,
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
      // Si el backend rechaza las superficies, se marca el campo en vez de mostrar un aviso general
      if (errorMsg.includes('superficie construida')) {
        setError('superficie_construida', { type: 'server', message: 'No puede ser mayor a la superficie total' });
        setFocus('superficie_construida');
      } else {
        setErrorMessage(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal d-block bg-dark bg-opacity-50 tab-index-1" style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          
          <div className="modal-header justify-content-between align-items-start border-bottom-0 pb-0 pt-4 px-4 flex-shrink-0">
            <h5 className="modal-title fw-bold text-dark fs-4">
              {isEditMode ? 'Editar Inmueble' : 'Registrar Nuevo Inmueble'}
            </h5>
            <CloseButton label="Cerrar formulario de inmueble" onClick={onClose} />
          </div>

          <div className="modal-body p-4">
            {errorMessage && (
              <div ref={errorRef} className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-4">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} id="inmueble-form">
              
              <p className="text-secondary fw-semibold small text-uppercase mb-3" style={{ letterSpacing: '0.05em' }}>
                Ubicación Principal
              </p>

              <div className="row g-3 mb-3">
                <div className="col-12">
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
              </div>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Provincia *</label>
                  <select 
                    className={`form-select bg-light small ${errors.provincia ? 'is-invalid' : ''}`}
                    {...register('provincia', { required: 'Provincia obligatoria' })}
                  >
                    <option value="">Seleccione...</option>
                    {PROVINCIAS_ARG.map(prov => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                  {errors.provincia && <div className="text-danger small mt-1">{errors.provincia.message}</div>}
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Ciudad/Localidad</label>
                  <input 
                    type="text" 
                    className="form-control bg-light small border-primary-subtle"
                    placeholder="Ej: Córdoba Capital, San Francisco..."
                    {...register('localidad')}
                  />
                  <div className="form-text" style={{fontSize: '0.7rem'}}>Dato usado solo para ayudar al GPS.</div>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-12">
                  <label className="form-label small fw-bold text-secondary">Barrio *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-secondary"><Map size={16} /></span>
                    <input 
                      type="text" 
                      className={`form-control bg-light border-start-0 small ${errors.barrio ? 'is-invalid' : ''}`}
                      placeholder="Ej: Cerro de las Rosas"
                      {...register('barrio', { required: 'El barrio es obligatorio' })}
                    />
                  </div>
                  {errors.barrio && <div className="text-danger small mt-1">{errors.barrio.message}</div>}
                </div>

              </div>

              <details key={`${inmuebleData?.id_inmueble ?? 'nuevo'}-${isOpen}`} className="mb-4 p-3 bg-light rounded-3 border" open={Boolean(inmuebleData?.manzana || inmuebleData?.lote)}>
                <summary className="small fw-semibold text-secondary">Referencias adicionales (opcional)</summary>
                <div className="row g-3 mt-0">
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-bold text-secondary">Manzana</label>
                    <input type="text" className="form-control bg-white small" placeholder="Ej: 12" {...register('manzana')} />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-bold text-secondary">Lote</label>
                    <input type="text" className="form-control bg-white small" placeholder="Ej: 4B" {...register('lote')} />
                  </div>
                </div>
              </details>

              <div className="mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <p className="text-secondary fw-semibold small text-uppercase m-0" style={{ letterSpacing: '0.05em' }}>Ubicación en el mapa (opcional)</p>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    onClick={handleGeocode}
                    disabled={isGeocoding || isSubmitting}
                  >
                    {isGeocoding ? 'Buscando...' : <><Search size={14} /> Buscar dirección</>}
                  </button>
                </div>
                <p className="small text-secondary mb-2">Buscá la dirección y verificá el punto. Podés tocar el mapa o arrastrar el marcador para ajustarlo.</p>
                {errors.root?.ubicacion && <div className="alert alert-warning small py-2" role="alert">{errors.root.ubicacion.message}</div>}
                <input type="hidden" {...register('latitud')} />
                <input type="hidden" {...register('longitud')} />
                <InmuebleMapa posicion={posicion} onChange={isSubmitting ? undefined : handleUbicacionChange} />
                <p className={`small mt-2 mb-0 ${posicion ? 'text-success' : 'text-secondary'}`} aria-live="polite">
                  {posicion ? 'Ubicación marcada. Se guardará al guardar el inmueble.' : 'Todavía no hay una ubicación marcada.'}
                </p>
              </div>

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

              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-bold text-secondary">Sup. Total (m²) *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-secondary"><Maximize size={16} /></span>
                    <input 
                      type="number" 
                      step="0.01" 
                      className={`form-control bg-light border-start-0 small ${errors.superficie_total ? 'is-invalid' : ''}`}
                      placeholder="Ej: 450.00"
                      {...register('superficie_total', { required: 'La superficie total es obligatoria', min: { value: 1, message: 'Debe ser > 0'}, deps: ['superficie_construida'] })} 
                    />
                  </div>
                  {errors.superficie_total && <div className="text-danger small mt-1">{errors.superficie_total.message}</div>}
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label small fw-bold text-secondary">Sup. Construida</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className={`form-control bg-light small ${errors.superficie_construida ? 'is-invalid' : ''}`}
                    placeholder="Ej: 180.00"
                    {...register('superficie_construida', {
                      min: { value: 0, message: 'Inválido'},
                      // Mismo control que hace el backend: la construida no puede superar a la total
                      validate: (valor, valores) => {
                        if (valor === '' || valor == null) return true;
                        if (valores.superficie_total === '' || valores.superficie_total == null) return 'Cargá primero la superficie total';
                        return Number(valor) <= Number(valores.superficie_total) || 'No puede ser mayor a la superficie total';
                      }
                    })} 
                  />
                  {errors.superficie_construida && <div className="text-danger small mt-1">{errors.superficie_construida.message}</div>}
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label small fw-bold text-success">Sup. Mantenible (Verde)</label>
                  <div className="form-control bg-success-subtle border-success-subtle d-flex align-items-center" style={{ height: '38px' }}>
                    <span className="fw-bold text-success w-100">{supMantenibleCalculada} m²</span>
                  </div>
                </div>
              </div>

            </form>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4 d-flex justify-content-end flex-shrink-0">
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary border" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </button>
              <Button type="submit" form="inmueble-form" variant="primary" disabled={isSubmitting || isGeocoding}>
                {isSubmitting ? 'Guardando...' : 'Guardar Inmueble'}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
