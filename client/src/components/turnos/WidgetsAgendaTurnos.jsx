import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Map, Maximize2, Minimize2 } from 'lucide-react';
import Button from '../ui/Button';
import ClimaSkeleton from '../skeletons/ClimaSkeleton';
import './herramientasTurnos.scss';

const PanelClima = lazy(() => import('../clima/PanelClima'));
const MapaAgenda = lazy(() => import('./MapaAgenda'));

export default function WidgetsAgendaTurnos({ turnos, periodo, onSelectTurno }) {
  const mapaRef = useRef(null);
  const [mapaFullscreen, setMapaFullscreen] = useState(false);
  const [mapaAmpliado, setMapaAmpliado] = useState(false);
  const [errorMapa, setErrorMapa] = useState(null);
  const mapaExpandido = mapaFullscreen || mapaAmpliado;

  useEffect(() => {
    const actualizarFullscreen = () => {
      setMapaFullscreen(Boolean(mapaRef.current && document.fullscreenElement === mapaRef.current));
    };
    document.addEventListener('fullscreenchange', actualizarFullscreen);
    return () => document.removeEventListener('fullscreenchange', actualizarFullscreen);
  }, []);

  // Fallback expanded mode (no Fullscreen API): close it with Escape.
  useEffect(() => {
    if (!mapaAmpliado) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMapaAmpliado(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mapaAmpliado]);

  const salirDePantallaCompleta = async () => {
    if (mapaRef.current && document.fullscreenElement === mapaRef.current) {
      await document.exitFullscreen();
    }
    setMapaAmpliado(false);
  };

  const toggleFullscreen = async () => {
    setErrorMapa(null);
    try {
      if (mapaExpandido) {
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
    try {
      await salirDePantallaCompleta();
    } catch {
      setErrorMapa('No se pudo salir de pantalla completa. Usá el botón de restaurar o la tecla Esc.');
      return;
    }
    onSelectTurno(idTurno);
  };

  return (
    <div className="turnos-widgets">
      <section className="turnos-widget turnos-widget-map" aria-labelledby="turnos-widget-map-title">
        <header className="turnos-widget-header">
          <div className="d-flex align-items-center gap-2 min-w-0">
            <span className="turnos-widget-icon" aria-hidden="true"><Map size={16} /></span>
            <div className="min-w-0">
              <h3 id="turnos-widget-map-title">Mapa de turnos</h3>
              <p className="text-truncate">
                {turnos.length} {turnos.length === 1 ? 'turno visible' : 'turnos visibles'} · {periodo}
              </p>
            </div>
          </div>
        </header>

        <div ref={mapaRef} className={`turnos-tools-map ${mapaExpandido ? 'mapa-fullscreen' : ''} ${mapaAmpliado ? 'is-expanded' : ''}`}>
          <Button
            variant="light"
            icon
            className="turnos-tools-expand"
            onClick={toggleFullscreen}
            aria-label={mapaExpandido ? 'Salir de pantalla completa' : 'Mapa en pantalla completa'}
            title={mapaExpandido ? 'Salir de pantalla completa' : 'Mapa en pantalla completa'}
            aria-pressed={mapaExpandido}
          >
            {mapaExpandido ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
          </Button>
          <Suspense fallback={<div className="turnos-tools-loading" role="status">Cargando mapa...</div>}>
            <MapaAgenda turnos={turnos} onSelectTurno={seleccionarTurno} />
          </Suspense>
        </div>
        {errorMapa && <p className="small text-danger m-0" role="alert">{errorMapa}</p>}
        <p className="turnos-tools-hint">Seleccioná un marcador para consultar sus turnos y abrir el detalle.</p>
      </section>

      <section className="turnos-widget turnos-widget-clima" aria-label="Pronóstico del clima">
        <Suspense fallback={<ClimaSkeleton />}>
          <PanelClima />
        </Suspense>
      </section>
    </div>
  );
}
