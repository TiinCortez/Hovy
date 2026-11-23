import Skeleton from '../ui/Skeleton';

const TARJETAS = 6;

// Esqueleto del directorio de clientes: misma grilla y forma compacta que ClienteCard
export default function ClientesSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Cargando clientes…</span>
      <div className="clientes-grid">
        {Array.from({ length: TARJETAS }, (_, i) => (
          <div key={i} className="clientes-card">
            <div className="d-flex align-items-center gap-3">
              <Skeleton width="40px" height="40px" radius="12px" className="flex-shrink-0" />
              <div className="flex-grow-1 d-flex flex-column gap-2">
                <Skeleton width="62%" height="0.95rem" />
                <Skeleton width="30%" height="0.72rem" />
              </div>
            </div>
            <Skeleton width="45%" height="0.85rem" />
            <div className="clientes-card-pie">
              <Skeleton width="52%" height="0.85rem" />
              <Skeleton width="34px" height="34px" radius="50%" className="flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
