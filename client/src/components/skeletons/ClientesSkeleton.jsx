import Skeleton from '../ui/Skeleton';
import '../clientes/clientes.scss';

const TARJETAS = 12;
const ANCHOS_CHIPS = ['6rem', '5.5rem', '6.8rem', '6.8rem'];
const ANCHOS_NOMBRES = ['64%', '54%', '72%', '58%', '68%', '52%', '62%', '74%', '56%', '66%', '60%', '70%'];

// Esqueleto de pantalla completa para Clientes: cubre cabecera, barra de filtros,
// grilla completa según viewport (5 en móvil, 8 en tablet, 12 en desktop) y pie.
export default function ClientesSkeleton() {
  return (
    <div className="d-flex flex-column gap-4 pb-5 w-100" role="status" aria-busy="true">
      <span className="visually-hidden">Cargando clientes…</span>

      {/* Cabecera: título + buscador + acción principal */}
      <div className="clientes-cabecera">
        <Skeleton width="9.5rem" height="2.25rem" radius="0.65rem" />
        <div className="clientes-cabecera-controles">
          <div className="clientes-skeleton-buscador">
            <Skeleton height="42px" radius="50rem" />
          </div>
          <div className="clientes-skeleton-cta">
            <Skeleton height="42px" radius="10px" />
          </div>
        </div>
      </div>

      {/* Barra unificada de chips-filtro + inactivos + orden */}
      <div className="clientes-barra-filtros">
        <div className="clientes-chips">
          {ANCHOS_CHIPS.map((ancho, i) => (
            <Skeleton key={i} width={ancho} height="36px" radius="50rem" />
          ))}
        </div>
        <div className="clientes-barra-secundaria">
          <Skeleton width="7.25rem" height="36px" radius="50rem" />
          <Skeleton width="9.5rem" height="36px" radius="50rem" />
        </div>
      </div>

      {/* Grilla de tarjetas destiladas cubriendo el espacio completo */}
      <div className="clientes-grid">
        {Array.from({ length: TARJETAS }, (_, i) => {
          const claseResponsive = i >= 8
            ? ' clientes-skeleton-extra-xl'
            : i >= 5
              ? ' clientes-skeleton-extra-md'
              : '';
          const muestraTurno = i % 3 === 0;

          return (
            <div key={i} className={`clientes-card is-skeleton${claseResponsive}`}>
              <div className="clientes-card-cabecera">
                <div className="clientes-card-identidad">
                  <Skeleton width="40px" height="40px" radius="12px" className="flex-shrink-0" />
                  <div className="flex-grow-1 min-w-0 d-flex flex-column gap-2">
                    <Skeleton width={ANCHOS_NOMBRES[i % ANCHOS_NOMBRES.length]} height="0.95rem" />
                    <Skeleton width="3.5rem" height="0.75rem" radius="50rem" />
                  </div>
                </div>
                <Skeleton width="16px" height="16px" radius="4px" className="flex-shrink-0" />
              </div>

              <div className="clientes-card-operativa">
                <Skeleton width="5.5rem" height="0.85rem" />
                {muestraTurno && (
                  <Skeleton width="6.75rem" height="1.35rem" radius="50rem" />
                )}
              </div>

              <div className="clientes-card-pie">
                <Skeleton width="8.5rem" height="0.85rem" />
                <Skeleton width="34px" height="34px" radius="50%" className="flex-shrink-0" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pie de conteo */}
      <Skeleton width="10.5rem" height="0.9rem" />
    </div>
  );
}
