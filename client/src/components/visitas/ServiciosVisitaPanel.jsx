import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ServicioService from '../../services/api/servicio.service';
import VisitaService from '../../services/api/visita.service';
import { getApiError, formatMoney } from './visitaUtils';
import { VERDE } from '../../styles/colores';

const normalizeServiceText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const matchesRequestedService = (catalogName, requestedService) => {
  const normCatalog = normalizeServiceText(catalogName);
  const normRequested = normalizeServiceText(requestedService);
  if (!normCatalog || !normRequested) return false;
  if (normCatalog === normRequested) return true;
  const parts = normRequested.split(/[,;/]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.includes(normCatalog)) return true;
  return normRequested.includes(normCatalog) || normCatalog.includes(normRequested);
};

// Step 1 of Confirmada: pick services from the admin's active catalog and set m2 per service
export default function ServiciosVisitaPanel({ visita, onSaved }) {
  const defaultM2 = visita.superficie_aproximada != null ? String(visita.superficie_aproximada) : '';
  const saved = Array.isArray(visita.servicios) ? visita.servicios : [];

  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // { [id_servicio]: m2 as string } for the selected services
  const [selected, setSelected] = useState(() =>
    Object.fromEntries(saved.map((s) => [s.id_servicio, String(s.superficie_m2)]))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    ServicioService.getMios()
      .then((res) => {
        if (!isMounted) return;
        const activos = (res.data || []).filter((s) => s.activo);
        setCatalogo(activos);
        if (saved.length === 0 && visita.servicio) {
          const matched = activos.filter((s) =>
            matchesRequestedService(s.servicio?.nombre, visita.servicio)
          );
          if (matched.length > 0) {
            setSelected((prev) => {
              if (Object.keys(prev).length > 0) return prev;
              return Object.fromEntries(
                matched.map((s) => [s.id_servicio, defaultM2])
              );
            });
          }
        }
      })
      .catch((err) => {
        if (isMounted) setLoadError(getApiError(err, 'No se pudo cargar tu catálogo de servicios.'));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [defaultM2, saved.length, visita.servicio]);

  const toggle = (id) => {
    setJustSaved(false);
    setSelected((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = defaultM2;
      return next;
    });
  };

  const setM2 = (id, value) => {
    setJustSaved(false);
    setSelected((prev) => ({ ...prev, [id]: value }));
  };

  const ids = Object.keys(selected);
  const invalid = ids.some((id) => !(Number(selected[id]) > 0));

  const handleSave = async () => {
    setIsSaving(true);
    setJustSaved(false);
    setErrorMessage(null);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      const servicios = ids.map((id) => ({ id_servicio: Number(id), superficie_m2: Number(selected[id]) }));
      await VisitaService.setServicios(visita.id_solicitud, servicios);
      await onSaved('Servicios guardados.');
      setJustSaved(true);
      saveTimerRef.current = setTimeout(() => {
        setJustSaved(false);
      }, 2600);
    } catch (err) {
      setErrorMessage(getApiError(err, 'No se pudieron guardar los servicios.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <h5 className="fw-bold text-dark mb-1">1. Servicios y superficie</h5>
      <p className="text-secondary small mb-3">Elegí los servicios de tu catálogo y los m² de cada uno. Al guardar se reemplaza el conjunto anterior.</p>

      {errorMessage && (
        <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3" role="alert">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span className="small fw-medium">{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-3"><div className="spinner-border spinner-border-sm" style={{ color: VERDE }} role="status"></div></div>
      ) : loadError ? (
        <p className="text-danger small m-0" role="alert">{loadError}</p>
      ) : catalogo.length === 0 ? (
        <p className="text-secondary small m-0">No tenés servicios activos en tu catálogo. Agregalos desde la sección Servicios.</p>
      ) : (
        <div className="d-flex flex-column gap-2 mb-3">
          {catalogo.map((s) => {
            const checked = s.id_servicio in selected;
            return (
              <div key={s.id_servicio} className="d-flex align-items-center gap-3 p-2 px-3 bg-light rounded-3 border flex-wrap">
                <div className="form-check flex-grow-1 m-0">
                  <input
                    id={`servicio-${s.id_servicio}`}
                    type="checkbox"
                    className="form-check-input"
                    checked={checked}
                    onChange={() => toggle(s.id_servicio)}
                  />
                  <label className="form-check-label small fw-semibold text-dark" htmlFor={`servicio-${s.id_servicio}`}>
                    {s.servicio?.nombre} <span className="text-secondary fw-normal">({formatMoney(s.precio_base)}/m²)</span>
                  </label>
                </div>
                {checked && (
                  <div className="input-group input-group-sm" style={{ maxWidth: '140px' }}>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-control"
                      aria-label={`m² de ${s.servicio?.nombre}`}
                      value={selected[s.id_servicio]}
                      onChange={(e) => setM2(s.id_servicio, e.target.value)}
                    />
                    <span className="input-group-text">m²</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="d-flex align-items-center gap-3 flex-wrap">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving || loading || ids.length === 0 || invalid}
          className={`d-inline-flex align-items-center gap-2 ${justSaved ? 'btn-servicio-guardado' : ''}`}
          style={{ backgroundColor: VERDE, borderColor: VERDE }}
        >
          {isSaving ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              Guardando…
            </>
          ) : justSaved ? (
            <>
              <CheckCircle2 size={18} className="servicio-check-icon" aria-hidden="true" />
              Guardado
            </>
          ) : (
            'Guardar servicios'
          )}
        </Button>

        {justSaved && (
          <span
            className="text-success small fw-semibold d-inline-flex align-items-center gap-1 servicio-guardado-feedback"
            role="status"
          >
            <CheckCircle2 size={16} aria-hidden="true" /> Servicios guardados
          </span>
        )}
      </div>
      {ids.length > 0 && invalid && <p className="text-danger small mt-2 mb-0">Cada servicio necesita m² mayores a 0.</p>}
    </Card>
  );
}
