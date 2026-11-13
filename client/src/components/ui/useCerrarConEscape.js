import { useEffect } from 'react';

// Cierra un modal con la tecla Escape mientras `activo` sea verdadero.
export default function useCerrarConEscape(activo, onClose) {
  useEffect(() => {
    if (!activo || !onClose) return undefined;
    const alPresionar = (evento) => {
      if (evento.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [activo, onClose]);
}
