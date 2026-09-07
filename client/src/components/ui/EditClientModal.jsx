import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { User, Phone, Mail, FileText, Building, MapPin, AlertCircle } from 'lucide-react';
import Button from './Button';
import { supabase } from '../../services/supaBaseClient';

export default function EditClientModal({ isOpen, onClose, clientData, onClientUpdated }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  // Precargar los datos del cliente cuando se abre el modal
  useEffect(() => {
    if (isOpen && clientData) {
      reset({
        nombre: clientData.nombre || '',
        apellido: clientData.apellido || '',
        telefono: clientData.telefono || '',
        tipo_cliente: clientData.tipo_cliente || 'Casual',
        email: clientData.email || '',
        domicilio_fiscal: clientData.domicilio_fiscal || '',
        cuit_cuil: clientData.cuit_cuil || '',
        razon_social: clientData.razon_social || ''
      });
    }
  }, [isOpen, clientData, reset]);

  if (!isOpen) return null;

  const normalizarTelefonoLocal = (val) => {
    let digitos = String(val).replace(/\D/g, '');
    if (digitos.startsWith('00')) digitos = digitos.slice(2);
    if (digitos.startsWith('54')) {
      digitos = digitos.slice(2);
      if (digitos.startsWith('9')) digitos = digitos.slice(1);
    }
    if (digitos.startsWith('0')) digitos = digitos.slice(1);
    return digitos.length === 10 ? `549${digitos}` : digitos; 
    // Para simplificar la edición, si no es de 10 dígitos lo dejamos pasar al backend y que él decida, o si es mock lo aceptamos.
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const telefonoNormalizado = normalizarTelefonoLocal(data.telefono);

      // 1. SI ES EL CLIENTE MOCK (Simulamos la edición)
      if (clientData.isMock) {
        setTimeout(() => {
          onClientUpdated({ ...clientData, ...data, telefono: telefonoNormalizado });
          onClose();
          setIsSubmitting(false);
        }, 600);
        return;
      }

      // 2. SI ES UN CLIENTE REAL (Actualizamos en Supabase)
      const { data: updatedClient, error } = await supabase
        .from('clientes')
        .update({
          nombre: data.nombre.trim(),
          apellido: data.apellido.trim(),
          telefono: telefonoNormalizado,
          tipo_cliente: data.tipo_cliente,
          email: data.email ? data.email.trim() : null,
          domicilio_fiscal: data.domicilio_fiscal ? data.domicilio_fiscal.trim() : null,
          cuit_cuil: data.cuit_cuil ? data.cuit_cuil.trim() : null,
          razon_social: data.razon_social ? data.razon_social.trim() : null
        })
        .eq('id', clientData.id) // Actualizamos usando el ID real
        .select()
        .single();

      if (error) throw new Error(error.message || 'Ocurrió un error al actualizar el cliente.');

      onClientUpdated(updatedClient);
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
          
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4">Editar Cliente</h5>
            <button type="button" className="btn-close shadow-none" onClick={() => { setErrorMessage(null); onClose(); }} />
          </div>

          <div className="modal-body p-4">
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-4">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} id="edit-client-form">
              <p className="text-secondary fw-semibold small text-uppercase mb-3" style={{ letterSpacing: '0.05em' }}>
                Información del Contacto
              </p>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Nombre *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><User size={16} /></span>
                    <input type="text" className={`form-control bg-light border-start-0 rounded-end-3 small ${errors.nombre ? 'is-invalid' : ''}`}
                      {...register('nombre', { required: 'El nombre es obligatorio' })}
                    />
                  </div>
                  {errors.nombre && <span className="text-danger small mt-1 d-block">{errors.nombre.message}</span>}
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Apellido *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><User size={16} /></span>
                    <input type="text" className={`form-control bg-light border-start-0 rounded-end-3 small ${errors.apellido ? 'is-invalid' : ''}`}
                      {...register('apellido', { required: 'El apellido es opcional si es empresa' })}
                    />
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Teléfono Celular *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><Phone size={16} /></span>
                    <input type="text" className={`form-control bg-light border-start-0 rounded-end-3 small ${errors.telefono ? 'is-invalid' : ''}`}
                      {...register('telefono', { required: 'El teléfono es obligatorio' })}
                    />
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Tipo de Cliente *</label>
                  <select className="form-select bg-light border rounded-3 small" {...register('tipo_cliente')}>
                    <option value="Casual">Casual</option>
                    <option value="Fijo">Fijo</option>
                    <option value="Empresa">Empresa</option>
                    <option value="EMPRESA">EMPRESA (Corporativo)</option>
                  </select>
                </div>
              </div>

              <p className="text-secondary fw-semibold small text-uppercase mb-3 pt-2 border-top" style={{ letterSpacing: '0.05em' }}>
                Datos de Facturación y Contacto (Opcional)
              </p>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Correo Electrónico</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><Mail size={16} /></span>
                    <input type="email" className="form-control bg-light border-start-0 rounded-end-3 small" {...register('email')} />
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Domicilio Fiscal</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><MapPin size={16} /></span>
                    <input type="text" className="form-control bg-light border-start-0 rounded-end-3 small" {...register('domicilio_fiscal')} />
                  </div>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">CUIT / NIF</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><FileText size={16} /></span>
                    <input type="text" className="form-control bg-light border-start-0 rounded-end-3 small" {...register('cuit_cuil')} />
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-secondary">Razón Social</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><Building size={16} /></span>
                    <input type="text" className="form-control bg-light border-start-0 rounded-end-3 small" {...register('razon_social')} />
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={() => onClose()} disabled={isSubmitting}>
              Cancelar
            </button>
            <Button type="submit" form="edit-client-form" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}