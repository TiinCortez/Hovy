import { useEffect } from 'react';

// Mientras un formulario tiene cambios sin guardar, el navegador pide confirmación
// antes de recargar o cerrar la pestaña.
export default function useAvisoCambiosSinGuardar(hayCambios) {
  useEffect(() => {
    if (!hayCambios) return undefined;
    const alSalir = (evento) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [hayCambios]);
}
