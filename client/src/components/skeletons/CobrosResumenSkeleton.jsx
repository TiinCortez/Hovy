import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

// Esqueleto de las tarjetas de resumen del mes (recaudado, por cobrar, ejecutados)
export default function CobrosResumenSkeleton() {
  return (
    <div className="row g-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="col-12 col-md-6 col-xl-4">
          <Card className="h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <Skeleton width="40%" height="0.7rem" />
              <Skeleton width="36px" height="36px" radius="0.75rem" />
            </div>
            <Skeleton width="55%" height="2rem" className="mb-3" />
            <Skeleton width="80%" height="0.6rem" />
          </Card>
        </div>
      ))}
    </div>
  );
}
