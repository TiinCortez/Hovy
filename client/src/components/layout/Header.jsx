import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserCircle } from 'lucide-react';
import NotificacionService from '../../services/api/notificacion.service';
import AuthService from '../../services/auth.service.js';
import NotificacionesPopover from '../notificaciones/NotificacionesPopover.jsx';
import { EVENTO_NOTIFICACIONES_ACTUALIZADAS } from '../notificaciones/notificacionesConfig.js';
import UserMenuPopover from '../ui/UserMenuPopover.jsx';
import { VERDE } from '../../styles/colores';

const INTERVALO_POLLING_MS = 60000;

export default function Header() {
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const notificacionesRef = useRef(null);
  const userMenuRef = useRef(null);

  // Trae las notificaciones activas al montar, cada INTERVALO_POLLING_MS y cuando
  // otra pantalla avisa que cambiaron (cancelar/restaurar). No hay WebSocket/SSE.
  useEffect(() => {
    const fetchNotificaciones = async () => {
      try {
        const response = await NotificacionService.getActivas();
        setNotificaciones(response.data ?? []);
      } catch (err) {
        console.error('No se pudieron obtener las notificaciones:', err);
      }
    };

    fetchNotificaciones();
    const intervalId = setInterval(fetchNotificaciones, INTERVALO_POLLING_MS);
    window.addEventListener(EVENTO_NOTIFICACIONES_ACTUALIZADAS, fetchNotificaciones);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener(EVENTO_NOTIFICACIONES_ACTUALIZADAS, fetchNotificaciones);
    };
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

  const handleAbrirNotificacion = (destino) => {
    setIsPopoverOpen(false);
    navigate(destino.to, { state: destino.state });
  };

  const handleVerTodas = () => {
    setIsPopoverOpen(false);
    navigate('/dashboard#alertas-notificaciones');
  };

  return (
    // Utilizamos clases utilitarias de Flexbox y Spacing de Bootstrap
    <header className="hovy-header d-flex align-items-center justify-content-between flex-shrink-0 sticky-top">
      <div className="brand hovy-header-brand d-flex align-items-center ps-3 ps-md-4">
        <img src="/hovy-emblema.webp" alt="" className="hovy-header-emblema" />
        <span className="hovy-header-nombre">Hovy</span>
        <span className="hovy-header-divisor d-none d-sm-block" aria-hidden="true" />
        <span className="hovy-header-subtitulo d-none d-sm-block">Gestión de<br />espacios verdes</span>
      </div>
      <div className="d-flex align-items-center gap-3">
        <div className="position-relative" ref={notificacionesRef}>
          <button
            className="icon-button p-2 d-flex align-items-center justify-content-center position-relative"
            aria-label="Notificaciones"
            onClick={handleToggleNotificaciones}
          >
            <Bell size={24} />
            {notificaciones.length > 0 && (
              <span
                className="badge rounded-pill bg-danger position-absolute d-flex align-items-center justify-content-center"
                style={{ top: 2, right: 2, minWidth: 18, height: 18, fontSize: '0.65rem', padding: 0 }}
              >
                {notificaciones.length}
              </span>
            )}
          </button>
          {isPopoverOpen && (
            <NotificacionesPopover
              notificaciones={notificaciones}
              onAbrir={handleAbrirNotificacion}
              onVerTodas={handleVerTodas}
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
            <UserCircle size={28} color={VERDE} />
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