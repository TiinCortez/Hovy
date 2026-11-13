import { useEffect } from 'react';

const ENFOCABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

const visibles = (raiz) => [...raiz.querySelectorAll(ENFOCABLES)]
  .filter((el) => el.offsetParent !== null || el === document.activeElement);

// Mientras el modal está abierto: lleva el foco adentro (primer campo, si no el
// primer control), lo mantiene adentro con Tab y Shift+Tab, bloquea el scroll de
// la página y, al cerrar, devuelve el foco al elemento que abrió el modal.
export default function useFocoModal(activo, refModal) {
  useEffect(() => {
    if (!activo) return undefined;
    const raiz = refModal.current;
    if (!raiz) return undefined;

    const anterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (!raiz.contains(document.activeElement)) {
      const controles = visibles(raiz);
      const campo = controles.find((el) => el.matches('input, select, textarea'));
      (campo || controles.find((el) => !el.classList.contains('hovy-close-button')) || controles[0])?.focus();
    }

    const alPresionar = (evento) => {
      if (evento.key !== 'Tab') return;
      const controles = visibles(raiz);
      if (controles.length === 0) return;
      const primero = controles[0];
      const ultimo = controles[controles.length - 1];
      if (evento.shiftKey && (document.activeElement === primero || !raiz.contains(document.activeElement))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (document.activeElement === ultimo || !raiz.contains(document.activeElement))) {
        evento.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alPresionar);

    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflowAnterior;
      if (anterior && typeof anterior.focus === 'function' && document.contains(anterior)) anterior.focus();
    };
  }, [activo, refModal]);
}
