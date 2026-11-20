import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, AlertCircle, Wrench } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ServicioModal from '../components/ui/ServicioModal';
import ServicioEliminarModal from '../components/ui/ServicioEliminarModal';
import ServicioService from '../services/api/servicio.service';
import ServiciosSkeleton from '../components/skeletons/ServiciosSkeleton';

// Case- and accent-insensitive comparison for the search box
const normalize = (text) => (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const formatPrice = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

export default function ServiciosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [mios, setMios] = useState([]); // may include inactive rows; only active ones are listed
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(() => (location.state?.openNewServiceModal ? { mode: 'add' } : null)); // { mode: 'add' | 'edit' | 'delete', servicio? }

  useEffect(() => {
    if (location.state?.openNewServiceModal) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Mutations await this so the list is refreshed before the modal closes
  const loadServicios = useCallback(async () => {
    try {
      const [resMios, resTipos] = await Promise.all([ServicioService.getMios(), ServicioService.getTipos()]);
      setMios(resMios.data || []);
      setTipos(resTipos.data || []);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'No se pudieron cargar los servicios.');
    }
  }, []);

  // Initial load / retry: state is only set inside async callbacks
  useEffect(() => {
    let isMounted = true;

    Promise.all([ServicioService.getMios(), ServicioService.getTipos()])
      .then(([resMios, resTipos]) => {
        if (!isMounted) return;
        setMios(resMios.data || []);
        setTipos(resTipos.data || []);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error.response?.data?.error || 'No se pudieron cargar los servicios.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [reloadKey]);

  const activos = useMemo(() => mios.filter((s) => s.activo), [mios]);

  const filteredServicios = useMemo(() => {
    const search = normalize(searchTerm.trim());
    return search ? activos.filter((s) => normalize(s.servicio?.nombre).includes(search)) : activos;
  }, [activos, searchTerm]);

  const handleRetry = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const closeModal = () => setModal(null);

  return (
    <div className="d-flex flex-column gap-4 pb-5">

      {/* Title and main action share a row (also on mobile) */}
      <div>
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="hovy-rotulo">Catálogo Operativo</span>
        </div>
        <div className="d-flex align-items-center justify-content-between gap-3">
          <h2 className="fw-bold fs-2 text-dark m-0">Servicios</h2>
          <Button
            variant="primary"
            className="text-nowrap flex-shrink-0"
            onClick={() => setModal({ mode: 'add' })}
            disabled={loading || Boolean(errorMessage)}
          >
            <Plus size={16} /> Nuevo Servicio
          </Button>
        </div>
      </div>

      <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center justify-content-between gap-3 mt-2">
        <div className="input-group bg-white rounded-pill px-3 py-2 border shadow-sm flex-grow-1" style={{ maxWidth: '300px' }}>
          <span className="input-group-text bg-transparent border-0 text-secondary p-0 me-2"><Search size={18} /></span>
          <input
            type="text"
            className="form-control bg-transparent border-0 shadow-none text-dark small p-0"
            placeholder="Buscar por nombre…"
            aria-label="Buscar servicio por nombre"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <ServiciosSkeleton />
      ) : errorMessage ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4">
          <div className="d-flex align-items-center justify-content-center gap-2 text-danger mb-3" role="alert">
            <AlertCircle size={18} />
            <span className="small fw-medium">{errorMessage}</span>
          </div>
          <div><Button variant="light" onClick={handleRetry}>Reintentar</Button></div>
        </Card>
      ) : filteredServicios.length === 0 ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4">
          <p className="text-secondary m-0">
            {activos.length === 0 ? 'Todavía no agregaste servicios a tu catálogo.' : 'No se encontraron servicios con esa búsqueda.'}
          </p>
        </Card>
      ) : (
        <div className="servicios-grid">
          {filteredServicios.map((servicio) => {
            const nombre = servicio.servicio?.nombre || '';
            const descripcion = servicio.servicio?.descripcion;

            return (
              <article key={servicio.id_usuario_servicio} className="servicio-card">
                <header className="servicio-card-header">
                  <div className="servicio-card-icono" aria-hidden="true">
                    <Wrench size={20} />
                  </div>
                  <h3 className="servicio-card-titulo" title={nombre}>{nombre}</h3>
                </header>

                <p className={`servicio-card-descripcion${descripcion ? '' : ' is-empty'}`} title={descripcion || undefined}>
                  {descripcion || 'Sin descripción'}
                </p>

                <div className="servicio-card-precio">
                  <span className="servicio-card-precio-label">Precio por m²</span>
                  <span className="servicio-card-precio-valor">{formatPrice(servicio.precio_base)}</span>
                </div>

                <footer className="servicio-card-acciones">
                  <Button
                    variant="light"
                    size="sm"
                    className="flex-grow-1"
                    onClick={() => setModal({ mode: 'edit', servicio })}
                  >
                    <Pencil size={15} aria-hidden="true" /> Editar
                  </Button>
                  <Button
                    variant="light"
                    icon
                    className="servicio-card-eliminar"
                    aria-label={`Eliminar ${nombre}`}
                    title="Eliminar"
                    onClick={() => setModal({ mode: 'delete', servicio })}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </Button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !errorMessage && filteredServicios.length > 0 && (
        <span className="text-secondary small fw-medium">
          Mostrando {filteredServicios.length} servicio(s)
        </span>
      )}

      {/* Mounted only while open so form/error state starts fresh each time */}
      {(modal?.mode === 'add' || modal?.mode === 'edit') && (
        <ServicioModal
          isOpen
          servicio={modal.mode === 'edit' ? modal.servicio : null}
          tipos={tipos}
          onClose={closeModal}
          onSaved={loadServicios}
        />
      )}
      {modal?.mode === 'delete' && (
        <ServicioEliminarModal isOpen servicio={modal.servicio} onClose={closeModal} onDeleted={loadServicios} />
      )}
    </div>
  );
}
