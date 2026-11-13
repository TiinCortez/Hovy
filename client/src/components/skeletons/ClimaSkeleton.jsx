import Skeleton from '../ui/Skeleton';

// Weather card placeholder with the same layout as PanelClima, so the widget keeps its size while loading.
export default function ClimaSkeleton() {
  return (
    <div
      className="clima-panel card border-1 shadow-sm p-3 d-flex flex-column gap-3 w-100"
      style={{ backgroundColor: 'var(--hovy-blanco)', borderColor: 'var(--hovy-gris-100)', borderRadius: 'var(--hovy-radio-xl)' }}
      role="status"
      aria-label="Cargando pronóstico"
    >
      <div className="d-flex align-items-center justify-content-between border-bottom pb-2 gap-2" style={{ borderColor: 'var(--hovy-gris-100)' }}>
        <div className="d-flex align-items-center gap-2 flex-grow-1">
          <Skeleton width="32px" height="32px" radius="50%" />
          <div className="d-flex flex-column gap-1 flex-grow-1">
            <Skeleton width="40%" height="0.8rem" />
            <Skeleton width="65%" height="0.6rem" />
          </div>
        </div>
        <Skeleton width="110px" height="1.6rem" radius="999px" />
      </div>

      <div className="d-flex justify-content-between align-items-center gap-2">
        <div className="d-flex flex-column gap-2">
          <Skeleton width="90px" height="2.25rem" />
          <Skeleton width="120px" height="0.7rem" />
        </div>
        <div className="d-flex flex-column align-items-end gap-2">
          <Skeleton width="60px" height="0.6rem" />
          <Skeleton width="55px" height="1.4rem" />
        </div>
      </div>

      <div className="row g-1">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="col-4">
            <Skeleton width="100%" height="3.5rem" radius="0.5rem" />
          </div>
        ))}
      </div>

      <div className="d-flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width="100%" height="3.75rem" radius="0.5rem" />
        ))}
      </div>
    </div>
  );
}
