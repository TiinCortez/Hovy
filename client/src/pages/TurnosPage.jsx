import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Calendar as CalendarIcon, LayoutDashboard, LayoutList, ChevronLeft, ChevronRight, Plus, Search, Maximize2, Minimize2 } from 'lucide-react';
import Button from '../components/ui/Button';
import TurnosKanban from '../components/turnos/TurnosKanban';
import TurnosSemanal from '../components/turnos/TurnosSemanal';
import TurnosMensual from '../components/turnos/TurnosMensual';
import NuevoTurnoModal from '../components/turnos/NuevoTurnoModal';
import TurnoDetalleModal from '../components/turnos/TurnoDetalleModal';
import ModificarTurnoModal from '../components/turnos/ModificarTurnoModal';
import TurnoService from '../services/api/turno.service';
import useRelojTurnos from '../components/turnos/useRelojTurnos';
import { fechaDesdeIso, obtenerAhoraTurnos } from '../components/turnos/agendaTurnos';
import PanelClima from '../components/clima/PanelClima';
import MapaAgenda from '../components/turnos/MapaAgenda';
import '../components/turnos/turnos.scss';

const PRIORIDADES_CONFIG = {
  P1_REASIGNADO: { label: 'P1 Reasignado', color: 'danger' },
  P2_FIJO: { label: 'P2 Fijo', color: 'success' },
  P3_CASUAL: { label: 'P3 Casual', color: 'secondary' }
};

const PRIORIDADES_INICIALES = Object.keys(PRIORIDADES_CONFIG);

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function TurnosPage() {
  const [vistaActual, setVistaActual] = useState('diaria');
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const ahora = useRelojTurnos();
  const [fechaActual, setFechaActual] = useState(() => fechaDesdeIso(obtenerAhoraTurnos().fecha));
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activePriorities, setActivePriorities] = useState(PRIORIDADES_INICIALES);
  
  const mapaRef = useRef(null);
  const [mapaFullscreen, setMapaFullscreen] = useState(false);

  const [isNuevoTurnoOpen, setIsNuevoTurnoOpen] = useState(false);
  const [isDetalleOpen, setIsDetalleOpen] = useState(false);
  const [isModificarOpen, setIsModificarOpen] = useState(false);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [datosNuevoTurno, setDatosNuevoTurno] = useState({});

  useEffect(() => {
    const onChange = () => setMapaFullscreen(document.fullscreenElement === mapaRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleMapaFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await mapaRef.current?.requestFullscreen();
      }
    } catch (err) {
      console.error('No se pudo cambiar a pantalla completa', err);
    }
  }, []);

  useEffect(() => {
    const fetchTurnos = async () => {
      try {
        const response = await TurnoService.getAll();
        setTurnos(response.data || []);
      } catch (error) {
        console.error("Error al cargar los turnos desde el servidor:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTurnos();
  }, []);

  const abrirNuevoTurno = (datos = {}) => {
    setDatosNuevoTurno(datos);
    setIsNuevoTurnoOpen(true);
  };

  const handleSelectTurno = async (idTurno) => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }

    const turno = turnos.find(t => t.idTurno === idTurno);
    if (turno) {
      setTurnoSeleccionado(turno);
      setIsDetalleOpen(true);
    }
  };

  const handleTurnoCreated = (nuevoTurnoData) => {
    setTurnos((actuales) => [...actuales, nuevoTurnoData]);
  };

  const handleTurnoUpdated = (turnoActualizado) => {
    setTurnos(turnos.map(t => t.idTurno === turnoActualizado.idTurno ? turnoActualizado : t));
    setTurnoSeleccionado(turnoActualizado);
  };

  const handleCancelTurno = async (idTurno) => {
    try {
      await TurnoService.cancelar(idTurno);
      setTurnos(turnos.map(t => t.idTurno === idTurno ? { ...t, estado: 'CANCELADO' } : t));
      setIsDetalleOpen(false);
    } catch (error) {
      console.error("Error al cancelar el turno:", error);
      alert("Ocurrió un error al intentar cancelar el turno. Verifique su conexión.");
    }
  };

  const openModificarModal = (turno) => {
    setIsDetalleOpen(false);
    setTurnoSeleccionado(turno);
    setIsModificarOpen(true);
  };

  const handleChangeTurnoState = async (idTurno, newState, existingData) => {
    try {
      const payload = {
        fecha_programada: existingData.fechaAsignada,
        inicio_desde: existingData.franjaHoraria.horaInicio,
        hasta: existingData.franjaHoraria.horaFin,
        prioridad: existingData.prioridad,
        estado: newState
      };

      const response = await TurnoService.update(idTurno, payload);
      handleTurnoUpdated(response.data);
    } catch (error) {
      console.error(`Error al cambiar el estado a ${newState}:`, error);
      alert("Ocurrió un error al actualizar el estado del turno.");
    }
  };

  const moverFecha = (direccion) => {
    const nuevaFecha = new Date(fechaActual);
    if (vistaActual === 'mensual') {
      nuevaFecha.setMonth(nuevaFecha.getMonth() + direccion);
    } else if (vistaActual === 'semanal') {
      nuevaFecha.setDate(nuevaFecha.getDate() + (direccion * 7));
    } else {
      nuevaFecha.setDate(nuevaFecha.getDate() + direccion);
    }
    setFechaActual(nuevaFecha);
  };

  const getTextoFecha = () => {
    if (vistaActual === 'mensual') {
      const str = fechaActual.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
    if (vistaActual === 'semanal') {
      const inicio = new Date(fechaActual);
      inicio.setDate(inicio.getDate() - (inicio.getDay() === 0 ? 6 : inicio.getDay() - 1));
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      return `Sem. del ${inicio.getDate()} al ${fin.getDate()} ${inicio.toLocaleDateString('es-AR', { month: 'short' })}`;
    }
    const str = fechaActual.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const togglePriority = (priority) => {
    setActivePriorities((current) =>
      current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority]
    );
  };

  const turnosFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return turnos.filter((turno) => {
      if (turno.estado === 'CANCELADO') return false;
      if (turno.prioridad && !activePriorities.includes(turno.prioridad)) return false;
      if (!term) return true;

      return [
        turno.cliente?.nombre,
        turno.inmueble?.direccion,
        turno.servicio?.descripcion,
        turno.idPresupuesto
      ].some((value) => value && value.toLowerCase().includes(term));
    });
  }, [turnos, searchTerm, activePriorities]);

  const fechaIsoActual = toIsoDate(fechaActual);

  const turnosDiarios = useMemo(
    () => turnosFiltrados.filter((turno) => turno.fechaAsignada === fechaIsoActual),
    [turnosFiltrados, fechaIsoActual]
  );

  const turnosVisibles = useMemo(() => {
    if (vistaActual === 'diaria') return turnosDiarios;

    if (vistaActual === 'semanal') {
      const inicio = new Date(fechaActual);
      const day = inicio.getDay();
      inicio.setDate(inicio.getDate() - (day === 0 ? 6 : day - 1));
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      const desde = toIsoDate(inicio);
      const hasta = toIsoDate(fin);
      return turnosFiltrados.filter((turno) => turno.fechaAsignada >= desde && turno.fechaAsignada <= hasta);
    }

    const monthPrefix = fechaIsoActual.slice(0, 7);
    return turnosFiltrados.filter((turno) => turno.fechaAsignada.startsWith(monthPrefix));
  }, [fechaActual, fechaIsoActual, turnosDiarios, turnosFiltrados, vistaActual]);

  if (loading) {
    return (
      <div className="h-100 w-100 d-flex justify-content-center align-items-center">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Cargando turnos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3 w-100 pb-4">
      
      <div className="d-flex flex-column flex-xl-row justify-content-between align-items-start align-items-xl-center gap-3">
        <div className="d-flex justify-content-between align-items-start w-100 w-xl-auto">
          <div>
            <h2 className="fw-bold fs-2 text-dark m-0" style={{ letterSpacing: '-0.02em' }}>Agenda de Turnos</h2>
            <p className="text-secondary small m-0 mt-1">Planificación, seguimiento operativo, clima y mapa.</p>
          </div>
          <Button onClick={() => abrirNuevoTurno()} variant="primary" className="d-flex d-xl-none btn-sm rounded-pill shadow-sm fw-bold px-3 py-2 flex-shrink-0 ms-3 mt-1" style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}>
            <Plus size={16} className="me-1" /> Turno
          </Button>
        </div>

        <div className="turnos-navigation d-flex flex-wrap align-items-center gap-2 w-100 w-xl-auto mt-2 mt-xl-0">
          <div className="turnos-date-control d-flex align-items-stretch bg-white border rounded-pill shadow-sm overflow-hidden">
            <button onClick={() => moverFecha(-1)} aria-label="Período anterior" className="btn btn-sm btn-light border-0 border-end text-dark px-3 rounded-0 flex-shrink-0"><ChevronLeft size={16}/></button>
            <div className="turnos-date-label px-3 py-2 d-flex align-items-center justify-content-center gap-2 text-secondary small fw-medium bg-white text-center">
              <CalendarIcon size={14} className="flex-shrink-0" />
              <span>{getTextoFecha()}</span>
            </div>
            <button onClick={() => moverFecha(1)} aria-label="Período siguiente" className="btn btn-sm btn-light border-0 border-start text-dark px-3 rounded-0 flex-shrink-0"><ChevronRight size={16}/></button>
          </div>

          <div className="turnos-view-actions d-flex align-items-stretch gap-2">
            <div className="turnos-view-switcher bg-white p-1 rounded-pill shadow-sm border d-flex flex-row flex-nowrap overflow-x-auto scrollbar-none" style={{ minHeight: '38px' }}>
              <button 
                className={`btn btn-sm rounded-pill fw-medium d-flex align-items-center gap-2 px-3 border-0 text-nowrap h-100 ${vistaActual === 'diaria' ? 'bg-light shadow-sm text-dark' : 'text-secondary bg-transparent'}`}
                onClick={() => setVistaActual('diaria')}
              >
                <LayoutDashboard size={14} className="d-none d-sm-inline" /> Diaria
              </button>
              <button 
                className={`btn btn-sm rounded-pill fw-medium d-flex align-items-center gap-2 px-3 border-0 text-nowrap h-100 ${vistaActual === 'semanal' ? 'bg-light shadow-sm text-dark' : 'text-secondary bg-transparent'}`}
                onClick={() => setVistaActual('semanal')}
              >
                <CalendarIcon size={14} className="d-none d-sm-inline" /> Semanal
              </button>
              <button 
                className={`btn btn-sm rounded-pill fw-medium d-flex align-items-center gap-2 px-3 border-0 text-nowrap h-100 ${vistaActual === 'mensual' ? 'bg-light shadow-sm text-dark' : 'text-secondary bg-transparent'}`}
                onClick={() => setVistaActual('mensual')}
              >
                <LayoutList size={14} className="d-none d-sm-inline" /> Mensual
              </button>
            </div>

            <div className="d-none d-xl-block flex-shrink-0">
              <Button onClick={() => abrirNuevoTurno()} variant="primary" className="btn-sm rounded-pill shadow-sm fw-bold px-4 h-100 d-flex align-items-center" style={{backgroundColor: '#1B3006', borderColor: '#1B3006', height: '38px'}}>
                <Plus size={16} className="me-1 d-inline" /> Turno
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="turnos-shared-filters bg-white border rounded-4 shadow-sm p-3 d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center justify-content-between gap-3">
        <div className="turnos-priority-filters d-flex align-items-center gap-2 overflow-x-auto scrollbar-none pb-1 pb-lg-0">
          <span className="text-secondary small fw-bold text-uppercase flex-shrink-0 d-none d-sm-inline">Prioridad:</span>
          {Object.entries(PRIORIDADES_CONFIG).map(([key, config]) => {
            const isActive = activePriorities.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive}
                onClick={() => togglePriority(key)}
                className={`btn btn-sm rounded-pill fw-medium d-flex align-items-center gap-1 px-3 border shadow-sm text-nowrap flex-shrink-0 ${
                  isActive
                    ? `bg-white text-${config.color} border-${config.color}-subtle`
                    : 'bg-light text-secondary border-light-subtle opacity-50'
                }`}
              >
                <span className={`rounded-circle bg-${config.color}`} style={{ width: 8, height: 8 }} />
                {config.label}
              </button>
            );
          })}
        </div>

        <div className="d-flex align-items-center gap-2 flex-grow-1 turnos-search-wrapper">
          <div className="input-group bg-white rounded-pill px-3 py-2 border flex-grow-1">
            <span className="input-group-text bg-transparent border-0 text-secondary p-0 me-2"><Search size={16} /></span>
            <input
              type="search"
              className="form-control bg-transparent border-0 shadow-none text-dark small p-0"
              placeholder="Buscar por cliente o predio..."
              aria-label="Buscar turnos"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
          <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-medium text-nowrap">
            Total: <strong>{turnosVisibles.length}</strong>
          </span>
        </div>
      </div>

      <div className="row g-4 w-100 m-0">
        <div className="col-12 col-lg-8 col-xl-9 p-0 pe-lg-2">
          {vistaActual === 'diaria' && (
            <TurnosKanban
              turnos={turnosDiarios}
              onSelectTurno={handleSelectTurno}
            />
          )}
          {vistaActual === 'semanal' && (
            <TurnosSemanal
              turnos={turnosFiltrados}
              fechaReferencia={fechaActual}
              ahora={ahora}
              onSelectTurno={handleSelectTurno}
              onCreateTurno={abrirNuevoTurno}
            />
          )}
          {vistaActual === 'mensual' && (
            <TurnosMensual
              turnos={turnosFiltrados}
              fechaReferencia={fechaActual}
              hoyIsoStr={ahora.fecha}
              onSelectTurno={handleSelectTurno}
              onSwitchToDailyView={(isoDate) => {
                setFechaActual(fechaDesdeIso(isoDate));
                setVistaActual('diaria');
              }}
            />
          )}
        </div>
        
        <div className="col-12 col-lg-4 col-xl-3 p-0 ps-lg-2 d-flex flex-column gap-4">
          <PanelClima />

          <div
            ref={mapaRef}
            className={`position-relative ${mapaFullscreen ? 'mapa-fullscreen bg-white p-3' : ''}`}
          >
            <button
              type="button"
              onClick={toggleMapaFullscreen}
              aria-label={mapaFullscreen ? 'Salir de pantalla completa' : 'Mapa en pantalla completa'}
              className="btn btn-sm btn-light border shadow-sm rounded-circle position-absolute d-flex align-items-center justify-content-center"
              style={{ top: 10, right: 10, zIndex: 1000, width: 36, height: 36 }}
            >
              {mapaFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <MapaAgenda turnos={turnosVisibles} onSelectTurno={handleSelectTurno} />
          </div>
        </div>
      </div>

      {isNuevoTurnoOpen && (
        <NuevoTurnoModal
          isOpen={isNuevoTurnoOpen}
          onClose={() => setIsNuevoTurnoOpen(false)}
          onTurnoCreated={handleTurnoCreated}
          turnosExistentes={turnos}
          fechaInicial={datosNuevoTurno.fecha || fechaIsoActual}
          horaInicioInicial={datosNuevoTurno.horaInicio || ''}
        />
      )}

      {isModificarOpen && (
        <ModificarTurnoModal
          key={turnoSeleccionado?.idTurno}
          isOpen={isModificarOpen}
          onClose={() => setIsModificarOpen(false)}
          turnoData={turnoSeleccionado}
          onTurnoUpdated={handleTurnoUpdated}
          turnosExistentes={turnos}
        />
      )}

      <TurnoDetalleModal
        isOpen={isDetalleOpen}
        onClose={() => setIsDetalleOpen(false)}
        turnoData={turnoSeleccionado}
        onCancelTurno={handleCancelTurno}
        onEditTurno={openModificarModal}
        onChangeState={handleChangeTurnoState}
      />

    </div>
  );
}