// Inline notice. Bootstrap's alert styles are not part of the selective import
// (see styles/main.scss), so this uses its own `.hovy-aviso` styles.
// tipo: 'error' | 'ok' | 'aviso'
export default function Aviso({ tipo = 'aviso', icono: Icono, children }) {
  return (
    <div className={`hovy-aviso is-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {Icono && <Icono size={18} className="flex-shrink-0" />}
      <span>{children}</span>
    </div>
  );
}
