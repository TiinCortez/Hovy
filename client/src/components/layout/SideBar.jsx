import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, BarChart3, Wrench, ClipboardList, Wallet, Menu } from 'lucide-react';

export default function Sidebar() {
  const [menuMasAbierto, setMenuMasAbierto] = useState(false);

  // Pestañas fijas de la barra inferior en móvil
  const mainItems = [
    { path: '/dashboard', label: 'Panel', icon: <LayoutDashboard size={22} /> },
    { path: '/clients', label: 'Clientes', icon: <Users size={22} /> },
    { path: '/calendar', label: 'Agenda', icon: <CalendarDays size={22} /> },
  ];

  // Pestañas que en móvil se agrupan dentro del menú "Más"
  const moreItems = [
    { path: '/visitas', label: 'Solicitudes', icon: <ClipboardList size={22} />, menuIcon: <ClipboardList size={16} />, color: 'solicitudes' },
    { path: '/servicios', label: 'Servicios', icon: <Wrench size={22} />, menuIcon: <Wrench size={16} />, color: 'servicios' },
    { path: '/cobros', label: 'Cobros', icon: <Wallet size={22} />, menuIcon: <Wallet size={16} />, color: 'cobros' },
    { path: '/analytics', label: 'Métricas', icon: <BarChart3 size={22} />, menuIcon: <BarChart3 size={16} />, color: 'metricas' },
  ];

  const navItems = [...mainItems, ...moreItems];

  // Cierra el menú con la tecla Escape
  useEffect(() => {
    if (!menuMasAbierto) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuMasAbierto(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuMasAbierto]);

  return (
    <>
      {/* Sidebar visible solo en pantallas medianas/grandes (Bootstrap Grid) */}
      <aside className="hovy-sidebar p-4 d-flex flex-column col-md-3 col-lg-2">
        <div className="d-flex flex-column gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className="nav-link px-3 py-2"
            >
              {item.icon}
              <span className="ms-2">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </aside>

      {/* Fondo oscurecido y desenfocado mientras el menú "Más" está abierto (solo móvil) */}
      {menuMasAbierto && (
        <div
          className="hovy-more-backdrop"
          onClick={() => setMenuMasAbierto(false)}
          aria-hidden="true"
        />
      )}

      {/* Menú inferior visible solo en móviles (Controlado por SCSS propio) */}
      <nav className="hovy-bottom-nav px-2 py-2">
        {mainItems.map((item) => (
          <NavLink
            key={`mobile-${item.path}`}
            to={item.path}
            className="nav-link d-flex flex-column align-items-center justify-content-center p-2 gap-1 text-decoration-none"
            onClick={() => setMenuMasAbierto(false)}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={`nav-link d-flex flex-column align-items-center justify-content-center p-2 gap-1 border-0 bg-transparent ${menuMasAbierto ? 'active' : ''}`}
          onClick={() => setMenuMasAbierto((abierto) => !abierto)}
          aria-haspopup="menu"
          aria-expanded={menuMasAbierto}
          aria-controls="hovy-more-menu"
        >
          <Menu size={22} />
          <span>Más</span>
        </button>

        {menuMasAbierto && (
          <div id="hovy-more-menu" className="hovy-more-menu" role="menu" aria-label="Menú de secciones">
            {moreItems.map((item) => (
              <NavLink
                key={`more-${item.path}`}
                to={item.path}
                role="menuitem"
                className={`hovy-more-menu-item hovy-more-menu-item--${item.color}`}
                onClick={() => setMenuMasAbierto(false)}
              >
                {item.menuIcon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </>
  );
}
