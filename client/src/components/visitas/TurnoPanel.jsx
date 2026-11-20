import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, Clock } from 'lucide-react';
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
  // Preload requested date if valid and future, otherwise default to today
  const fechaInicial = solicitado.fecha && solicitado.fecha >= todayISO() ? solicitado.fecha : todayISO();
  const [fecha, setFecha] = useState(fechaInicial);
  const [slots, setSlots] = useState(null); // null = not queried yet
  const [loadingSlots, setLoadingSlots] = useState(Boolean(fechaInicial) && enabled);
  const [slotKey, setSlotKey] = useState(''); // '' = no specific slot
  const [prioridad, setPrioridad] = useState('P3_Casual');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [mostrarOtraFecha, setMostrarOtraFecha] = useState(false);

  const textoSolicitado = [
    solicitado.fecha ? formatDia(solicitado.fecha) : null,
    solicitado.desde ? `${solicitado.desde} a ${solicitado.hasta}` : solicitado.franja ? `por la ${solicitado.franja === 'Mañana' ? 'mañana' : 'tarde'}` : null,
  ].filter(Boolean).join(', ');

  const diasTira = useMemo(() => {
    const lista = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const pad = (n) => String(n).padStart(2, '0');
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const weekday = d.toLocaleDateString('es-AR', { weekday: 'short' });
      const month = d.toLocaleDateString('es-AR', { month: 'short' });
      lista.push({
        iso,
        diaNum: d.getDate(),
        diaNombre: weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', ''),
        mesNombre: month.charAt(0).toUpperCase() + month.slice(1).replace('.', ''),
        esHoy: i === 0,
        esSolicitado: iso === solicitado.fecha,
      });
    }

    if (
      solicitado.fecha &&
      solicitado.fecha >= todayISO() &&
      !lista.some((item) => item.iso === solicitado.fecha)
    ) {
      const [y, m, d] = String(solicitado.fecha).slice(0, 10).split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const weekday = dateObj.toLocaleDateString('es-AR', { weekday: 'short' });
      const month = dateObj.toLocaleDateString('es-AR', { month: 'short' });
      lista.unshift({
        iso: solicitado.fecha,
        diaNum: dateObj.getDate(),
        diaNombre: weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', ''),
        mesNombre: month.charAt(0).toUpperCase() + month.slice(1).replace('.', ''),
        esHoy: false,
        esSolicitado: true,
      });
    }

    return lista;
  }, [solicitado.fecha]);

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
            <div className="p-3 mb-3 rounded-4 bg-light border border-light-subtle d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div className="d-flex align-items-center gap-2">
                <Clock size={16} className="text-secondary flex-shrink-0" />
                <span className="small text-dark">
                  <span className="fw-bold text-secondary text-uppercase" style={{ fontSize: 'var(--hovy-texto-xs)' }}>El cliente pidió: </span>
                  <span className="fw-semibold">{textoSolicitado}</span>
                </span>
              </div>
              {solicitado.fecha && fecha !== solicitado.fecha && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success rounded-pill fw-semibold py-1 px-3"
                  style={{ fontSize: 'var(--hovy-texto-xs)' }}
                  onClick={() => handleFecha(solicitado.fecha)}
                >
                  Ir al día pedido
                </button>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-3" role="alert">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span className="small fw-medium">{errorMessage}</span>
            </div>
          )}

          {/* Tira Visual de Días (Booking Strip) */}
          <div className="mb-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="form-label small fw-bold text-secondary text-uppercase m-0" style={{ fontSize: 'var(--hovy-texto-xs)' }}>
                Seleccionar día
              </span>
              <button
                type="button"
                className="btn btn-link text-decoration-none p-0 small fw-semibold d-flex align-items-center gap-1"
                style={{ color: VERDE, fontSize: 'var(--hovy-texto-xs)' }}
                onClick={() => setMostrarOtraFecha((prev) => !prev)}
              >
                <Calendar size={13} /> {mostrarOtraFecha ? 'Ocultar selector manual' : 'Elegir otra fecha…'}
              </button>
            </div>

            <div className="d-flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {diasTira.map((d) => {
                const isSelected = fecha === d.iso;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => handleFecha(d.iso)}
                    className={`btn rounded-4 p-2.5 text-center d-flex flex-column align-items-center justify-content-between flex-shrink-0 border shadow-sm transition ${
                      isSelected
                        ? 'text-white'
                        : 'bg-white text-dark border-light-subtle'
                    }`}
                    style={{
                      minWidth: '82px',
                      height: '92px',
                      backgroundColor: isSelected ? 'var(--hovy-verde-900)' : 'var(--hovy-blanco)',
                      borderColor: isSelected ? 'var(--hovy-verde-900)' : undefined,
                    }}
                  >
                    <span
                      className="small fw-bold text-uppercase"
                      style={{
                        fontSize: '10px',
                        color: isSelected ? 'var(--hovy-verde-200)' : 'var(--hovy-gris-500)',
                      }}
                    >
                      {d.esHoy ? 'Hoy' : `${d.diaNombre} ${d.mesNombre}`}
                    </span>

                    <span className="fs-3 fw-bold my-auto lh-1">
                      {d.diaNum}
                    </span>

                    {d.esSolicitado ? (
                      <span
                        className="badge rounded-pill fw-bold text-dark px-1.5 py-0.5"
                        style={{ backgroundColor: 'var(--hovy-ambar-400)', fontSize: '9px' }}
                      >
                        PEDIDO
                      </span>
                    ) : (
                      <span
                        className="small"
                        style={{ fontSize: '9px', opacity: isSelected ? 0.9 : 0.6 }}
                      >
                        {d.diaNombre}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {mostrarOtraFecha && (
              <div className="mt-2 p-3 bg-light rounded-3 border border-light-subtle d-flex flex-wrap align-items-center gap-3">
                <div className="flex-grow-1" style={{ maxWidth: '240px' }}>
                  <label className="form-label small fw-bold text-secondary mb-1" htmlFor="turno-fecha-otra">
                    Fecha personalizada
                  </label>
                  <input
                    id="turno-fecha-otra"
                    type="date"
                    min={todayISO()}
                    className="form-control form-control-sm bg-white rounded-3"
                    value={fecha}
                    onChange={(e) => handleFecha(e.target.value)}
                  />
                </div>
                <div className="small text-secondary align-self-end pb-1">
                  Fecha activa: <strong>{formatDia(fecha)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Horarios disponibles */}
          {fecha && (
            <div className="mb-3 pt-1">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="form-label small fw-bold text-secondary text-uppercase m-0" style={{ fontSize: 'var(--hovy-texto-xs)' }}>
                  Horarios disponibles para {formatDia(fecha)}
                </span>
                {slots && (
                  <span className="text-secondary small" style={{ fontSize: 'var(--hovy-texto-xs)' }}>
                    {slots.length} {slots.length === 1 ? 'horario libre' : 'horarios libres'}
                  </span>
                )}
              </div>

              {loadingSlots ? (
                <div className="d-flex align-items-center gap-2 text-secondary small py-2">
                  <div className="spinner-border spinner-border-sm" style={{ color: VERDE }} role="status"></div>
                  <span>Consultando disponibilidad…</span>
                </div>
              ) : slots && (
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    variant={slotKey === '' ? 'primary' : 'light'}
                    className="rounded-pill small px-3 py-1.5"
                    style={slotKey === '' ? { backgroundColor: VERDE, borderColor: VERDE } : undefined}
                    onClick={() => setSlotKey('')}
                  >
                    Sin horario específico
                  </Button>
                  {slots.map((s) => {
                    const key = `${hhmm(s.inicio_desde)}|${hhmm(s.hasta)}`;
                    const esSlotPedido = solicitado.desde && hhmm(s.inicio_desde) === solicitado.desde && hhmm(s.hasta) === solicitado.hasta;
                    const isSelected = slotKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSlotKey(key)}
                        className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1.5 border shadow-sm transition ${
                          isSelected
                            ? 'text-white'
                            : 'bg-white text-dark border-light-subtle'
                        }`}
                        style={isSelected ? { backgroundColor: VERDE, borderColor: VERDE } : undefined}
                      >
                        <span>{hhmm(s.inicio_desde)} - {hhmm(s.hasta)}</span>
                        {esSlotPedido && (
                          <span
                            className={`badge rounded-pill fw-bold ${isSelected ? 'bg-warning text-dark' : 'bg-warning-subtle text-warning-emphasis'}`}
                            style={{ fontSize: '9px' }}
                          >
                            PEDIDO
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {slots.length === 0 && (
                    <span className="text-secondary small align-self-center fst-italic">
                      No hay horarios libres ese día. Podés asignar sin horario o elegir otro día.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prioridad */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-secondary text-uppercase" style={{ fontSize: 'var(--hovy-texto-xs)' }} htmlFor="turno-prioridad">
                Prioridad
              </label>
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
