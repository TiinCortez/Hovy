import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

// Columnas de las cajas de datos, en el mismo orden que la página real
const COLUMNAS = ['col-12 col-md-6', 'col-12 col-md-6', 'col-12', 'col-12 col-md-6', 'col-12 col-md-6', 'col-12'];

// Esqueleto de la página Detalle de solicitud
export default function VisitaDetalleSkeleton() {
  return (
    <div className="d-flex flex-column gap-4 pb-5" role="status" aria-busy="true">
      <span className="visually-hidden">Cargando solicitud…</span>

      <Skeleton width="7rem" height="1rem" />

      <Card className="p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4 pb-4 border-bottom">
          <div className="d-flex align-items-center gap-3">
            <Skeleton width="56px" height="56px" radius="1rem" className="flex-shrink-0" />
            <div className="d-flex flex-column gap-2">
              <Skeleton width="12rem" height="1.4rem" />
              <Skeleton width="9rem" height="0.75rem" />
            </div>
          </div>
          <Skeleton width="6rem" height="1.9rem" radius="50rem" />
        </div>

        <div className="row g-3 mb-4">
          {COLUMNAS.map((columna, i) => (
            <div key={i} className={columna}>
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column gap-2">
                <Skeleton width="18px" height="18px" radius="0.25rem" />
                <Skeleton width="30%" height="0.6rem" />
                <Skeleton width="60%" height="0.85rem" />
              </div>
            </div>
          ))}
        </div>

        <Skeleton width="9rem" height="2.4rem" />
      </Card>
    </div>
  );
}
