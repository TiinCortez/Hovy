
import { Bell, UserCircle } from 'lucide-react';

export default function Header() {
  return (
    // Utilizamos clases utilitarias de Flexbox y Spacing de Bootstrap
    <header className="hovy-header d-flex align-items-center justify-content-between px-4 flex-shrink-0 sticky-top">
      <div className="brand">
        <h1 className="hovy-brand fs-4 m-0">Hovy</h1>
      </div>
      <div className="d-flex align-items-center gap-3">
        <button className="icon-button p-2 d-flex align-items-center justify-content-center" aria-label="Notificaciones">
          <Bell size={24} />
        </button>
        <button className="icon-button p-2 d-flex align-items-center justify-content-center" aria-label="Perfil de usuario">
          <UserCircle size={28} color="#1B3006" />
        </button>
      </div>
    </header>
  );
}