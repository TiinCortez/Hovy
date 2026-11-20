import Skeleton from '../ui/Skeleton';

const TARJETAS = 6;

// Esqueleto del catálogo de servicios
export default function ServiciosSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Cargando servicios…</span>
      <div className="servicios-grid">
        {Array.from({ length: TARJETAS }, (_, i) => (
          <div key={i} className="servicio-card">
            <div className="servicio-card-header">
              <Skeleton width="44px" height="44px" radius="12px" className="flex-shrink-0" />
              <Skeleton width="65%" height="1.25rem" />
            </div>
            <div className="d-flex flex-column gap-2">
              <Skeleton width="92%" height="0.85rem" />
              <Skeleton width="60%" height="0.85rem" />
            </div>
            <Skeleton height="2.75rem" radius="12px" />
            <div className="servicio-card-acciones">
              <Skeleton height="2.25rem" radius="10px" className="flex-grow-1" />
              <Skeleton width="2.5rem" height="2.25rem" radius="10px" className="flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
