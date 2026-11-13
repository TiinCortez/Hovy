// Estado en forma de píldora: un punto de color y una palabra.
// tipo: 'exito' | 'pendiente' | 'info' | 'en-curso' | 'neutro'
// Siempre con palabra: éxito y pendiente tienen casi la misma luminosidad.
export default function Badge({ tipo = 'neutro', conPunto = true, className = '', children, ...props }) {
  return (
    <span className={`hovy-badge is-${tipo}${conPunto ? '' : ' sin-punto'} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
