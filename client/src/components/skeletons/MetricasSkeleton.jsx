import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const ALTURAS_BARRAS = ['45%', '70%', '55%', '85%', '40%', '65%'];
const FILAS_TABLA = 5;

// Esqueleto de la página de métricas
export default function MetricasSkeleton() {
  return (
    <div className="d-flex flex-column gap-4" role="status" aria-busy="true">
      <span className="visually-hidden">Cargando métricas...</span>

      {/* KPIs principales */}
      <div className="row g-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="col-12 col-lg-6">
            <Card className="h-100">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <Skeleton width="35%" height="0.8rem" />
                <Skeleton width="40px" height="40px" radius="0.75rem" />
              </div>
              <div className="d-flex align-items-center gap-3">
                <Skeleton width="50%" height="2.25rem" />
                <Skeleton width="6rem" height="1.5rem" radius="50rem" />
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* Banner de balance comparativo */}
      <Skeleton height="11rem" radius="1.5rem" />

      {/* Gráfico de evolución */}
      <div className="metricas-panel">
        <div className="metricas-panel-cabecera">
          <Skeleton width="16rem" height="1.25rem" style={{ maxWidth: '100%' }} />
          <Skeleton width="10rem" height="2rem" />
        </div>
        <div className="d-flex align-items-end justify-content-around gap-3" style={{ height: '16rem' }}>
          {ALTURAS_BARRAS.map((altura, i) => (
            <Skeleton key={i} width="2.5rem" height={altura} radius="0.5rem 0.5rem 0 0" />
          ))}
        </div>
      </div>

      {/* Tabla de desglose mensual */}
      <div className="metricas-panel">
        <div className="metricas-panel-cabecera">
          <Skeleton width="14rem" height="1.25rem" style={{ maxWidth: '100%' }} />
          <Skeleton width="8rem" height="2rem" />
        </div>
        <div className="d-flex flex-column gap-3">
          {Array.from({ length: FILAS_TABLA }, (_, i) => (
            <div key={i} className="d-flex align-items-center justify-content-between gap-3">
              <Skeleton width="20%" height="0.9rem" />
              <Skeleton width="15%" height="0.9rem" />
              <Skeleton width="15%" height="0.9rem" />
              <Skeleton width="15%" height="0.9rem" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
