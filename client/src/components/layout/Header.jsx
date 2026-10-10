import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserCircle } from 'lucide-react';
import VisitaService from '../../services/api/visita.service';
import AuthService from '../../services/auth.service.js';
import VisitasNotificacionesPopover from '../ui/VisitasNotificacionesPopover.jsx';
import UserMenuPopover from '../ui/UserMenuPopover.jsx';

const INTERVALO_POLLING_MS = 60000;

export default function Header() {
  const navigate = useNavigate();
  const [visitasPendientes, setVisitasPendientes] = useState([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const notificacionesRef = useRef(null);
  const userMenuRef = useRef(null);

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

  // Cierra el menú de usuario al hacer click fuera o presionar Escape.
  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isUserMenuOpen]);

  // Solo un popover abierto a la vez.
  const handleToggleNotificaciones = () => {
    setIsUserMenuOpen(false);
    setIsPopoverOpen((prev) => !prev);
  };

  const handleToggleUserMenu = () => {
    setIsPopoverOpen(false);
    setIsUserMenuOpen((prev) => !prev);
  };

  const handleNavigateMenu = (path) => {
    setIsUserMenuOpen(false);
    navigate(path);
  };

  const handleCerrarSesion = () => {
    setIsUserMenuOpen(false);
    AuthService.logout(() => navigate('/login'));
  };

  const handleVerDetalle =(idSolicitud) => {
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
            onClick={handleToggleNotificaciones}
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
        <div className="position-relative" ref={userMenuRef}>
          <button
            className="icon-button p-2 d-flex align-items-center justify-content-center"
            aria-label="Perfil de usuario"
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            onClick={handleToggleUserMenu}
          >
            <UserCircle size={28} color="#1B3006" />
          </button>
          {isUserMenuOpen && (
            <UserMenuPopover
              onPerfil={() => handleNavigateMenu('/perfil')}
              onConfiguracion={() => handleNavigateMenu('/configuracion')}
              onCerrarSesion={handleCerrarSesion}
            />
          )}
        </div>
      </div>
    </header>
  );
}