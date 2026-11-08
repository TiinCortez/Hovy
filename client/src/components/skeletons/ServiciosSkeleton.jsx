import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const TARJETAS = 6;

// Esqueleto del catálogo de servicios
export default function ServiciosSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Cargando servicios...</span>
      <div className="row g-3">
        {Array.from({ length: TARJETAS }, (_, i) => (
          <div key={i} className="col-12 col-md-6 col-xl-4">
            <Card className="h-100 p-4 shadow-sm border-0 rounded-4 d-flex flex-column bg-white">
              <div className="d-flex align-items-start gap-3 mb-3">
                <Skeleton width="48px" height="48px" className="flex-shrink-0" />
                <div className="flex-grow-1 d-flex flex-column gap-2 mt-1">
                  <Skeleton width="60%" height="1.25rem" />
                  <Skeleton width="85%" height="0.75rem" />
                </div>
              </div>
              <Skeleton height="3.5rem" className="mb-4" />
              <div className="d-flex align-items-center gap-2 mt-auto">
                <Skeleton height="2.4rem" radius="50rem" className="flex-grow-1" />
                <Skeleton width="2.4rem" height="2.4rem" radius="50rem" className="flex-shrink-0" />
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
