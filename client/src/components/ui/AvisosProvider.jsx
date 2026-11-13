import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import CloseButton from './CloseButton';
import { AvisosContext } from './avisosContext';

const ICONOS = { error: AlertCircle, ok: CheckCircle2, aviso: Info };
const DURACION_AUTOMATICA = 5000; // ms para ok y aviso; los errores esperan a que se cierren
const MAXIMO_VISIBLES = 3;

let siguienteId = 0;

// Muestra avisos sobre la pantalla, por encima de los modales (capa aviso).
// Los errores usan role="alert" para que el lector de pantalla los lea al aparecer.
export default function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const temporizadores = useRef(new Map());

  const cerrar = useCallback((id) => {
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id));
  }, []);

  const avisar = useCallback((mensaje, { tipo = 'error', duracion } = {}) => {
    const id = ++siguienteId;
    setAvisos((actuales) => [
      ...actuales.filter((aviso) => aviso.mensaje !== mensaje),
      { id, mensaje, tipo },
    ].slice(-MAXIMO_VISIBLES));

    const espera = duracion ?? (tipo === 'error' ? null : DURACION_AUTOMATICA);
    if (espera) temporizadores.current.set(id, setTimeout(() => cerrar(id), espera));
    return id;
  }, [cerrar]);

  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);

  const valor = useMemo(() => ({ avisar, cerrar }), [avisar, cerrar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      {createPortal(
        <div className="hovy-avisos-flotantes" role="region" aria-label="Avisos" aria-live="polite">
          {avisos.map(({ id, mensaje, tipo }) => {
            const Icono = ICONOS[tipo] ?? Info;
            return (
              <div key={id} className={`hovy-aviso is-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
                <Icono size={18} className="flex-shrink-0" aria-hidden="true" />
                <span className="flex-grow-1">{mensaje}</span>
                <CloseButton label="Cerrar aviso" onClick={() => cerrar(id)} className="hovy-aviso-cerrar" />
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </AvisosContext.Provider>
  );
}
