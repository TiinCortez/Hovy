import { User, Settings, LogOut } from 'lucide-react';

export default function UserMenuPopover({ onPerfil, onConfiguracion, onCerrarSesion }) {
  return (
    <div
      className="user-menu-popover shadow-lg rounded-4 p-0 overflow-hidden"
      style={{ zIndex: 1050 }}
      role="menu"
      aria-label="Menú de usuario"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onPerfil}
        className="visitas-popover-item w-100 text-start bg-transparent border-0 px-3 py-3 d-flex align-items-center gap-3"
      >
        <User size={18} className="text-secondary flex-shrink-0" />
        <span className="small text-dark">Perfil</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onConfiguracion}
        className="visitas-popover-item w-100 text-start bg-transparent border-0 px-3 py-3 d-flex align-items-center gap-3"
      >
        <Settings size={18} className="text-secondary flex-shrink-0" />
        <span className="small text-dark">Configuración</span>
      </button>

      <hr className="m-0" style={{ borderColor: '#D1D1C4', opacity: 1 }} />

      <button
        type="button"
        role="menuitem"
        onClick={onCerrarSesion}
        className="visitas-popover-item w-100 text-start bg-transparent border-0 px-3 py-3 d-flex align-items-center gap-3"
      >
        <LogOut size={18} className="text-danger flex-shrink-0" />
        <span className="small text-danger">Cerrar sesión</span>
      </button>
    </div>
  );
}
