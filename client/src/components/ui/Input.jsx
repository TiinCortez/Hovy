export default function Input({
  label,
  type = 'text',
  name,
  register, // Función register proveniente de useForm()
  rules, // Reglas de validación (ej: { required: true })
  errors, // Objeto de errores proveniente de useForm()
  placeholder = '',
  className = '',
  ...props
}) {
  const error = errors?.[name];

  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <label htmlFor={name} className="form-label fw-semibold text-secondary mb-1">
          {label}
        </label>
      )}
      <input
        id={name}
        type={type}
        placeholder={placeholder}
        // Aplicamos un borde suave y radio redondeado (rounded-4 en Bootstrap)
        className={`form-control rounded-4 py-2 shadow-sm ${error ? 'is-invalid' : ''}`}
        {...(register ? register(name, rules) : {})}
        {...props}
      />
      {error && (
        <div className="invalid-feedback">
          {error.message}
        </div>
      )}
    </div>
  );
}