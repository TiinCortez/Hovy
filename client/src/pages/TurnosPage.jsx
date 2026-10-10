import { useState, useEffect } from 'react';
import { LayoutGrid, List, CalendarDays, Plus } from 'lucide-react';
import Button from '../components/ui/Button';
import TurnosKanban from '../components/turnos/TurnosKanban';
import TurnosSemanal from '../components/turnos/TurnosSemanal';
import TurnosMensual from '../components/turnos/TurnosMensual';
import NuevoTurnoModal from '../components/turnos/NuevoTurnoModal';
import TurnoDetalleModal from '../components/turnos/TurnoDetalleModal';
import ModificarTurnoModal from '../components/turnos/ModificarTurnoModal';
import TurnoService from '../services/api/turno.service';
import TurnosNavegacion from '../components/turnos/TurnosNavegacion';
import useRelojTurnos from '../components/turnos/useRelojTurnos';
import { fechaDesdeIso, obtenerAhoraTurnos } from '../components/turnos/agendaTurnos';
import '../components/turnos/turnos.scss';

export default function TurnosPage() {
  const [vistaActual, setVistaActual] = useState('kanban');
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const ahora = useRelojTurnos();
  const [fechaSemanal, setFechaSemanal] = useState(() => obtenerAhoraTurnos().fecha);
  const [fechaMensual, setFechaMensual] = useState(() => obtenerAhoraTurnos().fecha);
  const [datosNuevoTurno, setDatosNuevoTurno] = useState({});

  // Estados para Modales
  const [isNuevoTurnoOpen, setIsNuevoTurnoOpen] = useState(false);
  const [isDetalleOpen, setIsDetalleOpen] = useState(false);
  const [isModificarOpen, setIsModificarOpen] = useState(false);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);

  const abrirNuevoTurno = (datos = {}) => {
    setDatosNuevoTurno(datos);
    setIsNuevoTurnoOpen(true);
  };

  const cambiarVista = (vista) => {
    if (vista === 'semanal') setFechaSemanal(ahora.fecha);
    if (vista === 'mensual') setFechaMensual(ahora.fecha);
    setVistaActual(vista);
  };

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

  const handleSelectTurno = (idTurno) => {
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
    setTurnoSeleccionado(turnoActualizado); // Actualiza el modal de detalle por si quedó abierto debajo
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

  // Función genérica para cambiar de estado (Coordinado -> Confirmado -> Ejecución -> Realizado)
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
    <div className="turnos-page d-flex flex-column gap-4 pb-4 h-100">

      <div className="d-flex flex-column flex-xl-row justify-content-between align-items-start align-items-xl-center gap-3">
        <div>
          <h2 className="fw-bold fs-3 text-dark mb-1">Agenda de Turnos</h2>
          <p className="text-secondary m-0">Planificación y seguimiento operativo.</p>
        </div>

        <div className="turnos-page-actions d-flex flex-wrap gap-2">
          <div className="turnos-view-switcher" role="group" aria-label="Vista de turnos">
            <Button variant="segment" size="sm"
              aria-pressed={vistaActual === 'kanban'}
              className={`turnos-view-option ${vistaActual === 'kanban' ? 'is-active' : ''}`}
              onClick={() => cambiarVista('kanban')}
            >
              <LayoutGrid size={16} /> Kanban
            </Button>
            <Button variant="segment" size="sm"
              aria-pressed={vistaActual === 'semanal'}
              className={`turnos-view-option ${vistaActual === 'semanal' ? 'is-active' : ''}`}
              onClick={() => cambiarVista('semanal')}
            >
              <List size={16} /> Semanal
            </Button>
            <Button variant="segment" size="sm"
              aria-pressed={vistaActual === 'mensual'}
              className={`turnos-view-option ${vistaActual === 'mensual' ? 'is-active' : ''}`}
              onClick={() => cambiarVista('mensual')}
            >
              <CalendarDays size={16} /> Mensual
            </Button>
          </div>

          <Button variant="primary"
            className="turnos-create-button"
            onClick={() => abrirNuevoTurno()}
          >
            <Plus size={18} /> Nuevo Turno
          </Button>
        </div>
      </div>

      {vistaActual === 'kanban' ? (
        <p className="text-secondary small m-0">Turnos de hoy: <strong className="text-dark">{fechaDesdeIso(ahora.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
      ) : (
        <TurnosNavegacion
          vista={vistaActual}
          fecha={vistaActual === 'semanal' ? fechaSemanal : fechaMensual}
          hoy={ahora.fecha}
          onFechaChange={vistaActual === 'semanal' ? setFechaSemanal : setFechaMensual}
        />
      )}

      <div className="flex-grow-1 min-h-0 d-flex flex-column">
        {vistaActual === 'kanban' && (
          <TurnosKanban
            turnos={turnos.filter((turno) => turno.fechaAsignada === ahora.fecha && turno.estado !== 'CANCELADO')}
            onSelectTurno={handleSelectTurno}
          />
        )}
        {vistaActual === 'semanal' && (
          <TurnosSemanal
            turnos={turnos}
            fechaReferencia={fechaDesdeIso(fechaSemanal)}
            ahora={ahora}
            onSelectTurno={handleSelectTurno}
            onCreateTurno={abrirNuevoTurno}
          />
        )}
        {vistaActual === 'mensual' && (
          <TurnosMensual
            turnos={turnos}
            fechaReferencia={fechaDesdeIso(fechaMensual)}
            hoyIsoStr={ahora.fecha}
            onSelectTurno={handleSelectTurno}
            onSwitchToDailyView={(isoDate) => {
              setFechaSemanal(isoDate);
              setVistaActual('semanal');
            }}
          />
        )}
      </div>

      {isNuevoTurnoOpen && <NuevoTurnoModal
        isOpen={isNuevoTurnoOpen}
        onClose={() => setIsNuevoTurnoOpen(false)}
        onTurnoCreated={handleTurnoCreated}
        turnosExistentes={turnos}
        fechaInicial={datosNuevoTurno.fecha}
        horaInicioInicial={datosNuevoTurno.horaInicio}
      />}

      {isModificarOpen && <ModificarTurnoModal
        key={turnoSeleccionado?.idTurno}
        isOpen={isModificarOpen}
        onClose={() => setIsModificarOpen(false)}
        turnoData={turnoSeleccionado}
        onTurnoUpdated={handleTurnoUpdated}
        turnosExistentes={turnos}
      />}

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
