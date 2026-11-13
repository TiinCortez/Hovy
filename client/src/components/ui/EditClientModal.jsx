import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { User, Phone, Mail, AlertCircle } from 'lucide-react';
import Button from './Button';
import CloseButton from './CloseButton';
import ClienteService from '../../services/api/cliente.service';
import useCerrarConEscape from './useCerrarConEscape';

export default function EditClientModal({ isOpen, onClose, clientData, onClientUpdated }) {
  useCerrarConEscape(isOpen, onClose);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  // Precargar los datos del cliente cuando se abre el modal
  useEffect(() => {
    if (isOpen && clientData) {
      reset({
        nombre: clientData.nombre || '',
        apellido: clientData.apellido || '',
        telefono: String(clientData.telefono ?? ''),
        tipo_cliente: clientData.tipo_cliente === 'EMPRESA' ? 'Empresa' : (clientData.tipo_cliente || 'Casual'),
        email: clientData.email || ''
      });
    }
  }, [isOpen, clientData, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. SI ES EL CLIENTE MOCK (Simulamos la edición solo visual)
      if (clientData.isMock) {
        setTimeout(() => {
          onClientUpdated({ ...clientData, ...data });
          onClose();
          setIsSubmitting(false);
        }, 600);
        return;
      }

      // 2. SI ES UN CLIENTE REAL (Actualizamos mediante la API del backend)
      const updatePayload = {
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
        telefono: data.telefono.trim(),
        tipo_cliente: data.tipo_cliente,
        email: data.email ? data.email.trim() : null
      };

      // El backend requiere el número actual (original) en la URL para actualizar.
      const response = await ClienteService.update(clientData.telefono, updatePayload);

      // El backend devuelve los datos actualizados dentro de response.data
      onClientUpdated(response.data);
      onClose();
    } catch (err) {
      // Capturamos el error desde el backend interceptor
      const errorMsg = err.response?.data?.error || err.message || 'Ocurrió un error al actualizar el cliente.';
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal d-block bg-dark bg-opacity-50" role="dialog" aria-modal="true" style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          
          <div className="modal-header justify-content-between align-items-start border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4">Editar Cliente</h5>
            <CloseButton label="Cerrar edición de cliente" onClick={() => { reset(); setErrorMessage(null); onClose(); }} />
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
                  <label htmlFor="editar-cliente-nombre" className="form-label small fw-bold text-secondary">Nombre *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><User size={16} /></span>
                    <input id="editar-cliente-nombre" type="text" className={`form-control bg-light border-start-0 rounded-end-3 small ${errors.nombre ? 'is-invalid' : ''}`}
                      placeholder="Ej: Juan"
                      {...register('nombre', { required: 'El nombre es obligatorio' })}
                    />
                  </div>
                  {errors.nombre && <span className="text-danger small mt-1 d-block">{errors.nombre.message}</span>}
                </div>

                <div className="col-12 col-md-6">
                  <label htmlFor="editar-cliente-apellido" className="form-label small fw-bold text-secondary">Apellido *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><User size={16} /></span>
                    <input id="editar-cliente-apellido" type="text" className={`form-control bg-light border-start-0 rounded-end-3 small ${errors.apellido ? 'is-invalid' : ''}`}
                      placeholder="Ej: Pérez"
                      {...register('apellido', { required: 'El apellido es obligatorio' })}
                    />
                  </div>
                  {errors.apellido && <span className="text-danger small mt-1 d-block">{errors.apellido.message}</span>}
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label htmlFor="editar-cliente-telefono" className="form-label small fw-bold text-secondary">Teléfono Celular *</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><Phone size={16} /></span>
                    <input id="editar-cliente-telefono" type="text" className={`form-control bg-light border-start-0 rounded-end-3 small ${errors.telefono ? 'is-invalid' : ''}`}
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
                  <label htmlFor="editar-cliente-tipo-cliente" className="form-label small fw-bold text-secondary">Tipo de Cliente *</label>
                  <select id="editar-cliente-tipo-cliente" className="form-select bg-light border rounded-3 small" {...register('tipo_cliente', { required: true })}>
                    <option value="Casual">Casual</option>
                    <option value="Fijo">Fijo</option>
                    <option value="Empresa">Empresa</option>
                  </select>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-12">
                  <label htmlFor="editar-cliente-email" className="form-label small fw-bold text-secondary">Correo Electrónico (Opcional)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 rounded-start-3 text-secondary"><Mail size={16} /></span>
                    <input id="editar-cliente-email" type="email" className="form-control bg-light border-start-0 rounded-end-3 small" placeholder="ejemplo@correo.com" {...register('email')} />
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={() => { reset(); setErrorMessage(null); onClose(); }} disabled={isSubmitting}>
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
