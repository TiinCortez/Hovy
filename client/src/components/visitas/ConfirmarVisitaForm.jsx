import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import VisitaService from '../../services/api/visita.service';
import { TIPOS_INMUEBLE, TIPOS_CLIENTE, getApiError } from './visitaUtils';

// Step of estado Contactada: confirm the physical visit data (creates client/property)
// embedded: rendered inside a modal (no Card wrapper nor title)
export default function ConfirmarVisitaForm({ visita, onDone, embedded = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const needsTipoCliente = !visita.id_cliente;

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      tipo_inmueble: '',
      superficie_total: visita.superficie_aproximada != null ? String(visita.superficie_aproximada) : '',
      provincia: visita.provincia || '',
      tipo_cliente: 'Casual',
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        tipo_inmueble: data.tipo_inmueble,
        superficie_total: Number(data.superficie_total),
        provincia: data.provincia.trim(),
      };
      if (needsTipoCliente) payload.tipo_cliente = data.tipo_cliente;
      await VisitaService.confirmar(visita.id_solicitud, payload);
      await onDone('Visita confirmada. Ya podés cargar los servicios.');
    } catch (err) {
      setErrorMessage(getApiError(err, 'No se pudo confirmar la visita.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const Wrapper = embedded ? 'div' : Card;
  const wrapperProps = embedded ? {} : { className: 'p-4' };

  return (
    <Wrapper {...wrapperProps}>
      {!embedded && <h5 className="fw-bold text-dark mb-1">Confirmar visita</h5>}
      <p className="text-secondary small mb-3">Completá los datos verificados en la visita. Se registrará el cliente y el inmueble.</p>

      {errorMessage && (
        <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3" role="alert">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span className="small fw-medium">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <label className="form-label small fw-bold text-secondary" htmlFor="confirmar-tipo-inmueble">Tipo de inmueble *</label>
            <select
              id="confirmar-tipo-inmueble"
              className={`form-select bg-light rounded-3 ${errors.tipo_inmueble ? 'is-invalid' : ''}`}
              {...register('tipo_inmueble', { required: 'Elegí el tipo de inmueble' })}
            >
              <option value="">Seleccionar...</option>
              {TIPOS_INMUEBLE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.tipo_inmueble && <span className="text-danger small mt-1 d-block">{errors.tipo_inmueble.message}</span>}
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small fw-bold text-secondary" htmlFor="confirmar-superficie">Superficie total (m²) *</label>
            <input
              id="confirmar-superficie"
              type="number"
              step="any"
              className={`form-control bg-light rounded-3 ${errors.superficie_total ? 'is-invalid' : ''}`}
              {...register('superficie_total', {
                required: 'La superficie es obligatoria',
                validate: (v) => Number(v) > 0 || 'Debe ser un número mayor a 0',
              })}
            />
            {errors.superficie_total && <span className="text-danger small mt-1 d-block">{errors.superficie_total.message}</span>}
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small fw-bold text-secondary" htmlFor="confirmar-provincia">Provincia *</label>
            <input
              id="confirmar-provincia"
              type="text"
              className={`form-control bg-light rounded-3 ${errors.provincia ? 'is-invalid' : ''}`}
              {...register('provincia', { validate: (v) => v.trim() !== '' || 'La provincia es obligatoria' })}
            />
            {errors.provincia && <span className="text-danger small mt-1 d-block">{errors.provincia.message}</span>}
          </div>
          {needsTipoCliente && (
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-secondary" htmlFor="confirmar-tipo-cliente">Tipo de cliente</label>
              <select id="confirmar-tipo-cliente" className="form-select bg-light rounded-3" {...register('tipo_cliente')}>
                {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>
        <Button type="submit" variant="primary" disabled={isSubmitting} style={{ backgroundColor: '#1B3006', borderColor: '#1B3006' }}>
          {isSubmitting ? 'Confirmando...' : 'Confirmar visita'}
        </Button>
      </form>
    </Wrapper>
  );
}
