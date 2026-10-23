import { useState, useEffect } from 'react';
import { CalendarCheck, Lock } from 'lucide-react';
import Card from '../ui/Card';
import TurnoService from '../../services/api/turno.service';
import { EstimadoTable, DiferenciaPrecio } from './PresupuestoPanel';
import { formatMoney, formatDia, hhmm, INTERNAL_NOTICE } from './visitaUtils';

// Read-only summary of a visit with a booked turno (backend estado Realizada)
export default function ResumenVisitaPanel({ visita }) {
  const servicios = Array.isArray(visita.servicios) ? visita.servicios : [];
  const presupuesto = visita.presupuesto;
  const [turno, setTurno] = useState(null);
  const [turnoError, setTurnoError] = useState(false);

  useEffect(() => {
    if (!visita.id_turno) return undefined;
    let isMounted = true;
    TurnoService.getById(visita.id_turno)
      .then((res) => { if (isMounted) setTurno(res.data); })
      .catch(() => { if (isMounted) setTurnoError(true); });
    return () => { isMounted = false; };
  }, [visita.id_turno]);

  const totalServicios = servicios.reduce((acc, l) => acc + (l.subtotal ?? 0), 0);
  // The saved budget's estimate already includes the trip cost (fuel to the
  // property); without it the "difference" with the final price would be wrong.
  const totalEstimado = presupuesto?.monto_estimado != null ? Number(presupuesto.monto_estimado) : totalServicios;
  const montoTraslado = Math.max(0, Math.round((totalEstimado - totalServicios) * 100) / 100);
  const franja = turno?.franjaHoraria;

  return (
    <Card className="p-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h5 className="fw-bold text-dark m-0">Resumen</h5>
        <span className="badge rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-1 bg-success text-white">
          <CalendarCheck size={14} /> Turno asignado
        </span>
      </div>

      <div className="p-3 bg-light rounded-4 border border-light-subtle mb-3">
        <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>Turno</div>
        {turno ? (
          <div className="fw-medium text-dark small">
            {formatDia(turno.fechaAsignada)}
            {franja?.horaInicio && franja?.horaFin ? `, de ${hhmm(franja.horaInicio)} a ${hhmm(franja.horaFin)}` : ', sin horario específico'}
          </div>
        ) : (
          <div className="text-secondary small">{turnoError ? 'No se pudo cargar el detalle del turno.' : 'Cargando turno...'}</div>
        )}
      </div>

      {servicios.length > 0 && (
        <div className="mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span className="text-secondary text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>Servicios y estimado</span>
            <span className="badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle d-flex align-items-center gap-1">
              <Lock size={12} /> {INTERNAL_NOTICE}
            </span>
          </div>
          <EstimadoTable lineas={servicios} total={totalEstimado} montoTraslado={montoTraslado} />
        </div>
      )}

      {presupuesto && (
        <div>
          <div className="text-secondary text-uppercase fw-bold mb-2" style={{ fontSize: '0.65rem' }}>Precio final ({presupuesto.estado})</div>
          {servicios.length > 0 ? (
            <DiferenciaPrecio estimado={totalEstimado} final={presupuesto.monto_total} />
          ) : (
            <div className="fw-bold text-dark">{formatMoney(presupuesto.monto_total)}</div>
          )}
          {presupuesto.nota && <p className="text-secondary small mt-2 mb-0">Nota: {presupuesto.nota}</p>}
        </div>
      )}
    </Card>
  );
}
