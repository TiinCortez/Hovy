import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CardEmbebidaContext } from './cardEmbebidaContext';
import { VERDE } from '../../styles/colores';


// Collapsible card: a header with icon, title and a one-line summary (useful while
// it is closed) and a body shown only when open. A Card placed directly in
// the body drops its own chrome, so existing *Card components can be reused as is.
export default function SeccionDesplegable({
  icono: Icono,
  titulo,
  resumen,
  estado,
  defaultAbierta = false,
  children,
}) {
  const [abierta, setAbierta] = useState(defaultAbierta);
  const idCuerpo = useId();

  return (
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
      <button
        type="button"
        className="btn w-100 text-start d-flex flex-wrap flex-sm-nowrap align-items-center gap-3 p-3 p-md-4 border-0 rounded-0"
        onClick={() => setAbierta((valor) => !valor)}
        aria-expanded={abierta}
        aria-controls={idCuerpo}
      >
        {Icono && (
          <span
            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: 44, height: 44, backgroundColor: 'rgba(27, 48, 6, 0.08)', color: VERDE }}
          >
            <Icono size={20} />
          </span>
        )}
        <span style={{ flex: '1 1 8rem', minWidth: 0 }}>
          <span className="d-block fw-bold fs-6" style={{ color: VERDE }}>{titulo}</span>
          {resumen && <span className="d-block small text-secondary text-truncate">{resumen}</span>}
        </span>
        {estado}
        <ChevronDown
          size={20}
          className="text-secondary flex-shrink-0"
          style={{ transition: 'transform 0.2s', transform: abierta ? 'rotate(180deg)' : 'none' }}
          aria-hidden="true"
        />
      </button>

      {/* Hidden instead of unmounted: the content keeps its state and keeps
          reporting the summary while the section is closed. */}
      <div id={idCuerpo} className={`px-3 px-md-4 pb-4 pt-3 border-top ${abierta ? '' : 'd-none'}`}>
        <CardEmbebidaContext.Provider value>
          {children}
        </CardEmbebidaContext.Provider>
      </div>
    </div>
  );
}
