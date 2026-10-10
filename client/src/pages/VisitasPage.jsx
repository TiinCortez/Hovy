import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertCircle, Phone, MapPin, Ruler, Wrench, CalendarDays, Clock, CalendarCheck } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import VisitaService from '../services/api/visita.service';

// Case- and accent-insensitive comparison for the search box
const normalize = (text) => (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const formatFecha = (valor) => {
  if (!valor) return null;
  return new Date(valor).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
};

const FRANJA_TEXTO = {
  Mañana: 'por la mañana',
  Tarde: 'por la tarde',
  Indistinto: 'en cualquier horario',
};

// Backend state "Realizada" means "turno agendado": it is shown as Confirmada
const getTab = (visita) => (visita.estado === 'Realizada' ? 'Confirmada' : visita.estado);

const TABS = ['Todas', 'Pendiente', 'Contactada', 'Confirmada', 'Cancelada'];

const BADGE_CLASS = {
  Pendiente: 'bg-warning-subtle text-warning border border-warning-subtle',
  Contactada: 'bg-info-subtle text-info border border-info-subtle',
  Confirmada: 'bg-success-subtle text-success border border-success-subtle',
  Cancelada: 'bg-danger-subtle text-danger border border-danger-subtle',
};

const EMPTY_TEXT = {
  Todas: 'Todavía no hay solicitudes de visita.',
  Pendiente: 'No hay visitas en estado Pendiente.',
  Contactada: 'No hay visitas en estado Contactada.',
  Confirmada: 'No hay visitas en estado Confirmada.',
  Cancelada: 'No hay visitas en estado Cancelada.',
};

const time = (visita) => new Date(visita.created_at).getTime() || 0;

export default function VisitasPage() {
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = newest first

  // Fetch once (all states); state is only set inside async callbacks
  useEffect(() => {
    let isMounted = true;

    VisitaService.getAll()
      .then((res) => {
        if (!isMounted) return;
        setVisitas(res.data || []);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error.response?.data?.error || 'No se pudieron cargar las visitas.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [reloadKey]);

  const counts = useMemo(() => {
    const result = { Todas: visitas.length, Pendiente: 0, Contactada: 0, Confirmada: 0, Cancelada: 0 };
    visitas.forEach((v) => {
      const tab = getTab(v);
      if (tab in result) result[tab] += 1;
    });
    return result;
  }, [visitas]);

  const filteredVisitas = useMemo(() => {
    const search = normalize(searchTerm.trim());
    const list = visitas.filter((v) => {
      if (activeTab !== 'Todas' && getTab(v) !== activeTab) return false;
      if (!search) return true;
      return [v.nombre, v.apellido, `${v.nombre || ''} ${v.apellido || ''}`, v.telefono, v.direccion]
        .some((field) => normalize(String(field ?? '')).includes(search));
    });
    return list.sort((a, b) => (sortOrder === 'desc' ? time(b) - time(a) : time(a) - time(b)));
  }, [visitas, activeTab, searchTerm, sortOrder]);

  const handleRetry = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="d-flex flex-column gap-4 pb-5">

      <div>
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="text-success fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>Solicitudes</span>
        </div>
        <h2 className="fw-bold fs-2 text-dark m-0">Visitas</h2>
        <p className="text-secondary small m-0">Todas las solicitudes de visita, en cualquier estado.</p>
      </div>

      <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por estado">
        {TABS.map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'primary' : 'light'}
            className="rounded-pill text-nowrap small fw-semibold"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab} ({counts[tab]})
          </Button>
        ))}
      </div>

      <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-3">
        <div className="input-group bg-white rounded-pill px-3 py-2 border shadow-sm flex-grow-1" style={{ maxWidth: '360px' }}>
          <span className="input-group-text bg-transparent border-0 text-secondary p-0 me-2"><Search size={18} /></span>
          <input
            type="text"
            className="form-control bg-transparent border-0 shadow-none text-dark small p-0"
            placeholder="Buscar por nombre, teléfono o dirección..."
            aria-label="Buscar visitas"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="form-select rounded-pill border shadow-sm small w-auto"
          aria-label="Ordenar por fecha"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          <option value="desc">Más recientes primero</option>
          <option value="asc">Más antiguas primero</option>
        </select>
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
      ) : filteredVisitas.length === 0 ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4">
          <p className="text-secondary m-0">
            {counts[activeTab] === 0 ? EMPTY_TEXT[activeTab] : 'No se encontraron visitas con esa búsqueda.'}
          </p>
        </Card>
      ) : (
        <div className="row g-3">
          {filteredVisitas.map((visita) => {
            const tab = getTab(visita);
            const franja = FRANJA_TEXTO[visita.franja_preferida];
            return (
              <div key={visita.id_solicitud} className="col-12 col-md-6 col-xl-4">
                <Card className="h-100 p-4 shadow-sm border-0 rounded-4 d-flex flex-column bg-white">

                  <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                    <div className="overflow-hidden">
                      <h5 className="fw-bold text-dark m-0 fs-5 text-truncate" title={`${visita.nombre} ${visita.apellido}`}>
                        {visita.nombre} {visita.apellido}
                      </h5>
                      <p className="text-secondary small m-0">Solicitud #{visita.id_solicitud}</p>
                    </div>
                    <div className="d-flex flex-column align-items-end gap-1">
                      <span className={`badge rounded-pill px-3 py-2 fw-semibold ${BADGE_CLASS[tab] || 'bg-secondary-subtle text-secondary'}`}>
                        {tab}
                      </span>
                      {visita.estado === 'Realizada' && (
                        <span className="badge rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-1 bg-success text-white">
                          <CalendarCheck size={12} /> Turno asignado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2 small text-dark mb-4">
                    <div className="d-flex align-items-center gap-2"><Phone size={15} className="text-secondary flex-shrink-0" />+{visita.telefono}</div>
                    <div className="d-flex align-items-start gap-2"><MapPin size={15} className="text-secondary flex-shrink-0 mt-1" /><span>{visita.direccion}</span></div>
                    {visita.superficie_aproximada && (
                      <div className="d-flex align-items-center gap-2"><Ruler size={15} className="text-secondary flex-shrink-0" />{visita.superficie_aproximada} m²</div>
                    )}
                    {visita.servicio && (
                      <div className="d-flex align-items-start gap-2"><Wrench size={15} className="text-secondary flex-shrink-0 mt-1" /><span>{visita.servicio}</span></div>
                    )}
                    {(visita.fecha_preferida || franja) && (
                      <div className="d-flex align-items-center gap-2">
                        <CalendarDays size={15} className="text-secondary flex-shrink-0" />
                        <span>Preferida: {[visita.fecha_preferida, franja].filter(Boolean).join(' · ')}</span>
                      </div>
                    )}
                    <div className="d-flex align-items-center gap-2 text-secondary">
                      <Clock size={15} className="flex-shrink-0" />Solicitada el {formatFecha(visita.created_at)}
                    </div>
                  </div>

                  <Button
                    variant="light"
                    className="mt-auto rounded-pill text-dark fw-bold small py-2 bg-light border shadow-sm"
                    onClick={() => navigate(`/visitas/${visita.id_solicitud}`)}
                  >
                    Ver detalle
                  </Button>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !errorMessage && filteredVisitas.length > 0 && (
        <span className="text-secondary small fw-medium">
          Mostrando {filteredVisitas.length} visita(s)
        </span>
      )}
    </div>
  );
}
