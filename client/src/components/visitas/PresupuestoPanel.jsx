import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Lock, CheckCircle2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import VisitaService from '../../services/api/visita.service';
import { getApiError, formatMoney, INTERNAL_NOTICE } from './visitaUtils';

// Estimate lines table. Internal only: it is never meant to be sent to the client.
export function EstimadoTable({ lineas, total }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle small mb-2">
        <thead>
          <tr className="text-secondary">
            <th>Servicio</th>
            <th className="text-end">m²</th>
            <th className="text-end">Precio por m²</th>
            <th className="text-end">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={l.id_servicio}>
              <td>{l.nombre}</td>
              <td className="text-end">{l.superficie_m2}</td>
              <td className="text-end">{l.precio_m2 != null ? formatMoney(l.precio_m2) : '-'}</td>
              <td className="text-end">{l.subtotal != null ? formatMoney(l.subtotal) : '-'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="fw-bold">
            <td colSpan={3} className="text-end">Total estimado</td>
            <td className="text-end">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function DiferenciaPrecio({ estimado, final }) {
  const diff = Math.round((Number(final) - Number(estimado)) * 100) / 100;
  const color = diff > 0 ? 'text-success' : diff < 0 ? 'text-danger' : 'text-secondary';
  return (
    <div className="row g-0 bg-light rounded-3 border overflow-hidden small">
      <div className="col-4 p-2 px-3 border-end">
        <span className="text-secondary d-block fw-semibold" style={{ fontSize: '0.65rem' }}>Estimado</span>
        <span className="fw-bold text-dark">{formatMoney(estimado)}</span>
      </div>
      <div className="col-4 p-2 px-3 border-end">
        <span className="text-secondary d-block fw-semibold" style={{ fontSize: '0.65rem' }}>Precio final</span>
        <span className="fw-bold text-dark">{formatMoney(final)}</span>
      </div>
      <div className="col-4 p-2 px-3">
        <span className="text-secondary d-block fw-semibold" style={{ fontSize: '0.65rem' }}>Diferencia</span>
        <span className={`fw-bold ${color}`}>{diff > 0 ? '+' : ''}{formatMoney(diff)}</span>
      </div>
    </div>
  );
}

// Steps 2 and 3 of Confirmada: proposed budget (internal estimate) and final price
export default function PresupuestoPanel({ visita, onSaved }) {
  const servicios = Array.isArray(visita.servicios) ? visita.servicios : [];
  const hasServicios = servicios.length > 0;
  const presupuesto = visita.presupuesto;
  const serviciosKey = JSON.stringify(servicios);

  const [estimado, setEstimado] = useState(null);
  const [loading, setLoading] = useState(hasServicios);
  const [loadError, setLoadError] = useState(null);
  const [monto, setMonto] = useState(presupuesto?.monto_total != null ? String(presupuesto.monto_total) : '');
  const [nota, setNota] = useState(presupuesto?.nota || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Re-fetch the estimate whenever the saved services change
  useEffect(() => {
    if (!hasServicios) return undefined;
    let isMounted = true;
    VisitaService.getEstimado(visita.id_solicitud)
      .then((res) => {
        if (!isMounted) return;
        setEstimado(res.data);
        setLoadError(null);
        // Prefill the final price with the estimate unless one was already accepted
        setMonto((prev) => (prev === '' ? String(res.data.total_estimado) : prev));
      })
      .catch((err) => {
        if (isMounted) setLoadError(getApiError(err, 'No se pudo calcular el presupuesto propuesto.'));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [visita.id_solicitud, hasServicios, serviciosKey]);

  const montoValido = Number(monto) > 0;
  const accepted = presupuesto?.estado === 'Aceptado';

  const handleAceptar = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const payload = { monto_total: Number(monto) };
      if (nota.trim()) payload.nota = nota.trim();
      await VisitaService.aceptarPresupuesto(visita.id_solicitud, payload);
      await onSaved('Precio final aceptado.');
    } catch (err) {
      setErrorMessage(getApiError(err, 'No se pudo registrar el precio final.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className={`p-4 ${hasServicios ? '' : 'opacity-50'}`}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <h5 className="fw-bold text-dark m-0">2. Presupuesto propuesto</h5>
          <span className="badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle px-3 py-2 d-flex align-items-center gap-1">
            <Lock size={12} /> {INTERNAL_NOTICE}
          </span>
        </div>
        {!hasServicios ? (
          <p className="text-secondary small m-0">Guardá los servicios para ver el presupuesto propuesto.</p>
        ) : loading ? (
          <div className="text-center py-3"><div className="spinner-border spinner-border-sm" style={{ color: '#1B3006' }} role="status"></div></div>
        ) : loadError ? (
          <p className="text-danger small m-0" role="alert">{loadError}</p>
        ) : estimado && (
          <>
            <EstimadoTable lineas={estimado.lineas} total={estimado.total_estimado} />
            {estimado.advertencias?.map((a) => (
              <div key={a} className="alert alert-warning d-flex align-items-center gap-2 rounded-3 py-2 mb-2 small">
                <AlertTriangle size={16} className="flex-shrink-0" /> {a}
              </div>
            ))}
          </>
        )}
      </Card>

      <Card className={`p-4 ${estimado ? '' : 'opacity-50'}`}>
        <h5 className="fw-bold text-dark mb-1">3. Precio final</h5>
        <p className="text-secondary small mb-3">Podés subir o bajar el estimado. Este es el precio que queda aceptado para el turno.</p>

        {!estimado ? (
          <p className="text-secondary small m-0">Disponible cuando haya un presupuesto propuesto.</p>
        ) : (
          <>
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3" role="alert">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="small fw-medium">{errorMessage}</span>
              </div>
            )}
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold text-secondary" htmlFor="precio-final">Precio final ($)</label>
                <input
                  id="precio-final"
                  type="number"
                  step="any"
                  min="0"
                  className="form-control bg-light rounded-3"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-8">
                <label className="form-label small fw-bold text-secondary" htmlFor="precio-nota">Nota (opcional)</label>
                <input
                  id="precio-nota"
                  type="text"
                  className="form-control bg-light rounded-3"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
              </div>
            </div>
            {montoValido && <div className="mb-3"><DiferenciaPrecio estimado={estimado.total_estimado} final={monto} /></div>}
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <Button
                variant="primary"
                onClick={handleAceptar}
                disabled={isSaving || !montoValido}
                style={{ backgroundColor: '#1B3006', borderColor: '#1B3006' }}
              >
                {isSaving ? 'Guardando...' : accepted ? 'Actualizar precio final' : 'Aceptar precio final'}
              </Button>
              {accepted && (
                <span className="text-success small fw-semibold d-flex align-items-center gap-1">
                  <CheckCircle2 size={16} /> Aceptado: {formatMoney(presupuesto.monto_total)}
                </span>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
