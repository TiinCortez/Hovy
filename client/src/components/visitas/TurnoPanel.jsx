import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import VisitaService from '../../services/api/visita.service';
import { PRIORIDADES, getApiError, hhmm } from './visitaUtils';

const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Step 4 of Confirmada: pick day + slot (or no specific slot) and book the turno.
// `enabled` is false until the final price is accepted (the backend would answer 409).
export default function TurnoPanel({ visita, enabled, onSaved }) {
  const [fecha, setFecha] = useState('');
  const [slots, setSlots] = useState(null); // null = not queried yet
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotKey, setSlotKey] = useState(''); // '' = no specific slot
  const [prioridad, setPrioridad] = useState('P3_Casual');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleFecha = async (value) => {
    setFecha(value);
    setSlotKey('');
    setSlots(null);
    setErrorMessage(null);
    if (!value) return;
    setLoadingSlots(true);
    try {
      const res = await VisitaService.getDisponibilidad(visita.id_solicitud, { fecha: value });
      setSlots(res.data?.[0]?.disponibles || []);
    } catch (err) {
      setErrorMessage(getApiError(err, 'No se pudo consultar la disponibilidad.'));
    } finally {
      setLoadingSlots(false);
    }
  };

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
                <div className="spinner-border spinner-border-sm" style={{ color: '#1B3006' }} role="status"></div>
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
            style={{ backgroundColor: '#1B3006', borderColor: '#1B3006' }}
          >
            {isSaving ? 'Asignando...' : 'Asignar turno'}
          </Button>
        </>
      )}
    </Card>
  );
}
