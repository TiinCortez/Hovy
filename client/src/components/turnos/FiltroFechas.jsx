import { useState, useRef, useEffect } from 'react';
import { VERDE } from '../../styles/colores';
import { CAPAS } from '../../styles/capas';

export default function FiltroFechas({ filtroActual, setFiltro, fechaEspecifica, setFechaEspecifica }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Cierra el menú al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const opciones = [
    { id: 'HOY', label: 'Hoy' },
    { id: 'SEMANA', label: 'Esta Semana' },
    { id: 'MES', label: 'Este Mes' },
    { id: 'DIA_ESPECIFICO', label: 'Día Específico' },
    { id: 'TODOS', label: 'Todos los turnos' }
  ];

  return (
    <div className="position-relative" ref={dropdownRef} style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      
      {/* Botón Disparador (Estilo Tag / Chip) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="d-flex align-items-center gap-2"
        style={{
          backgroundColor: isOpen ? VERDE : 'var(--hovy-blanco)',
          color: isOpen ? 'var(--hovy-blanco)' : 'var(--hovy-oliva-950)',
          border: '1px solid var(--hovy-crema-300)',
          borderRadius: 'var(--hovy-radio-pill)',
          padding: '8px 16px',
          fontSize: 'var(--hovy-texto-md)',
          fontWeight: '600',
          transition: 'background-color var(--hovy-duracion-media) ease, border-color var(--hovy-duracion-media) ease, color var(--hovy-duracion-media) ease, box-shadow var(--hovy-duracion-media) ease, transform var(--hovy-duracion-media) ease, opacity var(--hovy-duracion-media) ease',
          cursor: 'pointer'
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {opciones.find(o => o.id === filtroActual)?.label}
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--hovy-duracion-media)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Menú Flotante (Floating Overlay) */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0, // o right: 0 dependiendo de dónde lo coloques
            marginTop: '8px',
            backgroundColor: 'var(--hovy-blanco)',
            border: '1px solid var(--hovy-crema-300)',
            boxShadow: 'var(--hovy-sombra-lg)',
            borderRadius: 'var(--hovy-radio-md)', // rounded-xl según diseño
            padding: '8px',
            zIndex: CAPAS.menu,
            minWidth: '220px'
          }}
        >
          {opciones.map(opcion => {
            const isActive = filtroActual === opcion.id;
            return (
              <button
                key={opcion.id}
                onClick={() => {
                  setFiltro(opcion.id);
                  if (opcion.id !== 'DIA_ESPECIFICO') setIsOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 16px',
                  marginBottom: '4px',
                  backgroundColor: isActive ? VERDE : 'transparent',
                  color: isActive ? 'var(--hovy-blanco)' : 'var(--hovy-oliva-700)',
                  border: 'none',
                  borderRadius: 'var(--hovy-radio-pill)',
                  fontSize: 'var(--hovy-texto-md)',
                  fontWeight: isActive ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'background-color var(--hovy-duracion-media), color var(--hovy-duracion-media)'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--hovy-crema-50)';
                    e.currentTarget.style.color = 'var(--hovy-oliva-950)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--hovy-oliva-700)';
                  }
                }}
              >
                {opcion.label}
              </button>
            );
          })}

          {/* Form Control: Input para Día Específico */}
          {filtroActual === 'DIA_ESPECIFICO' && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--hovy-crema-300)' }}>
              <input
                type="date"
                value={fechaEspecifica}
                onChange={(e) => {
                  setFechaEspecifica(e.target.value);
                  setIsOpen(false); // Cierra tras elegir
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--hovy-crema-300)',
                  borderRadius: 'var(--hovy-radio-sm)', // rounded-lg
                  fontSize: 'var(--hovy-texto-md)',
                  color: 'var(--hovy-oliva-950)',
                  backgroundColor: 'var(--hovy-blanco)',
                  outline: 'none',
                  transition: 'border-color var(--hovy-duracion-media)'
                }}
                onFocus={(e) => e.target.style.border = `1.5px solid ${VERDE}`}
                onBlur={(e) => e.target.style.border = '1px solid var(--hovy-crema-300)'}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}