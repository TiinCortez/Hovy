import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const TARJETAS = 6;

// Esqueleto del listado de clientes: misma grilla y forma que las tarjetas reales
export default function ClientesSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Cargando clientes…</span>
      <div className="row g-3">
        {Array.from({ length: TARJETAS }, (_, i) => (
          <div key={i} className="col-12 col-md-6 col-xl-4">
            <Card className="h-100 p-3 shadow-sm border-0 rounded-4 bg-white">
              <div className="d-flex align-items-start gap-3 mb-3">
                <Skeleton width="40px" height="40px" className="flex-shrink-0" />
                <div className="flex-grow-1 d-flex flex-column gap-2 pt-1">
                  <Skeleton width="65%" height="0.95rem" />
                  <Skeleton width="40%" height="0.7rem" />
                </div>
              </div>
              <div className="d-flex align-items-center mb-3">
                <Skeleton width="5rem" height="1.4rem" radius="50rem" />
              </div>
              <div className="d-flex flex-column gap-2 mb-3">
                <Skeleton width="55%" height="0.8rem" />
                <Skeleton width="75%" height="0.8rem" />
              </div>
              <Skeleton height="3.25rem" />
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
