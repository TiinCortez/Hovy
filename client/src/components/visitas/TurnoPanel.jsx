import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import VisitaService from '../../services/api/visita.service';
import { PRIORIDADES, getApiError, formatDia, hhmm, horarioSolicitado, slotSolicitado } from './visitaUtils';
import { VERDE } from '../../styles/colores';

const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Step 4 of Confirmada: pick day + slot (or no specific slot) and book the turno.
// `enabled` is false until the final price is accepted (the backend would answer 409).
export default function TurnoPanel({ visita, enabled, onSaved }) {
  const solicitado = horarioSolicitado(visita);
  // The day the client asked for comes preloaded, unless it is already in the past.
  const fechaInicial = solicitado.fecha && solicitado.fecha >= todayISO() ? solicitado.fecha : '';
  const [fecha, setFecha] = useState(fechaInicial);
  const [slots, setSlots] = useState(null); // null = not queried yet
  const [loadingSlots, setLoadingSlots] = useState(Boolean(fechaInicial) && enabled);
  const [slotKey, setSlotKey] = useState(''); // '' = no specific slot
  const [prioridad, setPrioridad] = useState('P3_Casual');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const textoSolicitado = [
    solicitado.fecha ? formatDia(solicitado.fecha) : null,
    solicitado.desde ? `${solicitado.desde} a ${solicitado.hasta}` : solicitado.franja ? `por la ${solicitado.franja === 'Mañana' ? 'mañana' : 'tarde'}` : null,
  ].filter(Boolean).join(', ');

  // Loads the free slots of a day. `preseleccionar` picks the slot the client asked for.
  const cargarSlots = async (value, preseleccionar = false) => {
    setFecha(value);
    setSlotKey('');
    setSlots(null);
    setErrorMessage(null);
    if (!value) return;
    setLoadingSlots(true);
    try {
      const res = await VisitaService.getDisponibilidad(visita.id_solicitud, { fecha: value });
      const disponibles = res.data?.[0]?.disponibles || [];
      setSlots(disponibles);
      if (preseleccionar) {
        const elegido = slotSolicitado(disponibles, solicitado);
        if (elegido) setSlotKey(`${hhmm(elegido.inicio_desde)}|${hhmm(elegido.hasta)}`);
      }
    } catch (err) {
      setErrorMessage(getApiError(err, 'No se pudo consultar la disponibilidad.'));
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleFecha = (value) => cargarSlots(value, value === solicitado.fecha);

  // Free slots of the preloaded day, with the one the client asked for preselected.
  useEffect(() => {
    if (!enabled || !fechaInicial) return undefined;
    let cancelled = false;
    VisitaService.getDisponibilidad(visita.id_solicitud, { fecha: fechaInicial })
      .then((res) => {
        if (cancelled) return;
        const disponibles = res.data?.[0]?.disponibles || [];
        setSlots(disponibles);
        const elegido = slotSolicitado(disponibles, solicitado);
        if (elegido) setSlotKey(`${hhmm(elegido.inicio_desde)}|${hhmm(elegido.hasta)}`);
      })
      .catch((err) => { if (!cancelled) setErrorMessage(getApiError(err, 'No se pudo consultar la disponibilidad.')); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
    // Only when the step opens: after that the admin drives the date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, visita.id_solicitud]);

  const handleAsignar = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const payload = { fecha_programada: fecha, prioridad };
      if (slotKey) {
        const [inicio, hasta] = slotKey.split('|');
        payload.inicio_desde = inicio;
        payload.hasta = hasta;
      }
      await VisitaService.agendarTurno(visita.id_solicitud, payload);
      await onSaved('Turno asignado.');
    } catch (err) {
      setErrorMessage(getApiError(err, 'No se pudo asignar el turno.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className={`p-4 ${enabled ? '' : 'opacity-50'}`}>
      <h5 className="fw-bold text-dark mb-1">4. Turno</h5>
      {!enabled ? (
        <p className="text-secondary small m-0">Disponible cuando el precio final esté aceptado.</p>
      ) : (
        <>
          <p className="text-secondary small mb-3">Elegí el día y, si querés, un horario disponible.</p>
          {textoSolicitado && (
            <p className="small mb-3 p-2 px-3 rounded-3 bg-light border">
              <span className="fw-bold text-secondary">El cliente pidió:</span> {textoSolicitado}
            </p>
          )}

          {errorMessage && (
            <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3" role="alert">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span className="small fw-medium">{errorMessage}</span>
            </div>
          )}

          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-secondary" htmlFor="turno-fecha">Fecha</label>
              <input
                id="turno-fecha"
                type="date"
                min={todayISO()}
                className="form-control bg-light rounded-3"
                value={fecha}
                onChange={(e) => handleFecha(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-secondary" htmlFor="turno-prioridad">Prioridad</label>
              <select
                id="turno-prioridad"
                className="form-select bg-light rounded-3"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
              >
                {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {fecha && (
            <div className="mb-3">
              <span className="form-label small fw-bold text-secondary d-block mb-2">Horarios disponibles</span>
              {loadingSlots ? (
                <div className="spinner-border spinner-border-sm" style={{ color: VERDE }} role="status"></div>
              ) : slots && (
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    variant={slotKey === '' ? 'primary' : 'light'}
                    className="rounded-pill small"
                    onClick={() => setSlotKey('')}
                  >
                    Sin horario específico
                  </Button>
                  {slots.map((s) => {
                    const key = `${hhmm(s.inicio_desde)}|${hhmm(s.hasta)}`;
                    return (
                      <Button
                        key={key}
                        variant={slotKey === key ? 'primary' : 'light'}
                        className="rounded-pill small"
                        onClick={() => setSlotKey(key)}
                      >
                        {hhmm(s.inicio_desde)} - {hhmm(s.hasta)}
                      </Button>
                    );
                  })}
                  {slots.length === 0 && <span className="text-secondary small align-self-center">No hay horarios libres ese día.</span>}
                </div>
              )}
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleAsignar}
            disabled={isSaving || !fecha}
            style={{ backgroundColor: VERDE, borderColor: VERDE }}
          >
            {isSaving ? 'Asignando…' : 'Asignar turno'}
          </Button>
        </>
      )}
    </Card>
  );
}
