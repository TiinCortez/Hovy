import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, BarChart3 } from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    { path: '/dashboard', label: 'Panel', icon: <LayoutDashboard size={22} /> },
    { path: '/clients', label: 'Clientes', icon: <Users size={22} /> },
    { path: '/calendar', label: 'Agenda', icon: <CalendarDays size={22} /> },
    { path: '/analytics', label: 'Métricas', icon: <BarChart3 size={22} /> },
  ];

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

      {/* Menú inferior visible solo en móviles (Controlado por SCSS propio) */}
      <nav className="hovy-bottom-nav px-2 py-2">
        {navItems.map((item) => (
          <NavLink
            key={`mobile-${item.path}`}
            to={item.path}
            className="nav-link d-flex flex-column align-items-center justify-content-center p-2 gap-1 text-decoration-none"
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}