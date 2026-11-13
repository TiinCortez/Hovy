import { useId, useRef } from 'react';
import CloseButton from './CloseButton';
import useCerrarConEscape from './useCerrarConEscape';
import useFocoModal from './useFocoModal';

const TAMANIOS = { sm: 'modal-sm', lg: 'modal-lg', xl: 'modal-xl' };

// Ventana de diálogo de Hovy: velo, caja centrada y cabecera con título y botón de cerrar.
// El cuerpo (.modal-body) y el pie (.modal-footer) los arma cada modal como children.
// Se ocupa de la accesibilidad: role="dialog" con su título, foco inicial y atrapado,
// devolución del foco, bloqueo del scroll y cierre con Escape (solo el modal de arriba).
//
// - bloqueado: deshabilita cerrar (botón, Escape y fondo), por ejemplo mientras guarda.
// - antetitulo / subtitulo: nodos arriba y abajo del título.
// - accionTitulo: un control en la misma línea que el título.
// - debajoCabecera: contenido fijo entre la cabecera y el cuerpo (por ejemplo, pasos).
export default function Modal({
  titulo,
  antetitulo,
  subtitulo,
  accionTitulo,
  debajoCabecera,
  onCerrar,
  etiquetaCerrar = 'Cerrar',
  bloqueado = false,
  tamano,
  desplazable = false,
  cerrarAlTocarFondo = false,
  zIndex = 1060,
  claseRaiz = '',
  claseDialogo = '',
  claseContenido = '',
  claseCabecera = 'border-bottom-0 pb-0 pt-4 px-4',
  claseTitulo = 'fs-4',
  children,
}) {
  const refModal = useRef(null);
  const idTitulo = useId();
  useFocoModal(true, refModal);
  useCerrarConEscape(true, onCerrar, bloqueado);

  const alPresionarFondo = cerrarAlTocarFondo
    ? (evento) => { if (evento.target === evento.currentTarget && !bloqueado) onCerrar?.(); }
    : undefined;

  const claseDeDialogo = ['modal-dialog modal-dialog-centered', TAMANIOS[tamano], desplazable && 'modal-dialog-scrollable', claseDialogo]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={refModal}
      className={`modal d-block bg-dark bg-opacity-50 ${claseRaiz}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      style={{ zIndex }}
      onMouseDown={alPresionarFondo}
    >
      <div className={claseDeDialogo}>
        <div className={`modal-content border-0 rounded-4 shadow-lg ${claseContenido}`.trim()}>
          <div className={`modal-header align-items-start gap-3 ${claseCabecera}`}>
            <div className="min-w-0 flex-grow-1">
              {antetitulo}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <h2 id={idTitulo} className={`modal-title fw-bold text-dark m-0 ${claseTitulo}`}>{titulo}</h2>
                {accionTitulo}
              </div>
              {subtitulo}
            </div>
            <CloseButton label={etiquetaCerrar} onClick={onCerrar} disabled={bloqueado} />
          </div>
          {debajoCabecera}
          {children}
        </div>
      </div>
    </div>
  );
}
