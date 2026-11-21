import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

export default function VisitaDetalleSkeleton() {
  return (
    <div className="d-flex flex-column gap-4 pb-5" role="status" aria-busy="true">
      <span className="visually-hidden">Cargando solicitud…</span>

      <Skeleton width="7rem" height="1rem" />

      <Card>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 pb-4 border-bottom">
          <div className="d-flex align-items-center gap-3">
            <Skeleton width="52px" height="52px" radius="1rem" className="flex-shrink-0" />
            <div className="d-flex flex-column gap-2">
              <Skeleton width="12rem" height="1.4rem" />
              <Skeleton width="16rem" height="0.75rem" />
            </div>
          </div>
          <Skeleton width="8rem" height="2rem" radius="0.5rem" />
        </div>

        <div className="row g-3 g-lg-4">
          <div className="col-12 col-lg-7 d-flex flex-column gap-3">
            <Skeleton width="9rem" height="0.8rem" />
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <div className="p-3 bg-light rounded-4 border border-light-subtle d-flex align-items-center gap-3">
                  <Skeleton width="36px" height="36px" radius="0.5rem" className="flex-shrink-0" />
                  <div className="d-flex flex-column gap-2 w-100">
                    <Skeleton width="40%" height="0.6rem" />
                    <Skeleton width="70%" height="0.85rem" />
                  </div>
                </div>
              </div>
              <div className="col-12 col-sm-6">
                <div className="p-3 bg-light rounded-4 border border-light-subtle d-flex align-items-center gap-3">
                  <Skeleton width="36px" height="36px" radius="0.5rem" className="flex-shrink-0" />
                  <div className="d-flex flex-column gap-2 w-100">
                    <Skeleton width="40%" height="0.6rem" />
                    <Skeleton width="50%" height="0.85rem" />
                  </div>
                </div>
              </div>
              <div className="col-12">
                <div className="p-3 bg-light rounded-4 border border-light-subtle d-flex align-items-start gap-3">
                  <Skeleton width="36px" height="36px" radius="0.5rem" className="flex-shrink-0" />
                  <div className="d-flex flex-column gap-2 w-100">
                    <Skeleton width="30%" height="0.6rem" />
                    <Skeleton width="85%" height="0.85rem" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <div className="p-3 bg-light rounded-4 border border-light-subtle h-100 d-flex flex-column justify-content-between gap-3">
              <div>
                <Skeleton width="10rem" height="0.8rem" className="mb-3" />
                <div className="d-flex flex-column gap-3">
                  <Skeleton width="80%" height="1.2rem" />
                  <Skeleton width="70%" height="1.2rem" />
                  <Skeleton width="60%" height="1.2rem" />
                </div>
              </div>
              <Skeleton width="100%" height="2.2rem" radius="0.5rem" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
