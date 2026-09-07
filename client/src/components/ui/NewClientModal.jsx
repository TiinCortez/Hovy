import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {User, Phone, Mail, FileText, Building, MapPin, AlertCircle} from 'lucide-react';
import Button from './Button';
import { supabase } from '../../services/supaBaseClient';

export default function NewClientModal({ isOpen, onClose, onClientCreated }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      tipo_cliente: 'Casual'
    }
  });

  if (!isOpen) return null;

  // Función para normalizar teléfono según la lógica del sistema
  const normalizarTelefonoLocal = (val) => {
    let digitos = String(val).replace(/\D/g, '');
    if (digitos.startsWith('00')) digitos = digitos.slice(2);
    if (digitos.startsWith('54')) {
      digitos = digitos.slice(2);
      if (digitos.startsWith('9')) digitos = digitos.slice(1);
    }
    if (digitos.startsWith('0')) digitos = digitos.slice(1);
    
    if (digitos.length !== 10) return null;
    return `549${digitos}`;
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const telefonoNormalizado = normalizarTelefonoLocal(data.telefono);

      if (!telefonoNormalizado) {
        setErrorMessage('Teléfono inválido. Ingrese características + número sin 0 ni 15 (ej: 3514330429).');
        setIsSubmitting(false);
        return;
      }

      // Inserción directa en la tabla 'clientes' de Supabase
      const { data: createdClient, error } = await supabase
        .from('clientes')
        .insert([{
          nombre: data.nombre.trim(),
          apellido: data.apellido.trim(),
          telefono: telefonoNormalizado,
          tipo_cliente: data.tipo_cliente,
          email: data.email ? data.email.trim() : null,
          domicilio_fiscal: data.domicilio_fiscal ? data.domicilio_fiscal.trim() : null,
          cuit_cuil: data.cuit_cuil ? data.cuit_cuil.trim() : null,
          razon_social: data.razon_social ? data.razon_social.trim() : null,
          calificacion_promedio: 0
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya existe un cliente registrado con ese número de teléfono.');
        }
        throw new Error(error.message || 'Ocurrió un error al guardar el cliente.');
      }

      reset();
      onClientCreated(createdClient);
      onClose();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal d-block bg-dark bg-opacity-50 tab-index-1" style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          
          {/* Header */}
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4">Registrar Nuevo Cliente</h5>
            <button 
              type="button" 
              className="btn-close shadow-none" 
              onClick={() => { reset(); setErrorMessage(null); onClose(); }} 
            />
          </div>

          {/* Body */}
          <div className="modal-body p-4">
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-4">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} id="new-client-form">
              
              {/* Información Personal */}
              <p className="text-secondary fw-semibold small text-uppercase mb-3" style={{ letterSpacing: '0.05em' }}>
                Información del Contacto
              </p>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Nombre *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary">
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      className={`form-control bg-light border-start-0 rounded-end-3 small ${errors.nombre ? 'is-invalid' : ''}`}
                      placeholder="Ej: Juan"
                      {...register('nombre', { required: 'El nombre es obligatorio' })}
                    />
                  </div>
                  {errors.nombre && <span className="text-danger small mt-1 d-block">{errors.nombre.message}</span>}
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Apellido *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary">
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      className={`form-control bg-light border-start-0 rounded-end-3 small ${errors.apellido ? 'is-invalid' : ''}`}
                      placeholder="Ej: Pérez"
                      {...register('apellido', { required: 'El apellido es obligatorio' })}
                    />
                  </div>
                  {errors.apellido && <span className="text-danger small mt-1 d-block">{errors.apellido.message}</span>}
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Teléfono Celular *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary">
                      <Phone size={16} />
                    </span>
                    <input
                      type="text"
                      className={`form-control bg-light border-start-0 rounded-end-3 small ${errors.telefono ? 'is-invalid' : ''}`}
                      placeholder="Ej: 3514330429"
                      {...register('telefono', { 
                        required: 'El teléfono es obligatorio',
                        pattern: {
                          value: /^[0-9\s\-+]+$/,
                          message: 'Ingrese solo números'
                        }
                      })}
                    />
                  </div>
                  {errors.telefono && <span className="text-danger small mt-1 d-block">{errors.telefono.message}</span>}
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>Sin 0 ni 15. Incluir código de área.</span>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Tipo de Cliente *</label>
                  <select
                    className="form-select bg-light border rounded-3 small"
                    {...register('tipo_cliente', { required: true })}
                  >
                    <option value="Casual">Casual</option>
                    <option value="Fijo">Fijo</option>
                    <option value="Empresa">Empresa</option>
                  </select>
                </div>
              </div>

              {/* Información Adicional / Facturación */}
              <p className="text-secondary fw-semibold small text-uppercase mb-3 pt-2 border-top" style={{ letterSpacing: '0.05em' }}>
                Datos de Facturación y Contacto (Opcional)
              </p>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Correo Electrónico</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary">
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      className="form-control bg-light border-start-0 rounded-end-3 small"
                      placeholder="ejemplo@correo.com"
                      {...register('email')}
                    />
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Domicilio Fiscal</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary">
                      <MapPin size={16} />
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-start-0 rounded-end-3 small"
                      placeholder="Calle y Número, Ciudad"
                      {...register('domicilio_fiscal')}
                    />
                  </div>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">CUIT / CUIL</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary">
                      <FileText size={16} />
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-start-0 rounded-end-3 small"
                      placeholder="20-12345678-9"
                      {...register('cuit_cuil')}
                    />
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Razón Social</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary">
                      <Building size={16} />
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-start-0 rounded-end-3 small"
                      placeholder="Razón Social S.A."
                      {...register('razon_social')}
                    />
                  </div>
                </div>
              </div>

            </form>
          </div>

          {/* Footer */}
          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button 
              type="button" 
              className="btn btn-light rounded-pill px-4 fw-semibold text-secondary"
              onClick={() => { reset(); setErrorMessage(null); onClose(); }}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <Button 
              type="submit" 
              form="new-client-form" 
              variant="primary" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}