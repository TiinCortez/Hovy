import { Wallet, ClipboardClock, TrendingUp, TrendingDown, Minus, ChartLine, Banknote } from 'lucide-react';
import Card from '../ui/Card';
import { formatearMontoARS } from '../turnos/agendaTurnos';
import { DIAS_ALERTA_COBRO } from '../cobros/cobrosUtils';
import { formatearPorcentaje, formatearDiferencia, porcentaje } from './metricasUtils';

const plural = (cantidad, singular, pluralTexto) => `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;

const IconoVariacion = ({ valor, size = 16 }) => {
  if (valor > 0) return <TrendingUp size={size} aria-hidden="true" />;
  if (valor < 0) return <TrendingDown size={size} aria-hidden="true" />;
  return <Minus size={size} aria-hidden="true" />;
};

// Tarjetas del período: total cobrado, saldo por cobrar y la tarjeta verde con
// el % de turnos cobrados y la comparativa del dinero cobrado contra el período anterior.
export default function MetricasResumen({ resumen, anterior, variacion, etiquetaAnterior }) {
  const liquidado = porcentaje(resumen.cobrado, resumen.facturado);
  const turnosCobrados = porcentaje(resumen.cantidadCobrados, resumen.cantidadTurnos);
  const tendencia = variacion.porcentaje === null ? 'neutra' : (variacion.diferencia < 0 ? 'baja' : 'sube');

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <Card className="h-100 metricas-kpi">
            <div className="d-flex align-items-center justify-content-between">
              <span className="metricas-kpi-titulo">Total cobrado</span>
              <div className="metricas-kpi-icono metricas-kpi-icono--verde"><Wallet size={20} /></div>
            </div>
            <div className="d-flex flex-wrap align-items-baseline gap-3 mt-2">
              <span className="metricas-kpi-valor">{formatearMontoARS(resumen.cobrado)}</span>
              <span className={`metricas-chip metricas-chip--${tendencia === 'baja' ? 'terracota' : 'verde'}`}>
                <IconoVariacion valor={variacion.diferencia} />
                <strong>{variacion.porcentaje === null ? 'Sin datos' : formatearPorcentaje(variacion.porcentaje, { conSigno: true })}</strong>
                <span className="text-secondary fw-normal">vs período anterior</span>
              </span>
            </div>
            <div className="metricas-kpi-pie">
              <div className="metricas-kpi-dato">
                <span>Estado de cartera</span>
                <strong>{plural(resumen.clientesAlDia, 'cliente al día', 'clientes al día')}</strong>
              </div>
              <div className="metricas-kpi-dato">
                <span>Efectividad</span>
                <strong className="metricas-texto-verde">{formatearPorcentaje(liquidado)} liquidado</strong>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-12 col-lg-6">
          <Card className="h-100 metricas-kpi">
            <div className="d-flex align-items-center justify-content-between">
              <span className="metricas-kpi-titulo">Por cobrar / Pendiente</span>
              <div className="metricas-kpi-icono metricas-kpi-icono--terracota"><ClipboardClock size={20} /></div>
            </div>
            <div className="d-flex flex-wrap align-items-baseline gap-3 mt-2">
              <span className="metricas-kpi-valor">{formatearMontoARS(resumen.porCobrar)}</span>
              {resumen.cantidadAtrasados > 0 && (
                <span className="metricas-chip metricas-chip--terracota">
                  <strong>{plural(resumen.cantidadAtrasados, 'turno', 'turnos')}</strong>
                  <span className="text-secondary fw-normal">con más de {DIAS_ALERTA_COBRO} días</span>
                </span>
              )}
            </div>
            <div className="metricas-kpi-pie">
              <div className="metricas-kpi-dato">
                <span>Turnos pendientes</span>
                <strong>{plural(resumen.cantidadPendientes, 'turno sin cobrar', 'turnos sin cobrar')}</strong>
              </div>
              <div className="metricas-kpi-dato">
                <span>Clientes con deuda</span>
                <strong className="metricas-texto-terracota">{plural(resumen.clientesConDeuda, 'cliente', 'clientes')}</strong>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="metricas-hero">
        <svg className="metricas-hero-deco" viewBox="0 0 200 200" aria-hidden="true">
          <path fill="currentColor" d="M40,-60C50,-50,55,-35,62,-20C69,-5,77,10,74,24C71,38,57,51,42,60C27,69,11,74,-5,76C-21,78,-37,77,-49,68C-61,59,-69,42,-72,25C-75,8,-73,-9,-66,-23C-59,-37,-47,-48,-34,-57C-21,-66,-10,-73,3,-75C16,-77,32,-74,40,-60Z" transform="translate(100 100)" />
        </svg>
        <div className="row g-4 align-items-stretch position-relative">
          <div className="col-12 col-lg-6 d-flex flex-column justify-content-center gap-3">
            <span className="metricas-hero-pill"><ChartLine size={16} aria-hidden="true" /> Balance comparativo</span>
            <h2 className="metricas-hero-titulo m-0">
              Turnos cobrados: <span>{formatearPorcentaje(turnosCobrados)}</span>
            </h2>
          </div>

          <div className="col-12 col-sm-6 col-lg-3">
            <div className="metricas-hero-caja">
              <span className="metricas-hero-etiqueta">Variación vs período anterior</span>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="metricas-hero-numero">
                  {variacion.porcentaje === null ? '—' : formatearPorcentaje(variacion.porcentaje, { conSigno: true })}
                </span>
                <span className={`metricas-hero-diferencia ${variacion.diferencia < 0 ? 'is-baja' : ''}`}>
                  {formatearDiferencia(variacion.diferencia)}
                </span>
              </div>
              <span className="metricas-hero-detalle">{etiquetaAnterior}: {formatearMontoARS(anterior.cobrado)}</span>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg-3">
            <div className="metricas-hero-caja">
              <div className="d-flex align-items-center justify-content-between">
                <span className="metricas-hero-etiqueta">Turnos cobrados</span>
                <Banknote size={18} className="metricas-hero-icono" aria-hidden="true" />
              </div>
              <div className="d-flex align-items-center justify-content-between gap-2">
                <span className="metricas-hero-numero text-white">
                  {resumen.cantidadCobrados}<small> de {resumen.cantidadTurnos}</small>
                </span>
                <span className="metricas-hero-detalle text-end">
                  {plural(resumen.cantidadPendientes, 'pendiente', 'pendientes')}
                </span>
              </div>
              <div
                className="metricas-hero-progreso"
                role="progressbar"
                aria-valuenow={turnosCobrados}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Porcentaje de turnos cobrados"
              >
                <span style={{ width: `${Math.min(turnosCobrados, 100)}%` }}></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}