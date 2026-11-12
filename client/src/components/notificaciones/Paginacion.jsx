import { ChevronLeft, ChevronRight } from 'lucide-react';
import './notificaciones.scss';

// Siempre la primera, la última y las vecinas de la actual; "…" en los saltos.
const paginasVisibles = (actual, total) => {
  const paginas = [...new Set([1, actual - 1, actual, actual + 1, total])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const conSaltos = [];
  paginas.forEach((p, i) => {
    if (i > 0 && p - paginas[i - 1] > 1) conSaltos.push(`salto-${p}`);
    conSaltos.push(p);
  });
  return conSaltos;
};

// compacta: "‹ 1 / 3 ›" (popover de la campana). Normal: Anterior · 1 2 … N · Siguiente
export default function Paginacion({ pagina, totalPaginas, onCambiar, compacta = false }) {
  if (totalPaginas <= 1) return null;

  if (compacta) {
    return (
      <div className="d-flex align-items-center gap-2 small text-secondary">
        <button type="button" className="notificaciones-pagina-flecha" onClick={() => onCambiar(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior">
          <ChevronLeft size={14} />
        </button>
        <span className="fw-semibold">{pagina} / {totalPaginas}</span>
        <button type="button" className="notificaciones-pagina-flecha" onClick={() => onCambiar(pagina + 1)} disabled={pagina === totalPaginas} aria-label="Página siguiente">
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center gap-1">
      <button type="button" className="notificaciones-pagina-texto" onClick={() => onCambiar(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior">
        Anterior
      </button>
      {paginasVisibles(pagina, totalPaginas).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="px-1 text-secondary">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`notificaciones-pagina-numero${p === pagina ? ' activa' : ''}`}
            onClick={() => onCambiar(p)}
            aria-label={`Página ${p}`}
            aria-current={p === pagina ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}
      <button type="button" className="notificaciones-pagina-texto" onClick={() => onCambiar(pagina + 1)} disabled={pagina === totalPaginas} aria-label="Página siguiente">
        Siguiente
      </button>
    </div>
  );
}
