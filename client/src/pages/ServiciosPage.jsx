import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, AlertCircle, Wrench } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ServicioModal from '../components/ui/ServicioModal';
import ServicioEliminarModal from '../components/ui/ServicioEliminarModal';
import ServicioService from '../services/api/servicio.service';

// Case- and accent-insensitive comparison for the search box
const normalize = (text) => (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const formatPrice = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

export default function ServiciosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [mios, setMios] = useState([]); // may include inactive rows; only active ones are listed
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(null); // { mode: 'add' | 'edit' | 'delete', servicio? }

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

      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="text-success fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>Catálogo Operativo</span>
          </div>
          <h2 className="fw-bold fs-2 text-dark m-0">Servicios</h2>
          <p className="text-secondary small m-0">Servicios que ofrecés, con su precio por m² y límite operativo.</p>
        </div>

        <div className="d-flex align-items-center gap-2 w-100 w-md-auto overflow-x-auto pb-1 pb-md-0">
          <Button
            variant="primary"
            className="text-nowrap ms-auto ms-md-0"
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
            placeholder="Buscar por nombre..."
            aria-label="Buscar servicio por nombre"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" style={{ color: '#1B3006' }} role="status"></div></div>
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
        <div className="row g-3">
          {filteredServicios.map((servicio) => (
            <div key={servicio.id_usuario_servicio} className="col-12 col-md-6 col-xl-4">
              <Card className="h-100 p-4 shadow-sm border-0 rounded-4 d-flex flex-column bg-white">

                <div className="d-flex align-items-start gap-3 mb-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 text-success"
                    style={{ width: '48px', height: '48px', backgroundColor: '#E8F5E9' }}
                  >
                    <Wrench size={22} />
                  </div>
                  <div className="flex-grow-1 overflow-hidden mt-1">
                    <h5 className="fw-bold text-dark m-0 fs-5 text-truncate" title={servicio.servicio?.nombre}>{servicio.servicio?.nombre}</h5>
                    <p className="text-secondary small m-0 text-truncate" title={servicio.servicio?.descripcion}>
                      {servicio.servicio?.descripcion || 'Sin descripción'}
                    </p>
                  </div>
                </div>

                <div className="row g-0 mb-4 bg-light rounded-3 border overflow-hidden">
                  <div className="col-6 p-2 px-3 border-end">
                    <span className="text-secondary d-block fw-semibold mb-1" style={{ fontSize: '0.65rem' }}>Precio por m²</span>
                    <span className="fw-bold text-dark small">{formatPrice(servicio.precio_base)}</span>
                  </div>
                  <div className="col-6 p-2 px-3">
                    <span className="text-secondary d-block fw-semibold mb-1" style={{ fontSize: '0.65rem' }}>Límite operativo</span>
                    <span className="fw-bold text-dark small">{servicio.limite_operativo ?? '-'}</span>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2 mt-auto">
                  <Button
                    variant="light"
                    className="flex-grow-1 rounded-pill text-dark fw-bold small d-flex align-items-center justify-content-center gap-2 py-2 bg-light border shadow-sm"
                    onClick={() => setModal({ mode: 'edit', servicio })}
                  >
                    <Pencil size={16} /> Editar
                  </Button>
                  <Button
                    variant="light"
                    icon
                    className="text-danger"
                    aria-label={`Eliminar ${servicio.servicio?.nombre}`}
                    title="Eliminar"
                    onClick={() => setModal({ mode: 'delete', servicio })}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </Card>
            </div>
          ))}
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
