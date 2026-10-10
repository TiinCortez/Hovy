import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserCircle } from 'lucide-react';
import VisitaService from '../../services/api/visita.service';
import VisitasNotificacionesPopover from '../ui/VisitasNotificacionesPopover.jsx';

const INTERVALO_POLLING_MS = 60000;

export default function Header() {
  const navigate = useNavigate();
  const [visitasPendientes, setVisitasPendientes] = useState([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const notificacionesRef = useRef(null);

  // Trae las pendientes al montar y después cada INTERVALO_POLLING_MS: no hay
  // WebSocket/SSE en el proyecto, así que el panel se refresca por polling.
  useEffect(() => {
    const fetchPendientes = async () => {
      try {
        const response = await VisitaService.getPendientes();
        setVisitasPendientes(response.data ?? []);
      } catch (err) {
        console.error('No se pudieron obtener las solicitudes de visita pendientes:', err);
      }
    };

    fetchPendientes();
    const intervalId = setInterval(fetchPendientes, INTERVALO_POLLING_MS);
    return () => clearInterval(intervalId);
  }, []);

  // Cierra el popover al hacer click fuera.
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleClickOutside = (event) => {
      if (notificacionesRef.current && !notificacionesRef.current.contains(event.target)) {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPopoverOpen]);

  const handleVerDetalle = (idSolicitud) => {
    setIsPopoverOpen(false);
    navigate(`/visitas/${idSolicitud}`);
  };

  return (
    // Utilizamos clases utilitarias de Flexbox y Spacing de Bootstrap
    <header className="hovy-header d-flex align-items-center justify-content-between px-4 flex-shrink-0 sticky-top">
      <div className="brand">
        <h1 className="hovy-brand fs-4 m-0">Hovy</h1>
      </div>
      <div className="d-flex align-items-center gap-3">
        <div className="position-relative" ref={notificacionesRef}>
          <button
            className="icon-button p-2 d-flex align-items-center justify-content-center position-relative"
            aria-label="Notificaciones"
            onClick={() => setIsPopoverOpen((prev) => !prev)}
          >
            <Bell size={24} />
            {visitasPendientes.length > 0 && (
              <span
                className="badge rounded-pill bg-danger position-absolute d-flex align-items-center justify-content-center"
                style={{ top: 2, right: 2, minWidth: 18, height: 18, fontSize: '0.65rem', padding: 0 }}
              >
                {visitasPendientes.length}
              </span>
            )}
          </button>
          {isPopoverOpen && (
            <VisitasNotificacionesPopover
              visitas={visitasPendientes}
              onVerDetalle={handleVerDetalle}
            />
          )}
        </div>
        <button className="icon-button p-2 d-flex align-items-center justify-content-center" aria-label="Perfil de usuario">
          <UserCircle size={28} color="#1B3006" />
        </button>
      </div>
    </header>
  );
}