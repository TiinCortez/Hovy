import { useEffect, useState } from 'react';
import { obtenerAhoraTurnos } from './agendaTurnos';

export default function useRelojTurnos() {
  const [ahora, setAhora] = useState(obtenerAhoraTurnos);

  useEffect(() => {
    const actualizar = () => setAhora(obtenerAhoraTurnos());
    const intervalo = window.setInterval(actualizar, 15000);
    // También actualiza al volver a la app en mobile.
    window.addEventListener('focus', actualizar);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', actualizar);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, []);

  return ahora;
}
