import { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, LayoutDashboard, LayoutList, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import Button from '../components/ui/Button';
import TurnosKanban from '../components/turnos/TurnosKanban';
import TurnosSemanal from '../components/turnos/TurnosSemanal';
import TurnosMensual from '../components/turnos/TurnosMensual';
import NuevoTurnoModal from '../components/turnos/NuevoTurnoModal';

const PRIORIDADES_CONFIG = {
  P1_REASIGNADO: { label: 'P1 Reasignado', color: 'danger' },
  P2_FIJO: { label: 'P2 Fijo', color: 'success' },
  P3_CASUAL: { label: 'P3 Casual', color: 'secondary' }
};

const PRIORIDADES_INICIALES = Object.keys(PRIORIDADES_CONFIG);

const MOCK_PRESUPUESTOS_APROBADOS = [
  {
    idPresupuesto: 120,
    codigo: '#PR-120',
    estado: 'APROBADO',
    importe: 48500,
    prioridadSugerida: 'P2_FIJO',
    duracionEstimadaMin: 150,
    cliente: { nombre: 'Mariana Gómez de Laprida', telefono: '+54 9 351 433-0429', tipo: 'Cliente fijo' },
    inmueble: {
      direccion: 'Francisco N. de Laprida 459 · Mz 12 Lote 4B',
      zona: 'Barrio Las Delicias, Córdoba',
      tipo: 'Casa habitada'
    },
    superficieMantenible: '450 m² de césped + setos perimetrales',
    servicio: {
      descripcion: 'Corte de césped intensivo y perfilado de bordes',
      detalle: 'Incluye desmalezado en cordones, recolección y soplado integral.'
    }
  },
  {
    idPresupuesto: 121,
    codigo: '#PR-121',
    estado: 'APROBADO',
    importe: 32000,
    prioridadSugerida: 'P3_CASUAL',
    duracionEstimadaMin: 120,
    cliente: { nombre: 'Federico López', telefono: '+54 9 351 555-0182', tipo: 'Casual' },
    inmueble: {
      direccion: 'Av. Recta Martinolli 6840',
      zona: 'Argüello, Córdoba',
      tipo: 'Casa habitada'
    },
    superficieMantenible: '280 m² de césped',
    servicio: {
      descripcion: 'Corte general y limpieza de jardín',
      detalle: 'Incluye terminación de bordes y retiro de residuos verdes.'
    }
  },
  {
    idPresupuesto: 122,
    codigo: '#PR-122',
    estado: 'APROBADO',
    importe: 71000,
    prioridadSugerida: 'P2_FIJO',
    duracionEstimadaMin: 150,
    cliente: { nombre: 'Consorcio Los Aromos', telefono: '+54 9 351 444-7721', tipo: 'Cliente fijo' },
    inmueble: {
      direccion: 'José Roque Funes 1880',
      zona: 'Cerro de las Rosas, Córdoba',
      tipo: 'Consorcio'
    },
    superficieMantenible: '720 m² de espacios comunes',
    servicio: {
      descripcion: 'Mantenimiento integral de espacios verdes',
      detalle: 'Corte, perfilado, poda liviana y limpieza de sectores comunes.'
    }
  }
];

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function TurnosPage() {
  const [vistaActual, setVistaActual] = useState('mensual'); 
  const [fechaActual, setFechaActual] = useState(new Date(2026, 9, 24)); // 24 de Octubre de 2026
  const [searchTerm, setSearchTerm] = useState('');
  const [activePriorities, setActivePriorities] = useState(PRIORIDADES_INICIALES);

  // Modelo de datos centralizado
  const [turnos, setTurnos] = useState([
    {
      idTurno: 1,
      idPresupuesto: '#PR-104',
      cliente: { nombre: 'Mariana G.', telefono: '3514330429' },
      inmueble: { direccion: 'B° Las Delicias · Casa 14', tipo: 'Casa Habitada' },
      servicio: { descripcion: 'Corte intensivo + bordes' },
      franjaHoraria: { horaInicio: '08:30', horaFin: '11:00' },
      prioridad: 'P1_REASIGNADO',
      estado: 'COORDINADO',
      fechaAsignada: '2026-10-24'
    },
    {
      idTurno: 2,
      idPresupuesto: '#PR-089',
      cliente: { nombre: 'Dr. Sergio P.', telefono: '3512223344' },
      inmueble: { direccion: 'Villa Warcalde', tipo: 'Casa Habitada' },
      servicio: { descripcion: 'Desmalezado puntual' },
      franjaHoraria: { horaInicio: '16:30', horaFin: '18:00' },
      prioridad: 'P3_CASUAL',
      estado: 'COORDINADO',
      fechaAsignada: '2026-10-24'
    },
    {
      idTurno: 3,
      idPresupuesto: '#PR-098',
      cliente: { nombre: 'Roberto G.', telefono: '3515556677' },
      inmueble: { direccion: 'B° Los Álamos · Lote 22', tipo: 'Lote Vacio' },
      servicio: { descripcion: 'Mantenimiento + setos' },
      franjaHoraria: { horaInicio: '11:30', horaFin: '13:00' },
      prioridad: 'P2_FIJO',
      estado: 'CONFIRMADO',
      fechaAsignada: '2026-10-24'
    },
    {
      idTurno: 4,
      idPresupuesto: '#PR-112',
      cliente: { nombre: 'Julián A.', telefono: '3519998877' },
      inmueble: { direccion: 'B° El Bosque', tipo: 'Casa Habitada' },
      servicio: { descripcion: 'Corte césped + cerco' },
      franjaHoraria: { horaInicio: '08:30', horaFin: '11:30' },
      prioridad: 'P2_FIJO',
      estado: 'CONFIRMADO',
      fechaAsignada: '2026-10-25'
    },
    {
      idTurno: 5,
      idPresupuesto: '#PR-115',
      cliente: { nombre: 'Sta María', telefono: '3514445566' },
      inmueble: { direccion: 'Canchas deportivas', tipo: 'Empresa' },
      servicio: { descripcion: 'Mantenimiento deportivo' },
      franjaHoraria: { horaInicio: '09:00', horaFin: '12:30' },
      prioridad: 'P2_FIJO',
      estado: 'CONFIRMADO',
      fechaAsignada: '2026-10-26'
    },
    {
      idTurno: 6,
      idPresupuesto: '#PR-110',
      cliente: { nombre: 'Residencia Lomas', telefono: '3517778899' },
      inmueble: { direccion: 'Av. Colón 4320', tipo: 'Casa Habitada' },
      servicio: { descripcion: 'Mantenimiento completo' },
      franjaHoraria: { horaInicio: '14:00', horaFin: '16:30' },
      prioridad: 'P2_FIJO',
      estado: 'EN_EJECUCION',
      fechaAsignada: '2026-10-24'
    },
    {
      idTurno: 7,
      idPresupuesto: '#PR-085',
      cliente: { nombre: 'Esteban M.', telefono: '3516667788' },
      inmueble: { direccion: 'Camino La Calera', tipo: 'Lote Vacio' },
      servicio: { descripcion: 'Desmalezado motoguadaña' },
      franjaHoraria: { horaInicio: '09:00', horaFin: '10:45' },
      prioridad: 'P3_CASUAL',
      estado: 'REALIZADO',
      duracionReal: '2h 15m',
      fechaAsignada: '2026-10-21'
    }
  ]);
  const [presupuestosAprobados, setPresupuestosAprobados] = useState(MOCK_PRESUPUESTOS_APROBADOS);
  const [nuevoTurnoConfig, setNuevoTurnoConfig] = useState(null);

  const handleSelectTurno = (idTurno) => {
    console.log("Abrir detalle del turno ID:", idTurno);
  };

  const handleCreateTurno = ({ fecha = toIsoDate(fechaActual), horaInicio = '' } = {}) => {
    setNuevoTurnoConfig({ fecha, horaInicio });
  };

  const handleTurnoCreated = (payload) => {
    const presupuesto = presupuestosAprobados.find(
      (item) => item.idPresupuesto === payload.idPresupuesto
    );

    if (!presupuesto) return;

    setTurnos((current) => [
      ...current,
      {
        idTurno: Date.now(),
        idPresupuesto: presupuesto.codigo,
        cliente: {
          nombre: presupuesto.cliente.nombre,
          telefono: presupuesto.cliente.telefono
        },
        inmueble: {
          direccion: presupuesto.inmueble.direccion,
          tipo: presupuesto.inmueble.tipo
        },
        servicio: { descripcion: presupuesto.servicio.descripcion },
        franjaHoraria: {
          horaInicio: payload.horaInicio,
          horaFin: payload.horaFin
        },
        prioridad: payload.prioridad,
        estado: payload.estado,
        fechaAsignada: payload.fecha
      }
    ]);
    setPresupuestosAprobados((current) => (
      current.filter((item) => item.idPresupuesto !== payload.idPresupuesto)
    ));
  };

  // Switch a vista diaria desde el calendario mensual (Al clickear "+N más" o doble clic)
  const handleSwitchToDailyView = (fechaIso) => {
    // Ajuste de zona horaria para crear la fecha correctamente desde "YYYY-MM-DD"
    const [year, month, day] = fechaIso.split('-');
    setFechaActual(new Date(year, month - 1, day));
    setVistaActual('diaria');
  };

  // Navegación dinámica dependiente de la vista activa
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
      const startOfYear = new Date(inicio.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(Math.floor((inicio - startOfYear) / (24 * 60 * 60 * 1000)) / 7);
      return `Sem. ${weekNumber}: ${inicio.getDate()} - ${fin.getDate()} ${inicio.toLocaleDateString('es-AR', { month: 'short' })}`;
    }
    const str = fechaActual.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const togglePriority = (priority) => {
    setActivePriorities((current) => (
      current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority]
    ));
  };

  const turnosFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('es');

    return turnos.filter((turno) => {
      if (turno.estado === 'CANCELADO' || !activePriorities.includes(turno.prioridad)) return false;
      if (!term) return true;

      return [
        turno.cliente.nombre,
        turno.inmueble.direccion,
        turno.servicio.descripcion,
        turno.idPresupuesto
      ].some((value) => value.toLocaleLowerCase('es').includes(term));
    });
  }, [turnos, searchTerm, activePriorities]);

  const turnosDiarios = useMemo(
    () => turnosFiltrados.filter((turno) => turno.fechaAsignada === toIsoDate(fechaActual)),
    [turnosFiltrados, fechaActual]
  );

  const totalVisible = useMemo(() => {
    if (vistaActual === 'diaria') return turnosDiarios.length;

    if (vistaActual === 'semanal') {
      const inicio = new Date(fechaActual);
      const day = inicio.getDay();
      inicio.setDate(inicio.getDate() - (day === 0 ? 6 : day - 1));
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      const desde = toIsoDate(inicio);
      const hasta = toIsoDate(fin);
      return turnosFiltrados.filter((turno) => turno.fechaAsignada >= desde && turno.fechaAsignada <= hasta).length;
    }

    const monthPrefix = toIsoDate(fechaActual).slice(0, 7);
    return turnosFiltrados.filter((turno) => turno.fechaAsignada.startsWith(monthPrefix)).length;
  }, [fechaActual, turnosDiarios, turnosFiltrados, vistaActual]);

  return (
    <div className="d-flex flex-column gap-3 w-100">
      
      {/* HEADER */}
      <div className="d-flex flex-column flex-xl-row justify-content-between align-items-start align-items-xl-center gap-3">
        
        <div className="d-flex justify-content-between align-items-start w-100 w-xl-auto">
          <div>
            <h2 className="fw-bold fs-2 text-dark m-0" style={{ letterSpacing: '-0.02em' }}>Agenda de Turnos</h2>
            <p className="text-secondary small m-0 mt-1">Control operativo y programación de cuadrillas</p>
          </div>
          <Button onClick={() => handleCreateTurno()} variant="primary" className="d-flex d-xl-none btn-sm rounded-pill shadow-sm fw-bold px-3 py-2 flex-shrink-0 ms-3 mt-1" style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}>
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
              <Button onClick={() => handleCreateTurno()} variant="primary" className="btn-sm rounded-pill shadow-sm fw-bold px-4 h-100 d-flex align-items-center" style={{backgroundColor: '#1B3006', borderColor: '#1B3006', height: '38px'}}>
                <Plus size={16} className="me-1 d-inline" /> Turno
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* FILTROS COMPARTIDOS: persisten al cambiar de vista */}
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

        <div className="d-flex align-items-center gap-2 w-100 turnos-search-wrapper">
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
            Total: <strong>{totalVisible}</strong>
          </span>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="w-100">
        {vistaActual === 'diaria' && <TurnosKanban turnos={turnosDiarios} onSelectTurno={handleSelectTurno} />}
        {vistaActual === 'semanal' && <TurnosSemanal turnos={turnosFiltrados} fechaReferencia={fechaActual} onSelectTurno={handleSelectTurno} onCreateTurno={handleCreateTurno} />}
        {vistaActual === 'mensual' && <TurnosMensual turnos={turnosFiltrados} fechaReferencia={fechaActual} onSelectTurno={handleSelectTurno} onSwitchToDailyView={handleSwitchToDailyView} />}
      </div>

      {nuevoTurnoConfig && (
        <NuevoTurnoModal
          isOpen
          onClose={() => setNuevoTurnoConfig(null)}
          onTurnoCreated={handleTurnoCreated}
          presupuestosAprobados={presupuestosAprobados}
          turnosExistentes={turnos}
          datosClima={{ pronostico: 'Despejado (25 °C), jornada favorable para tareas exteriores.', horaAnochecer: '19:45' }}
          fechaInicial={nuevoTurnoConfig.fecha}
          horaInicioInicial={nuevoTurnoConfig.horaInicio}
        />
      )}

    </div>
  );
}
