import { useEffect, useId, useMemo, useState } from 'react';
import { Calendar, ChevronRight, MapPin, RotateCcw } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ClienteService from '../../services/api/cliente.service';
import { CAPAS } from '../../styles/capas';
import HistorialTurnoDetalleModal from './HistorialTurnoDetalleModal';
import {
  ESTADO_META,
  ESTADOS_HISTORIAL,
  formatearFechaCorta,
  formatearFranja,
  obtenerResumenCobro,
} from './historialTurnosUtils';
import './historialTurnos.scss';

export default function HistorialTurnosClienteModal({
  isOpen = true,
  onClose,
  idCliente,
  nombreCliente,
  inmuebles = [],
}) {
  const selectInmuebleId = useId();
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS');
  const [inmuebleFiltro, setInmuebleFiltro] = useState('TODOS');
  const [turnoDetalle, setTurnoDetalle] = useState(null);

  useEffect(() => {
    if (!isOpen || !idCliente) return undefined;
    let activo = true;

    ClienteService.getHistorialTurnos(idCliente)
      .then((respuesta) => {
        if (!activo) return;
        const lista = Array.isArray(respuesta?.data) ? respuesta.data : [];
        setTurnos(lista);
        setError(null);
        setCargando(false);
      })
      .catch((err) => {
        if (!activo) return;
        console.error('Error al cargar el historial de turnos del cliente:', err);
        setError('No se pudo cargar el historial de turnos. Intentá de nuevo.');
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [isOpen, idCliente, intento]);

  const opcionesInmueble = useMemo(() => {
    const mapa = new Map();
    for (const inm of inmuebles) {
      if (!inm?.id_inmueble) continue;
      mapa.set(String(inm.id_inmueble), {
        id: String(inm.id_inmueble),
        etiqueta: [inm.direccion || 'Sin dirección', inm.barrio].filter(Boolean).join(' · '),
      });
    }
    for (const t of turnos) {
      const inm = t.inmueble;
      if (!inm?.id_inmueble) continue;
      const clave = String(inm.id_inmueble);
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          id: clave,
          etiqueta: [inm.direccion || 'Sin dirección', inm.barrio].filter(Boolean).join(' · '),
        });
      }
    }
    return [...mapa.values()];
  }, [inmuebles, turnos]);

  const turnosPorInmueble = useMemo(() => {
    if (inmuebleFiltro === 'TODOS') return turnos;
    return turnos.filter((t) => String(t.inmueble?.id_inmueble) === inmuebleFiltro);
  }, [turnos, inmuebleFiltro]);

  const conteosPorEstado = useMemo(() => {
    const conteos = { TODOS: turnosPorInmueble.length };
    for (const t of turnosPorInmueble) {
      conteos[t.estado] = (conteos[t.estado] || 0) + 1;
    }
    return conteos;
  }, [turnosPorInmueble]);

  const turnosFiltrados = useMemo(() => {
    if (estadoFiltro === 'TODOS') return turnosPorInmueble;
    return turnosPorInmueble.filter((t) => t.estado === estadoFiltro);
  }, [turnosPorInmueble, estadoFiltro]);

  if (!isOpen) return null;

  const reintentar = () => {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  };

  return (
    <>
      <Modal
        antetitulo={<span className="hovy-rotulo">Cliente · Turnos</span>}
        titulo="Historial de turnos"
        subtitulo={nombreCliente ? <p className="text-secondary small m-0 mt-1">{nombreCliente}</p> : null}
        onCerrar={onClose}
        etiquetaCerrar="Cerrar historial de turnos"
        tamano="lg"
        desplazable
        cerrarAlTocarFondo={!turnoDetalle}
        zIndex={CAPAS.modal}
        claseContenido="overflow-hidden bg-white"
        claseCabecera="border-bottom pb-3 pt-4 px-3 px-md-4"
      >
        <div className="modal-body p-3 p-md-4">
          {cargando ? (
            <div className="py-5 text-center text-secondary" role="status">
              <div className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
              Cargando historial de turnos…
            </div>
          ) : error ? (
            <div className="historial-turnos-vacio" role="alert">
              <p className="text-danger fw-semibold mb-3">{error}</p>
              <Button variant="light" className="btn-sm border bg-white" onClick={reintentar}>
                <RotateCcw size={14} aria-hidden="true" /> Reintentar
              </Button>
            </div>
          ) : turnos.length === 0 ? (
            <div className="historial-turnos-vacio">
              <Calendar size={32} className="text-secondary opacity-50 mb-2" aria-hidden="true" />
              <p className="fw-bold text-dark mb-1">Todavía no tiene turnos registrados</p>
              <p className="text-secondary small m-0">
                Cuando se agende o realice un turno para alguno de sus inmuebles aparecerá acá.
              </p>
            </div>
          ) : (
            <>
              <div className="historial-turnos-barra">
                <div className="historial-turnos-chips" role="group" aria-label="Filtrar por estado">
                  {ESTADOS_HISTORIAL.map((estado) => {
                    const activo = estadoFiltro === estado.key;
                    const cantidad = conteosPorEstado[estado.key] || 0;
                    return (
                      <button
                        key={estado.key}
                        type="button"
                        aria-pressed={activo}
                        className={`historial-turnos-chip ${activo ? 'is-active' : ''}`}
                        onClick={() => setEstadoFiltro(estado.key)}
                      >
                        <span>{estado.label}</span>
                        <span className="historial-turnos-chip-count">{cantidad}</span>
                      </button>
                    );
                  })}
                </div>

                {opcionesInmueble.length > 1 && (
                  <div className="historial-turnos-inmueble-filtro">
                    <label htmlFor={selectInmuebleId}>Inmueble:</label>
                    <select
                      id={selectInmuebleId}
                      className="form-select form-select-sm bg-white"
                      value={inmuebleFiltro}
                      onChange={(e) => setInmuebleFiltro(e.target.value)}
                    >
                      <option value="TODOS">Todos los inmuebles ({opcionesInmueble.length})</option>
                      {opcionesInmueble.map((op) => (
                        <option key={op.id} value={op.id}>{op.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {turnosFiltrados.length === 0 ? (
                <div className="historial-turnos-vacio">
                  <p className="fw-semibold text-dark mb-2">No hay turnos para este filtro</p>
                  <Button
                    variant="light"
                    className="btn-sm border bg-white"
                    onClick={() => {
                      setEstadoFiltro('TODOS');
                      setInmuebleFiltro('TODOS');
                    }}
                  >
                    Ver todos los turnos
                  </Button>
                </div>
              ) : (
                <div className="historial-turnos-lista">
                  {turnosFiltrados.map((turno) => {
                    const estadoInfo = ESTADO_META[turno.estado] ?? { label: turno.estado, mod: 'coordinado' };
                    const resumenCobro = obtenerResumenCobro(turno);

                    return (
                      <button
                        key={turno.id_turno}
                        type="button"
                        className="historial-turnos-item"
                        onClick={() => setTurnoDetalle(turno)}
                      >
                        <div className="historial-turnos-item-top">
                          <span className="historial-turnos-item-fecha">
                            {formatearFechaCorta(turno.fecha_programada)} · {formatearFranja(turno.inicio_desde, turno.hasta)}
                          </span>
                          <div className="historial-turnos-item-badges">
                            <span className={`historial-estado-pill historial-estado-pill--${estadoInfo.mod}`}>
                              {estadoInfo.label}
                            </span>
                            {resumenCobro && (
                              <span className={`historial-cobro-pill historial-cobro-pill--${resumenCobro.tipo}`}>
                                {resumenCobro.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="historial-turnos-item-body">
                          <div className="historial-turnos-item-info">
                            <div className="historial-turnos-item-servicio">
                              {turno.servicio_descripcion || 'Sin servicio asociado'}
                            </div>
                            <div className="historial-turnos-item-dir">
                              <MapPin size={13} aria-hidden="true" className="flex-shrink-0" />
                              <span>{turno.inmueble?.direccion || 'Sin inmueble'}</span>
                            </div>
                          </div>
                          <span className="historial-turnos-item-accion">
                            Ver detalle <ChevronRight size={14} aria-hidden="true" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer border-top pt-3 pb-3 px-3 px-md-4">
          <Button
            variant="light"
            className="rounded-pill px-4 fw-semibold text-secondary border"
            onClick={onClose}
          >
            Cerrar
          </Button>
        </div>
      </Modal>

      <HistorialTurnoDetalleModal
        turno={turnoDetalle}
        nombreCliente={nombreCliente}
        onCerrar={() => setTurnoDetalle(null)}
      />
    </>
  );
}
