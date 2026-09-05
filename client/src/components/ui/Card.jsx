

export default function Card({ children, className = '', title, ...props }) {
  return (
    // Tarjeta con borde suave (Level 1 de elevación según el diseño)
    <div 
      className={`card border-0 shadow-sm rounded-4 ${className}`} 
      style={{ backgroundColor: '#ffffff', border: '1px solid #D1D1C4' }} 
      {...props}
    >
      {title && (
        <div className="card-header bg-transparent border-bottom-0 pt-4 pb-0 px-4">
          <h5 className="card-title fw-bold m-0" style={{ color: '#1B3006' }}>{title}</h5>
        </div>
      )}
      <div className="card-body p-4">
        {children}
      </div>
    </div>
  );
}