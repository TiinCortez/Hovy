import { useEffect, useRef } from 'react';

// Modales abiertos, en orden de apertura. Escape cierra solo el de arriba:
// con un modal abierto encima de otro (Registrar pago sobre Detalle del turno)
// no se cierran los dos.
const pila = [];

// Cierra un modal con la tecla Escape mientras `activo` sea verdadero.
// `bloqueado` lo ignora sin sacarlo de la pila (por ejemplo, mientras guarda).
export default function useCerrarConEscape(activo, onClose, bloqueado = false) {
  const ultimo = useRef({ onClose, bloqueado });
  useEffect(() => {
    ultimo.current = { onClose, bloqueado };
  });

  useEffect(() => {
    if (!activo) return undefined;
    const marca = {};
    pila.push(marca);
    const alPresionar = (evento) => {
      if (evento.key !== 'Escape' || pila[pila.length - 1] !== marca) return;
      if (ultimo.current.bloqueado || !ultimo.current.onClose) return;
      ultimo.current.onClose();
    };
    document.addEventListener('keydown', alPresionar);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      pila.splice(pila.indexOf(marca), 1);
    };
  }, [activo]);
}
