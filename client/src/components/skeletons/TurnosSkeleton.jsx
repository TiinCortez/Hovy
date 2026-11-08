import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const TURNOS = 3;

// Esqueleto de la columna de turnos de la Agenda
export default function TurnosSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Cargando turnos...</span>
      <Card className="turnos-kanban-card p-0 shadow-sm border-0 rounded-4 bg-white overflow-hidden">
        <div className="d-flex gap-2 pb-2 mb-3 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width="6.5rem" height="2.2rem" radius="50rem" className="flex-shrink-0" />
          ))}
        </div>
        {Array.from({ length: TURNOS }, (_, i) => (
          <div key={i} className="card rounded-4 mb-3 bg-white shadow-sm border p-3 ps-4">
            <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
              <Skeleton width="5rem" height="1.3rem" radius="50rem" />
              <Skeleton width="6rem" height="0.85rem" />
            </div>
            <Skeleton width="45%" height="1rem" className="mb-2" />
            <Skeleton width="70%" height="0.8rem" className="mb-3" />
            <Skeleton width="35%" height="0.8rem" />
          </div>
        ))}
      </Card>
    </div>
  );
}
