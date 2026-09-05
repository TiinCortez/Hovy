import React from 'react';

export default function Button({
  children,
  type = 'button',
  variant = 'primary', // ej: 'primary', 'outline-primary', 'secondary'
  className = '',
  onClick,
  disabled = false,
  ...props
}) {
  // Aplicamos la forma "Pill" (rounded-pill de Bootstrap) exigida en el diseño minimalista orgánico
  const baseClass = `btn btn-${variant} rounded-pill px-4 py-2 fw-semibold d-inline-flex align-items-center justify-content-center gap-2 ${className}`;

  return (
    <button
      type={type}
      className={baseClass}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}