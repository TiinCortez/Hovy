import { useId, useState } from 'react';
import { Search } from 'lucide-react';
import { filtrarCiudades, partirCoincidencia } from './combustibleUtils';

// Text input with a short suggestion list: shows at most 5 matches, highlights
// what the user typed and narrows while they keep typing.
// Keyboard: arrows, Enter, Escape.
export default function CiudadAutocomplete({ id, value, opciones, onChange, placeholder }) {
  const listaId = useId();
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const { items, total } = filtrarCiudades(opciones, value);
  const visible = abierto && items.length > 0;
  const indiceActivo = Math.min(activo, items.length - 1);

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
      elegir(items[indiceActivo]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  return (
    <div className="combustible-search">
      <Search size={16} aria-hidden="true" />
      <input
        id={id}
        className="form-control bg-light rounded-3"
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={visible ? `${listaId}-${indiceActivo}` : undefined}
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
        <div id={listaId} role="listbox" className="combustible-sugerencias">
          {items.map((opcion, indice) => {
            const [antes, coincidencia, despues] = partirCoincidencia(opcion, value);
            return (
              <button
                key={opcion}
                id={`${listaId}-${indice}`}
                type="button"
                role="option"
                aria-selected={indice === indiceActivo}
                className={`combustible-sugerencia ${indice === indiceActivo ? 'is-activa' : ''}`}
                // mousedown (not click) so the input's blur does not close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(opcion);
                }}
              >
                {antes}
                {coincidencia && <mark>{coincidencia}</mark>}
                {despues}
              </button>
            );
          })}
          {total > items.length && (
            <div className="combustible-sugerencias-pie">
              {total - items.length} más. Seguí escribiendo para acotar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
