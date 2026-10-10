import { useState, useRef, useEffect } from 'react';

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
          backgroundColor: isOpen ? '#2D4A27' : '#FFFFFF',
          color: isOpen ? '#FFFFFF' : '#1F291E',
          border: '1px solid #EAE6DF',
          borderRadius: '9999px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {opciones.find(o => o.id === filtroActual)?.label}
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
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
            backgroundColor: '#FFFFFF',
            border: '1px solid #EAE6DF',
            boxShadow: '0px 8px 24px rgba(31, 41, 30, 0.08)',
            borderRadius: '12px', // rounded-xl según diseño
            padding: '8px',
            zIndex: 1050,
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
                  backgroundColor: isActive ? '#2D4A27' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#5F695D',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '14px',
                  fontWeight: isActive ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#FAF8F5';
                    e.currentTarget.style.color = '#1F291E';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#5F695D';
                  }
                }}
              >
                {opcion.label}
              </button>
            );
          })}

          {/* Form Control: Input para Día Específico */}
          {filtroActual === 'DIA_ESPECIFICO' && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid #EAE6DF' }}>
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
                  border: '1px solid #EAE6DF',
                  borderRadius: '8px', // rounded-lg
                  fontSize: '14px',
                  color: '#1F291E',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.border = '1.5px solid #2D4A27'}
                onBlur={(e) => e.target.style.border = '1px solid #EAE6DF'}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}