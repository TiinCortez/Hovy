// Props para un bloque que se toca como botón pero no puede ser <button>
// (tarjetas con títulos o bloques adentro). Le da rol, foco con Tab y
// activación con Enter y Espacio, como un botón nativo.
//   <div className="card" {...accionable(() => abrir(turno))}>…</div>
// Para un control que se prende y apaga, pasá { presionado }.
export function accionable(onActivar, { presionado } = {}) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-pressed': presionado,
    onClick: onActivar,
    onKeyDown: (evento) => {
      if (evento.target !== evento.currentTarget) return;
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        onActivar(evento);
      }
    },
  };
}
