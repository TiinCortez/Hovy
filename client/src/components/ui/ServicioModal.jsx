import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import Button from './Button';
import ServicioService from '../../services/api/servicio.service';
import Modal from './Modal';

// Mirrors server rule: finite number >= 0
const nonNegative = (value) => {
  const n = Number(value);
  return (Number.isFinite(n) && n >= 0) || 'Debe ser un número mayor o igual a 0';
};

/**
 * Create (servicio = null) or edit (servicio = row) modal.
 * tipos: global catalog of service types, used only as name suggestions.
 */
export default function ServicioModal({ isOpen, onClose, servicio, tipos, onSaved }) {
  const isEdit = Boolean(servicio);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  // The parent mounts this modal only while open, so defaultValues are fresh each time
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      nombre: '',
      descripcion: '',
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
        // The server finds-or-creates the type by name and reactivates removed links
        await ServicioService.create({
          nombre: data.nombre.trim(),
          descripcion: data.descripcion.trim() || undefined,
          precio_base,
          limite_operativo,
        });
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
    <Modal titulo={isEdit ? 'Editar Servicio' : 'Agregar Servicio'} onCerrar={onClose} bloqueado={isSubmitting}>

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
                    <input
                      id="servicio-tipo"
                      type="text"
                      list="servicio-sugerencias"
                      autoComplete="off"
                      className={`form-control bg-light rounded-3 ${errors.nombre ? 'is-invalid' : ''}`} aria-invalid={errors.nombre ? 'true' : undefined} aria-describedby={errors.nombre ? 'servicio-nombre-error' : undefined}
                      {...register('nombre', {
                        required: 'El nombre es obligatorio',
                        validate: (v) => {
                          const len = v.trim().length;
                          return (len >= 2 && len <= 100) || 'El nombre debe tener entre 2 y 100 caracteres';
                        },
                      })}
                    />
                    <datalist id="servicio-sugerencias">
                      {tipos.map((t) => (
                        <option key={t.id_servicio} value={t.nombre} />
                      ))}
                    </datalist>
                    {errors.nombre && <span id="servicio-nombre-error" className="invalid-feedback d-block">{errors.nombre.message}</span>}
                  </>
                )}
              </div>

              {!isEdit && (
                <div className="mb-3">
                  <label className="form-label small fw-bold text-secondary" htmlFor="servicio-descripcion">Descripción</label>
                  <textarea
                    id="servicio-descripcion"
                    rows={2}
                    className="form-control bg-light rounded-3"
                    {...register('descripcion')}
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label small fw-bold text-secondary" htmlFor="servicio-precio">Precio por m² *</label>
                <input
                  id="servicio-precio"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className={`form-control bg-light rounded-3 ${errors.precio_base ? 'is-invalid' : ''}`} aria-invalid={errors.precio_base ? 'true' : undefined} aria-describedby={errors.precio_base ? 'servicio-precio-base-error' : undefined}
                  {...register('precio_base', {
                    required: 'El precio por m² es obligatorio',
                    validate: nonNegative,
                  })}
                />
                {errors.precio_base && <span id="servicio-precio-base-error" className="invalid-feedback d-block">{errors.precio_base.message}</span>}
              </div>

              <div>
                <label className="form-label small fw-bold text-secondary" htmlFor="servicio-limite">Límite operativo</label>
                <input
                  id="servicio-limite"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className={`form-control bg-light rounded-3 ${errors.limite_operativo ? 'is-invalid' : ''}`} aria-invalid={errors.limite_operativo ? 'true' : undefined} aria-describedby={errors.limite_operativo ? 'servicio-limite-operativo-error' : undefined}
                  {...register('limite_operativo', {
                    validate: (v) => String(v).trim() === '' || nonNegative(v),
                  })}
                />
                {errors.limite_operativo && <span id="servicio-limite-operativo-error" className="invalid-feedback d-block">{errors.limite_operativo.message}</span>}
              </div>
            </form>
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <Button type="submit" form={formId} variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </div>
    </Modal>,
    document.body
  );
}
