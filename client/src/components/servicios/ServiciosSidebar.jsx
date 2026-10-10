import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import ServicioService from '../../services/api/servicio.service';
import ServicioModal from './ServicioModal';
import ServicioEliminarModal from './ServicioEliminarModal';

const normalize = (text) => (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function ServiciosSidebar() {
  const [mios, setMios] = useState([]); // includes inactive rows
  const [tipos, setTipos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'add' | 'edit' | 'delete', servicio? }

  const [reloadKey, setReloadKey] = useState(0);

  // Mutations await this so the list is refreshed before the modal closes
  const load = useCallback(async () => {
    try {
      const [resMios, resTipos] = await Promise.all([ServicioService.getMios(), ServicioService.getTipos()]);
      setMios(resMios.data || []);
      setTipos(resTipos.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los servicios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load / retry: state is only set inside async callbacks
  useEffect(() => {
    let cancelled = false;
    Promise.all([ServicioService.getMios(), ServicioService.getTipos()])
      .then(([resMios, resTipos]) => {
        if (cancelled) return;
        setMios(resMios.data || []);
        setTipos(resTipos.data || []);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'No se pudieron cargar los servicios.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const activos = useMemo(() => mios.filter((s) => s.activo), [mios]);

  const visibles = useMemo(() => {
    const q = normalize(query.trim());
    return q ? activos.filter((s) => normalize(s.servicio?.nombre).includes(q)) : activos;
  }, [activos, query]);

  // Types not yet active in the user's catalog; inactive ones are reactivated on add
  const tiposDisponibles = useMemo(() => {
    const activeIds = new Set(activos.map((s) => s.id_servicio));
    return tipos.filter((t) => !activeIds.has(t.id_servicio));
  }, [tipos, activos]);

  const reactivable = useMemo(
    () => Object.fromEntries(mios.filter((s) => !s.activo).map((s) => [s.id_servicio, s])),
    [mios]
  );

  const closeModal = () => setModal(null);

  return (
    <section className="servicios-section mt-4 pt-3" aria-label="Servicios">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h2 className="servicios-title mb-0">Servicios</h2>
        <button
          type="button"
          className="servicios-icon-btn"
          aria-label="Agregar servicio"
          title="Agregar servicio"
          onClick={() => setModal({ mode: 'add' })}
          disabled={isLoading || Boolean(error)}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="servicios-search mb-2">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          className="form-control form-control-sm"
          placeholder="Buscar servicio"
          aria-label="Buscar servicio"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading && <p className="small text-secondary mb-0">Cargando...</p>}

      {!isLoading && error && (
        <div className="small text-danger" role="alert">
          {error}{' '}
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => { setIsLoading(true); setReloadKey((k) => k + 1); }}>
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !error && activos.length === 0 && (
        <p className="small text-secondary mb-0">Todavía no agregaste servicios.</p>
      )}

      {!isLoading && !error && activos.length > 0 && visibles.length === 0 && (
        <p className="small text-secondary mb-0">Sin resultados.</p>
      )}

      {!isLoading && !error && visibles.length > 0 && (
        <ul className="servicios-list list-unstyled mb-0">
          {visibles.map((s) => (
            <li key={s.id_usuario_servicio} className="servicios-item">
              <span className="servicios-name" title={s.servicio?.nombre}>{s.servicio?.nombre}</span>
              <span className="servicios-actions">
                <button type="button" className="servicios-icon-btn" aria-label={`Editar ${s.servicio?.nombre}`} title="Editar" onClick={() => setModal({ mode: 'edit', servicio: s })}>
                  <Pencil size={14} />
                </button>
                <button type="button" className="servicios-icon-btn" aria-label={`Eliminar ${s.servicio?.nombre}`} title="Eliminar" onClick={() => setModal({ mode: 'delete', servicio: s })}>
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Mounted only while open so form/error state starts fresh each time */}
      {(modal?.mode === 'add' || modal?.mode === 'edit') && (
        <ServicioModal
          isOpen
          servicio={modal.mode === 'edit' ? modal.servicio : null}
          tipos={tiposDisponibles}
          reactivable={reactivable}
          onClose={closeModal}
          onSaved={load}
        />
      )}
      {modal?.mode === 'delete' && (
        <ServicioEliminarModal isOpen servicio={modal.servicio} onClose={closeModal} onDeleted={load} />
      )}
    </section>
  );
}
