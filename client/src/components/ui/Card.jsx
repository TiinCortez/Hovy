import { useContext } from 'react';
import { CardEmbebidaContext } from './cardEmbebidaContext';
import { VERDE } from '../../styles/colores';

export default function Card({ children, className = '', title, ...props }) {
  const embebida = useContext(CardEmbebidaContext);

  if (embebida) {
    return (
      <CardEmbebidaContext.Provider value={false}>
        <div className={className} {...props}>{children}</div>
      </CardEmbebidaContext.Provider>
    );
  }

  return (
    // Tarjeta con borde suave (Level 1 de elevación según el diseño)
    <div
      className={`card border-0 shadow-sm rounded-4 ${className}`}
      style={{ backgroundColor: 'var(--hovy-blanco)', border: '1px solid var(--hovy-crema-500)' }}
      {...props}
    >
      {title && (
        <div className="card-header bg-transparent border-bottom-0 pt-4 pb-0 px-4">
          <h5 className="card-title fw-bold m-0" style={{ color: VERDE }}>{title}</h5>
        </div>
      )}
      <div className="card-body p-4">
        <CardEmbebidaContext.Provider value={false}>
          {children}
        </CardEmbebidaContext.Provider>
      </div>
    </div>
  );
}
