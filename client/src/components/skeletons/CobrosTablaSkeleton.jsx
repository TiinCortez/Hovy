import Skeleton from '../ui/Skeleton';

const FILAS = 6;

// Esqueleto de la tabla de liquidación
export default function CobrosTablaSkeleton() {
  return (
    <div className="bg-white border rounded-4 shadow-sm" role="status" aria-busy="true">
      <span className="visually-hidden">Cargando turnos a liquidar...</span>

      <div className="cobros-fila cobros-encabezado d-none d-lg-grid">
        <div className="cobros-celda-turno"><Skeleton width="60%" height="0.7rem" /></div>
        <div className="cobros-celda-cliente"><Skeleton width="60%" height="0.7rem" /></div>
        <div className="cobros-celda-servicio"><Skeleton width="50%" height="0.7rem" /></div>
        <div className="cobros-celda-monto d-flex justify-content-lg-end"><Skeleton width="70%" height="0.7rem" /></div>
        <div className="cobros-celda-estado d-flex justify-content-center"><Skeleton width="70%" height="0.7rem" /></div>
      </div>

      {Array.from({ length: FILAS }, (_, i) => (
        <div key={i} className="cobros-fila">
          <div className="cobros-celda-turno d-flex flex-column gap-2">
            <Skeleton width="50%" height="0.85rem" />
            <Skeleton width="30%" height="0.7rem" />
          </div>
          <div className="cobros-celda-cliente d-flex flex-column gap-2">
            <Skeleton width="70%" height="0.85rem" />
            <Skeleton width="50%" height="0.7rem" />
          </div>
          <div className="cobros-celda-servicio">
            <Skeleton width="60%" height="0.8rem" />
          </div>
          <div className="cobros-celda-monto d-flex justify-content-lg-end">
            <Skeleton width="5rem" height="1rem" />
          </div>
          <div className="cobros-celda-estado d-flex justify-content-end justify-content-lg-center">
            <Skeleton width="6rem" height="1.6rem" radius="50rem" />
          </div>
        </div>
      ))}

      <div className="cobros-pie px-3 px-lg-4 py-3 d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3">
        <Skeleton width="10rem" height="0.8rem" />
        <div className="d-flex align-items-center gap-1">
          <Skeleton width="5rem" height="1.9rem" />
          <Skeleton width="2rem" height="1.9rem" />
          <Skeleton width="5rem" height="1.9rem" />
        </div>
      </div>
    </div>
  );
}
