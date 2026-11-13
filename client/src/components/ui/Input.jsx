// Campo de una línea con etiqueta y mensaje de error, pensado para react-hook-form.
//   <Input label="Nombre" name="nombre" required register={register}
//          rules={{ required: 'El nombre es obligatorio' }} errors={errors} autoComplete="given-name" />
// Vincula la etiqueta con el campo (htmlFor/id) y, con error, marca el campo con
// aria-invalid y le asocia el mensaje con aria-describedby.
export default function Input({
  label,
  type = 'text',
  name,
  id,
  register, // register de useForm()
  rules, // reglas de validación: { required: 'El nombre es obligatorio' }
  errors, // errors de useForm()
  required = false,
  ayuda, // texto de ayuda debajo del campo
  placeholder = '',
  className = '',
  ...props
}) {
  const idCampo = id ?? `campo-${name}`;
  const idError = `${idCampo}-error`;
  const idAyuda = `${idCampo}-ayuda`;
  const error = errors?.[name];
  const descripcion = [ayuda && idAyuda, error && idError].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <label htmlFor={idCampo} className="form-label fw-semibold text-secondary mb-1">
          {label}{required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      <input
        id={idCampo}
        type={type}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={descripcion}
        className={`form-control rounded-4 py-2 shadow-sm ${error ? 'is-invalid' : ''}`}
        {...(type === 'email' ? { spellCheck: false, autoCapitalize: 'none' } : {})}
        {...(register ? register(name, rules) : {})}
        {...props}
      />
      {ayuda && (
        <div id={idAyuda} className="form-text">
          {ayuda}
        </div>
      )}
      {error && (
        <div id={idError} className="invalid-feedback d-block">
          {error.message}
        </div>
      )}
    </div>
  );
}
