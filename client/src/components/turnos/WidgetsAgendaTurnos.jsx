import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Map, Maximize2, Minimize2 } from 'lucide-react';
import Button from '../ui/Button';
import ClimaSkeleton from '../skeletons/ClimaSkeleton';
import {
  formatearHorarioTurno,
  horaAMinutos,
  obtenerAhoraTurnos,
  obtenerSiguienteTurnoPendiente,
  tieneCoordenadasTurno,
  tieneHorarioTurno
} from './agendaTurnos';
import './herramientasTurnos.scss';

const PanelClima = lazy(() => import('../clima/PanelClima'));
const MapaAgenda = lazy(() => import('./MapaAgenda'));

export default function WidgetsAgendaTurnos({ turnos, periodo, fechaObjetivo, ahora, onSelectTurno, layout = 'grid' }) {
  const [mapaExpandido, setMapaExpandido] = useState(false);

  const { siguienteTurno, turnoFoco } = useMemo(() => {
    const referencia = ahora || obtenerAhoraTurnos();
    const siguiente = obtenerSiguienteTurnoPendiente(turnos, referencia);
    if (siguiente && tieneCoordenadasTurno(siguiente)) {
      return { siguienteTurno: siguiente, turnoFoco: siguiente };
    }
    const conCoordenadas = obtenerSiguienteTurnoPendiente(turnos.filter(tieneCoordenadasTurno), referencia);
    return { siguienteTurno: siguiente, turnoFoco: conCoordenadas };
  }, [turnos, ahora]);

  const climaProps = useMemo(() => {
    const turnoClima = siguienteTurno || turnoFoco;
    const inmueble = turnoFoco?.inmueble || turnoClima?.inmueble;
    const ubicacion = inmueble?.barrio || inmueble?.direccion || null;
    const horaInicioMin = turnoClima && tieneHorarioTurno(turnoClima)
      ? horaAMinutos(turnoClima.franjaHoraria.horaInicio)
      : null;

    return {
      latitud: inmueble?.latitud ?? null,
      longitud: inmueble?.longitud ?? null,
      ubicacion,
      fechaObjetivo: turnoClima?.fechaAsignada || fechaObjetivo,
      horaObjetivo: horaInicioMin !== null ? Math.floor(horaInicioMin / 60) : null,
    };
  }, [siguienteTurno, turnoFoco, fechaObjetivo]);

  const hintMapa = useMemo(() => {
    if (turnoFoco) {
      const cliente = turnoFoco.cliente?.nombre || 'Cliente';
      const direccion = turnoFoco.inmueble?.direccion;
      return `Próximo turno: ${formatearHorarioTurno(turnoFoco)} · ${cliente}${direccion ? ` (${direccion})` : ''}`;
    }
    if (turnos.length > 0) {
      return 'Todos los turnos visibles ya fueron realizados. Seleccioná un marcador para ver el detalle.';
    }
    return 'Seleccioná un marcador para consultar sus turnos y abrir el detalle.';
  }, [turnoFoco, turnos.length]);

  // Cerrar el mapa ampliado con Escape.
  useEffect(() => {
    if (!mapaExpandido) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMapaExpandido(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mapaExpandido]);

  const toggleMapaExpandido = () => setMapaExpandido((actual) => !actual);

  const seleccionarTurno = (idTurno) => {
    setMapaExpandido(false);
    onSelectTurno(idTurno);
  };

  return (
    <div className={`turnos-widgets ${layout === 'stacked' ? 'is-stacked' : ''}`}>
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

        <div className="turnos-tools-map-slot">
          {mapaExpandido && (
            <div
              className="turnos-map-backdrop"
              aria-hidden="true"
              onClick={() => setMapaExpandido(false)}
            />
          )}
          <div
            className={`turnos-tools-map ${mapaExpandido ? 'is-expanded' : ''}`}
            role={mapaExpandido ? 'dialog' : undefined}
            aria-modal={mapaExpandido || undefined}
            aria-label={mapaExpandido ? 'Mapa de turnos ampliado' : undefined}
          >
            <Button
              variant="light"
              icon
              className="turnos-tools-expand"
              onClick={toggleMapaExpandido}
              aria-label={mapaExpandido ? 'Minimizar mapa' : 'Ampliar mapa'}
              title={mapaExpandido ? 'Minimizar mapa' : 'Ampliar mapa'}
              aria-pressed={mapaExpandido}
            >
              {mapaExpandido ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            </Button>
            <Suspense fallback={<div className="turnos-tools-loading" role="status">Cargando mapa…</div>}>
              <MapaAgenda
                turnos={turnos}
                turnoFoco={turnoFoco}
                periodoKey={periodo}
                ahora={ahora}
                expandido={mapaExpandido}
                onSelectTurno={seleccionarTurno}
              />
            </Suspense>
          </div>
        </div>
        <p className="turnos-tools-hint">{hintMapa}</p>
      </section>

      <section className="turnos-widget turnos-widget-clima" aria-label="Pronóstico del clima">
        <Suspense fallback={<ClimaSkeleton />}>
          <PanelClima {...climaProps} />
        </Suspense>
      </section>
    </div>
  );
}
