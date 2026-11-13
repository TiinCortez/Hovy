import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const INMUEBLES = 3;

// Caja gris de la ficha (teléfono, email, etc.)
const CajaFicha = () => (
  <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column gap-2">
    <Skeleton width="18px" height="18px" radius="0.25rem" />
    <Skeleton width="40%" height="0.6rem" />
    <Skeleton width="75%" height="0.85rem" />
  </div>
);

// Esqueleto completo de la página Detalle de cliente
export default function ClienteDetalleSkeleton() {
  return (
    <div
      className="d-flex flex-column gap-3 pb-5"
      style={{ backgroundColor: 'var(--hovy-gris-50)', minHeight: '100vh', margin: 'calc(-1 * var(--hovy-espacio-24))', padding: 'var(--hovy-espacio-24)' }}
      role="status"
      aria-busy="true"
    >
      <span className="visually-hidden">Cargando cliente…</span>

      {/* Navegación superior */}
      <Skeleton width="12rem" height="1.25rem" className="d-md-none mb-3" />
      <Skeleton width="20rem" height="0.9rem" className="d-none d-md-block mb-2" style={{ maxWidth: '100%' }} />

      {/* Tarjeta del cliente */}
      <Card className="p-3 p-md-4 shadow-sm border-0 rounded-4">
        <div className="d-flex flex-column flex-xl-row justify-content-between align-items-start gap-4 mb-4 pb-4 border-bottom">
          <div className="d-flex gap-3 flex-grow-1 min-w-0">
            <Skeleton width="64px" height="64px" radius="1rem" className="flex-shrink-0" />
            <div className="flex-grow-1 d-flex flex-column gap-2 justify-content-center">
              <Skeleton width="14rem" height="1.5rem" style={{ maxWidth: '100%' }} />
              <div className="d-flex gap-2">
                <Skeleton width="4.5rem" height="1.2rem" />
                <Skeleton width="4.5rem" height="1.2rem" radius="50rem" />
              </div>
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap flex-shrink-0 mw-100">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} width="6.5rem" height="2.1rem" />
            ))}
          </div>
        </div>

        <div className="row g-3 mb-4 d-none d-md-flex">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="col-12 col-sm-6"><CajaFicha /></div>
          ))}
        </div>
        <Skeleton height="3.25rem" className="d-md-none mb-4" />

        <div className="row g-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="col-12 col-sm-4">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column gap-3">
                <Skeleton width="60%" height="0.6rem" />
                <Skeleton width="45%" height="1.6rem" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Inmuebles */}
      <div className="mt-2">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-end gap-3 mb-4">
          <div className="d-flex flex-column gap-2 w-100">
            <Skeleton width="10rem" height="1.5rem" />
            <Skeleton width="18rem" height="0.8rem" className="d-none d-md-block" style={{ maxWidth: '100%' }} />
          </div>
          <Skeleton width="20rem" height="2.6rem" radius="50rem" style={{ maxWidth: '100%' }} />
        </div>

        <div className="d-flex flex-column gap-3">
          {Array.from({ length: INMUEBLES }, (_, i) => (
            <Card key={i} className="border-0 shadow-sm rounded-4 overflow-hidden p-0">
              <div className="row g-0 h-100">
                <div className="col-12 col-md-3 col-xl-2">
                  <Skeleton height="160px" radius="0.75rem" />
                </div>
                <div className="col-12 col-md-9 col-xl-10 p-3 p-md-4 d-flex flex-column justify-content-center gap-2">
                  <Skeleton width="40%" height="1.1rem" />
                  <Skeleton width="65%" height="0.8rem" />
                  <div className="d-flex gap-2 mt-2">
                    <Skeleton width="5rem" height="1.4rem" radius="50rem" />
                    <Skeleton width="5rem" height="1.4rem" radius="50rem" />
                    <Skeleton width="5rem" height="1.4rem" radius="50rem" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
