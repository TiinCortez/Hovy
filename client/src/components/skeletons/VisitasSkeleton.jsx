import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const TARJETAS = 6;
const ANCHOS_DETALLE = ['45%', '80%', '35%', '60%', '50%'];

// Esqueleto del listado de solicitudes
export default function VisitasSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Cargando solicitudes…</span>
      <div className="row g-3">
        {Array.from({ length: TARJETAS }, (_, i) => (
          <div key={i} className="col-12 col-md-6 col-xl-4">
            <Card className="h-100 p-4 shadow-sm border-0 rounded-4 d-flex flex-column bg-white">
              <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                <div className="flex-grow-1 d-flex flex-column gap-2">
                  <Skeleton width="60%" height="1.25rem" />
                  <Skeleton width="35%" height="0.75rem" />
                </div>
                <Skeleton width="5.5rem" height="1.9rem" radius="50rem" className="flex-shrink-0" />
              </div>
              <div className="d-flex flex-column gap-2 mb-4">
                {ANCHOS_DETALLE.map((ancho, j) => (
                  <div key={j} className="d-flex align-items-center gap-2">
                    <Skeleton width="15px" height="15px" radius="0.25rem" className="flex-shrink-0" />
                    <Skeleton width={ancho} height="0.8rem" />
                  </div>
                ))}
              </div>
              <Skeleton height="2.4rem" radius="50rem" className="mt-auto" />
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
