import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import ServicioService from '../../services/api/servicio.service';

// Mirrors server rule: finite number >= 0
const nonNegative = (value) => {
  const n = Number(value);
  return (Number.isFinite(n) && n >= 0) || 'Debe ser un número mayor o igual a 0';
};

/**
 * Create (servicio = null) or edit (servicio = row) modal.
 * tipos: global catalog already filtered to types the user can still add.
 * reactivable: map id_servicio -> existing inactive row (re-add = reactivate).
 */
export default function ServicioModal({ isOpen, onClose, servicio, tipos, reactivable, onSaved }) {
  const isEdit = Boolean(servicio);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  // The parent mounts this modal only while open, so defaultValues are fresh each time
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      id_servicio: '',
      precio_base: isEdit ? String(servicio.precio_base ?? '') : '',
      limite_operativo: isEdit && servicio.limite_operativo != null ? String(servicio.limite_operativo) : '',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const precio_base = Number(data.precio_base);
      const limite_operativo = String(data.limite_operativo).trim() === '' ? null : Number(data.limite_operativo);

      if (isEdit) {
        await ServicioService.update(servicio.id_usuario_servicio, { precio_base, limite_operativo });
      } else {
        const idServicio = Number(data.id_servicio);
        const inactive = reactivable?.[idServicio];
        if (inactive) {
          // Unique (user, type) constraint: a removed service is reactivated instead of re-created
          await ServicioService.update(inactive.id_usuario_servicio, { precio_base, limite_operativo, activo: true });
        } else {
          await ServicioService.create({ id_servicio: idServicio, precio_base, limite_operativo });
        }
      }
      await onSaved();
      onClose();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Ocurrió un error al guardar el servicio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formId = 'servicio-form';

  return createPortal(
    <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4">{isEdit ? 'Editar Servicio' : 'Agregar Servicio'}</h5>
            <CloseButton label="Cerrar" onClick={onClose} disabled={isSubmitting} />
          </div>

          <div className="modal-body p-4">
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-3" role="alert">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} id={formId} noValidate>
              <div className="mb-3">
                <label className="form-label small fw-bold text-secondary" htmlFor="servicio-tipo">Servicio *</label>
                {isEdit ? (
                  <input id="servicio-tipo" type="text" className="form-control bg-light rounded-3" value={servicio.servicio?.nombre || ''} readOnly disabled />
                ) : (
                  <>
                    <select
                      id="servicio-tipo"
                      className={`form-select bg-light rounded-3 ${errors.id_servicio ? 'is-invalid' : ''}`}
                      {...register('id_servicio', { required: 'Seleccioná un servicio' })}
                    >
                      <option value="">Seleccionar...</option>
                      {tipos.map((t) => (
                        <option key={t.id_servicio} value={t.id_servicio}>{t.nombre}</option>
                      ))}
                    </select>
                    {errors.id_servicio && <span className="text-danger small mt-1 d-block">{errors.id_servicio.message}</span>}
                    {tipos.length === 0 && (
                      <span className="text-secondary small mt-1 d-block">Ya agregaste todos los servicios disponibles.</span>
                    )}
                  </>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-secondary" htmlFor="servicio-precio">Precio base *</label>
                <input
                  id="servicio-precio"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className={`form-control bg-light rounded-3 ${errors.precio_base ? 'is-invalid' : ''}`}
                  {...register('precio_base', {
                    required: 'El precio base es obligatorio',
                    validate: nonNegative,
                  })}
                />
                {errors.precio_base && <span className="text-danger small mt-1 d-block">{errors.precio_base.message}</span>}
              </div>

              <div>
                <label className="form-label small fw-bold text-secondary" htmlFor="servicio-limite">Límite operativo</label>
                <input
                  id="servicio-limite"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className={`form-control bg-light rounded-3 ${errors.limite_operativo ? 'is-invalid' : ''}`}
                  {...register('limite_operativo', {
                    validate: (v) => String(v).trim() === '' || nonNegative(v),
                  })}
                />
                {errors.limite_operativo && <span className="text-danger small mt-1 d-block">{errors.limite_operativo.message}</span>}
              </div>
            </form>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <Button type="submit" form={formId} variant="primary" disabled={isSubmitting || (!isEdit && tipos.length === 0)}>
              {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
