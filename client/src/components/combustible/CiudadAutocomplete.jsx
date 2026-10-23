import { useId, useState } from 'react';
import { filtrarCiudades } from './combustibleUtils';

// Text input with a short suggestion list: shows at most 5 matches
// and narrows them while the user keeps typing. Keyboard: arrows, Enter, Escape.
export default function CiudadAutocomplete({ id, value, opciones, onChange, placeholder }) {
  const listaId = useId();
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const { items, total } = filtrarCiudades(opciones, value);
  const visible = abierto && items.length > 0;

  const elegir = (opcion) => {
    onChange(opcion);
    setAbierto(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setActivo((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && visible) {
      e.preventDefault();
      elegir(items[Math.min(activo, items.length - 1)]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  return (
    <div className="position-relative">
      <input
        id={id}
        className="form-control bg-light rounded-3"
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={visible ? `${listaId}-${Math.min(activo, items.length - 1)}` : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAbierto(true);
          setActivo(0);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={handleKeyDown}
      />
      {visible && (
        <div
          id={listaId}
          role="listbox"
          className="list-group position-absolute w-100 shadow-sm mt-1"
          style={{ zIndex: 10 }}
        >
          {items.map((opcion, indice) => (
            <button
              key={opcion}
              id={`${listaId}-${indice}`}
              type="button"
              role="option"
              aria-selected={indice === Math.min(activo, items.length - 1)}
              className={`list-group-item list-group-item-action small ${indice === Math.min(activo, items.length - 1) ? 'active' : ''}`}
              // mousedown (not click) so the input's blur does not close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(opcion);
              }}
            >
              {opcion}
            </button>
          ))}
          {total > items.length && (
            <div className="list-group-item small text-secondary">
              Hay {total - items.length} más. Seguí escribiendo para acotar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
