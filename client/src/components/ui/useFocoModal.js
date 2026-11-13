import { useEffect } from 'react';

const ENFOCABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

const visibles = (raiz) => [...raiz.querySelectorAll(ENFOCABLES)]
  .filter((el) => el.offsetParent !== null || el === document.activeElement);

// Modales abiertos, en orden de apertura: solo el de arriba atrapa el foco.
const pila = [];

// Mientras el modal está abierto: lleva el foco adentro (primer campo, si no el
// primer control), lo mantiene adentro con Tab y Shift+Tab, bloquea el scroll de
// la página y, al cerrar, devuelve el foco al elemento que abrió el modal.
export default function useFocoModal(activo, refModal) {
  useEffect(() => {
    if (!activo) return undefined;
    const raiz = refModal.current;
    if (!raiz) return undefined;
    pila.push(raiz);

    const anterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const esCampo = (el) => el?.matches?.('input, select, textarea');
    const enfocarInicial = () => {
      const controles = visibles(raiz);
      const campo = controles.find(esCampo);
      (campo || controles.find((el) => !el.classList.contains('hovy-close-button')) || controles[0])?.focus();
    };
    if (!raiz.contains(document.activeElement)) enfocarInicial();

    // Algunos modales cargan datos al abrir y tienen los campos deshabilitados al
    // principio: durante 1,5 s se reintenta llevar el foco al primer campo, salvo
    // que la persona ya lo haya movido a otro lado.
    let intentos = 0;
    let autoFocoActual = document.activeElement;
    const reintento = window.setInterval(() => {
      intentos += 1;
      const actual = document.activeElement;
      const movido = actual !== autoFocoActual && raiz.contains(actual);
      if (movido || esCampo(actual) || intentos > 15) {
        window.clearInterval(reintento);
        return;
      }
      if (visibles(raiz).some(esCampo)) {
        enfocarInicial();
        autoFocoActual = document.activeElement;
      }
    }, 100);

    const alPresionar = (evento) => {
      if (evento.key !== 'Tab' || pila[pila.length - 1] !== raiz) return;
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
      window.clearInterval(reintento);
      document.removeEventListener('keydown', alPresionar);
      pila.splice(pila.indexOf(raiz), 1);
      document.body.style.overflow = overflowAnterior;
      if (anterior && typeof anterior.focus === 'function' && document.contains(anterior)) anterior.focus();
    };
  }, [activo, refModal]);
}
