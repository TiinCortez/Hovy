import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const ESTADOS = 4;

// Esqueleto de la columna de turnos de la Agenda
export default function TurnosSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Cargando turnos…</span>
      <Card className="turnos-kanban-card p-0 shadow-sm border-0 rounded-4 bg-white overflow-hidden">
        <div className="hovy-filter-group mb-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width="6.5rem" height="2.2rem" radius="50rem" className="hovy-filter-placeholder" />
          ))}
        </div>
        <div className="turnos-estados-grid">
          {Array.from({ length: ESTADOS }, (_, i) => (
            <div key={i} className="turnos-estado">
              <div className="turnos-estado-header">
                <Skeleton width="65%" height="1rem" />
                <Skeleton width="1.5rem" height="1.5rem" radius="50rem" />
              </div>
              <div className="turnos-estado-lista">
                <div className="card rounded-4 bg-white border p-3">
                  <Skeleton width="55%" height="1rem" className="mb-3" />
                  <Skeleton width="80%" height="0.8rem" className="mb-2" />
                  <Skeleton width="70%" height="0.8rem" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
