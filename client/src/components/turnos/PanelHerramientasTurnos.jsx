import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Map, Maximize2, Minimize2 } from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import './herramientasTurnos.scss';

const PanelClima = lazy(() => import('../clima/PanelClima'));
const MapaAgenda = lazy(() => import('./MapaAgenda'));

export default function PanelHerramientasTurnos({ herramientas, onChange, onClose, turnos, periodo, onSelectTurno }) {
  const dialogoRef = useRef(null);
  const mapaRef = useRef(null);
  const inicioFueraRef = useRef(false);
  const [mapaFullscreen, setMapaFullscreen] = useState(false);
  const [mapaAmpliado, setMapaAmpliado] = useState(false);
  const [errorMapa, setErrorMapa] = useState(null);
  const abierto = herramientas.activa !== null;
  const mapaExpandido = mapaFullscreen || mapaAmpliado;

  // El diálogo nativo gestiona el foco, el teclado y la interacción con el fondo.
  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!abierto) {
      if (dialogo.open) dialogo.close();
      return;
    }

    const overflowPagina = document.documentElement.style.overflow;
    const overflowBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (!dialogo.open) dialogo.showModal();

    return () => {
      if (dialogo.open) dialogo.close();
      document.documentElement.style.overflow = overflowPagina;
      document.body.style.overflow = overflowBody;
    };
  }, [abierto]);

  useEffect(() => {
    const actualizarFullscreen = () => {
      setMapaFullscreen(Boolean(mapaRef.current && document.fullscreenElement === mapaRef.current));
    };
    document.addEventListener('fullscreenchange', actualizarFullscreen);
    return () => document.removeEventListener('fullscreenchange', actualizarFullscreen);
  }, []);

  const salirDePantallaCompleta = async () => {
    if (mapaRef.current && document.fullscreenElement === mapaRef.current) {
      await document.exitFullscreen();
    }
    setMapaAmpliado(false);
  };

  const cerrarPanel = async () => {
    try {
      await salirDePantallaCompleta();
      dialogoRef.current.close();
      onClose();
      return true;
    } catch {
      setErrorMapa('No se pudo salir de pantalla completa. Usá el botón de restaurar o la tecla Esc.');
      return false;
    }
  };

  const toggleFullscreen = async () => {
    setErrorMapa(null);
    try {
      if (mapaAmpliado || document.fullscreenElement === mapaRef.current) {
        await salirDePantallaCompleta();
      } else if (!document.fullscreenEnabled || !mapaRef.current.requestFullscreen) {
        setMapaAmpliado(true);
      } else {
        await mapaRef.current.requestFullscreen();
      }
    } catch {
      setMapaAmpliado(true);
    }
  };

  const seleccionarTurno = async (idTurno) => {
    if (await cerrarPanel()) onSelectTurno(idTurno);
  };

  return createPortal(
    <dialog
      id="turnos-tools-panel"
      ref={dialogoRef}
      className="turnos-tools-dialog"
      aria-labelledby="turnos-tools-title"
      onCancel={(event) => {
        event.preventDefault();
        if (mapaAmpliado) setMapaAmpliado(false);
        else if (!document.fullscreenElement) cerrarPanel();
      }}
      onPointerDown={(event) => { inicioFueraRef.current = event.target === event.currentTarget; }}
      onClick={(event) => {
        if (inicioFueraRef.current && event.target === event.currentTarget) cerrarPanel();
      }}
    >
      <div className="turnos-tools-panel">
        <header className="turnos-tools-header" inert={mapaAmpliado}>
          <div className="min-w-0">
            <span className="turnos-tools-eyebrow">Herramientas de agenda</span>
            <h2 id="turnos-tools-title">{herramientas.activa === 'mapa' ? 'Mapa de turnos' : 'Clima y pronóstico'}</h2>
            <p>{herramientas.activa === 'mapa' ? `${turnos.length} ${turnos.length === 1 ? 'turno visible' : 'turnos visibles'} · ${periodo}` : 'Consultá el pronóstico antes de planificar tus servicios.'}</p>
          </div>
          <CloseButton label="Cerrar herramientas de agenda" onClick={cerrarPanel} />
        </header>

        <div className="turnos-tools-switcher" role="group" aria-label="Elegir herramienta" inert={mapaAmpliado}>
          <Button variant="light" size="sm" className={`turnos-tool-trigger ${herramientas.activa === 'clima' ? 'is-active' : ''}`} aria-pressed={herramientas.activa === 'clima'} aria-controls="turnos-tools-clima" onClick={() => onChange('clima')}>
            <Sun size={16} aria-hidden="true" /> Clima
          </Button>
          <Button variant="light" size="sm" className={`turnos-tool-trigger ${herramientas.activa === 'mapa' ? 'is-active' : ''}`} aria-pressed={herramientas.activa === 'mapa'} aria-controls="turnos-tools-mapa" onClick={() => onChange('mapa')}>
            <Map size={16} aria-hidden="true" /> Mapa
          </Button>
        </div>

        <div className={`turnos-tools-body ${herramientas.activa === 'mapa' ? 'is-map' : ''}`}>
          <section id="turnos-tools-clima" hidden={herramientas.activa !== 'clima'} aria-label="Pronóstico del clima">
            {herramientas.clima && (
              <Suspense fallback={<div className="turnos-tools-loading" role="status">Cargando pronóstico...</div>}>
                <PanelClima />
              </Suspense>
            )}
          </section>

          <section id="turnos-tools-mapa" className="turnos-tools-map-section" hidden={herramientas.activa !== 'mapa'} aria-label="Ubicación de los turnos">
            {herramientas.mapa && (
              <>
                <div ref={mapaRef} className={`turnos-tools-map ${mapaExpandido ? 'mapa-fullscreen' : ''} ${mapaAmpliado ? 'is-expanded' : ''}`}>
                  <Button variant="light" icon className="turnos-tools-expand" onClick={toggleFullscreen} aria-label={mapaExpandido ? 'Salir de pantalla completa' : 'Mapa en pantalla completa'} title={mapaExpandido ? 'Salir de pantalla completa' : 'Mapa en pantalla completa'} aria-pressed={mapaExpandido}>
                    {mapaExpandido ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
                  </Button>
                  <Suspense fallback={<div className="turnos-tools-loading" role="status">Cargando mapa...</div>}>
                    <MapaAgenda turnos={turnos} onSelectTurno={seleccionarTurno} />
                  </Suspense>
                </div>
                {errorMapa && <p className="small text-danger mt-2 mb-0" role="alert">{errorMapa}</p>}
                <p className="turnos-tools-hint">Seleccioná un marcador para consultar sus turnos y abrir el detalle.</p>
              </>
            )}
          </section>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
