import { BadgeCheck, Hourglass, CheckCircle } from 'lucide-react';
import Card from '../ui/Card';
import { formatearMontoARS } from '../turnos/agendaTurnos';
import { DIAS_ALERTA_COBRO } from './cobrosUtils';

const etiquetaStyle = { fontSize: '0.68rem', letterSpacing: '0.05em' };

// Tarjetas de resumen del mes: recaudado, saldo por cobrar y turnos ejecutados
export default function CobrosResumen({ resumen }) {
  const {
    recaudado, porCobrar, porcentaje,
    cantidadCobrados, cantidadPendientes, cantidadAtrasados,
  } = resumen;
  const cantidadTotal = cantidadCobrados + cantidadPendientes;

  return (
    <div className="row g-3">
      <div className="col-12 col-md-6 col-xl-4">
        <Card className="h-100 position-relative overflow-hidden">
          <div className="cobros-kpi-deco cobros-kpi-deco--verde" aria-hidden="true"></div>
          <div className="position-relative">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-secondary fw-bold text-uppercase" style={etiquetaStyle}>Total recaudado</span>
              <div className="cobros-kpi-icono cobros-kpi-icono--verde"><BadgeCheck size={20} /></div>
            </div>
            <div className="d-flex align-items-baseline flex-wrap gap-2">
              <span className="cobros-kpi-valor" style={{ color: '#496544' }}>{formatearMontoARS(recaudado)}</span>
              <span className="badge rounded-pill cobros-badge-verde">{porcentaje.toLocaleString('es-AR')}%</span>
            </div>
            <div className="cobros-progreso mt-3" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} aria-label="Porcentaje recaudado">
              <span style={{ width: `${Math.min(porcentaje, 100)}%` }}></span>
            </div>
          </div>
        </Card>
      </div>

      <div className="col-12 col-md-6 col-xl-4">
        <Card className="h-100 position-relative overflow-hidden">
          <div className="cobros-kpi-deco cobros-kpi-deco--terracota" aria-hidden="true"></div>
          <div className="position-relative">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-secondary fw-bold text-uppercase" style={etiquetaStyle}>Saldo por cobrar</span>
              <div className="cobros-kpi-icono cobros-kpi-icono--terracota"><Hourglass size={20} /></div>
            </div>
            <div className="d-flex align-items-baseline flex-wrap gap-2">
              <span className="cobros-kpi-valor" style={{ color: '#C87D55' }}>{formatearMontoARS(porCobrar)}</span>
              <span className="badge rounded-pill cobros-badge-terracota">
                {cantidadPendientes} {cantidadPendientes === 1 ? 'turno' : 'turnos'}
              </span>
            </div>
            {cantidadAtrasados > 0 && (
              <div className="d-flex align-items-center gap-2 mt-2 small text-secondary">
                <span className="cobros-punto-alerta" aria-hidden="true"></span>
                {cantidadAtrasados} {cantidadAtrasados === 1 ? 'turno' : 'turnos'} con más de {DIAS_ALERTA_COBRO} días sin cobrar
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="col-12 col-md-6 col-xl-4">
        <Card className="h-100 position-relative overflow-hidden">
          <div className="cobros-kpi-deco cobros-kpi-deco--neutro" aria-hidden="true"></div>
          <div className="position-relative">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-secondary fw-bold text-uppercase" style={etiquetaStyle}>Turnos ejecutados</span>
              <div className="cobros-kpi-icono cobros-kpi-icono--neutro"><CheckCircle size={20} /></div>
            </div>
            <div className="d-flex align-items-baseline gap-2">
              <span className="cobros-kpi-valor" style={{ color: '#173313' }}>{cantidadTotal}</span>
              <span className="small text-secondary fw-medium">
                {cantidadTotal === 1 ? 'turno finalizado' : 'turnos finalizados'}
              </span>
            </div>
            <div className="d-flex align-items-center gap-2 mt-2 small fw-semibold">
              <span style={{ color: '#496544' }}>{cantidadCobrados} cobrados</span>
              <span className="text-secondary opacity-50">•</span>
              <span style={{ color: '#C87D55' }}>{cantidadPendientes} pendientes</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}