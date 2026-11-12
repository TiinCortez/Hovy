import { useId, useState } from 'react';
import { MapPin, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import Card from '../ui/Card';
import { PRIORIDADES_CONFIG as prioridadesConfig, compararHorarioTurnos, formatearHorarioTurno } from './agendaTurnos';

export default function TurnosKanban({ turnos, onSelectTurno }) {
  const [colFiltro, setColFiltro] = useState('TODOS'); // Filtro de columnas activo restaurado
  const [estadosAbiertos, setEstadosAbiertos] = useState({});
  const idBase = useId();

  const seleccionarEstado = (estado) => {
    setColFiltro(estado);
    if (estado !== 'TODOS') setEstadosAbiertos(actuales => ({ ...actuales, [estado]: true }));
  };

  const columnasConfig = [
    { id: 'COORDINADO', title: 'COORDINADOS', dotColor: 'bg-warning', borderColor: 'border-warning' },
    { id: 'CONFIRMADO', title: 'CONFIRMADOS', dotColor: 'bg-success', borderColor: 'border-success' },
    { id: 'EN_EJECUCION', title: 'EN EJECUCIÓN', dotColor: 'turno-en-curso-bg', borderColor: 'turno-en-curso-border' },
    { id: 'REALIZADO', title: 'REALIZADOS', dotColor: 'bg-secondary', borderColor: 'border-secondary' }
  ];

  const ordenarTurnos = (turnosArray) => {
    return [...turnosArray].sort((a, b) => {
      const weightA = prioridadesConfig[a.prioridad].weight;
      const weightB = prioridadesConfig[b.prioridad].weight;
      if (weightA !== weightB) return weightB - weightA;
      return compararHorarioTurnos(a, b);
    });
  };

  const getTurnosPorEstado = (estado) => ordenarTurnos(turnos.filter(t => t.estado === estado));

  const renderCard = (turno) => {
    const pConf = prioridadesConfig[turno.prioridad];
    const isRealizado = turno.estado === 'REALIZADO';
    const isEjecucion = turno.estado === 'EN_EJECUCION';
    // Priority label: "P2 · Fijo". P1 (reasignado / urgente) is the only one highlighted.
    const [, tipoPrioridad = ''] = pConf.short.split(' - ');
    const etiquetaPrioridad = `${pConf.code} · ${tipoPrioridad.charAt(0)}${tipoPrioridad.slice(1).toLowerCase()}`;

    return (
      <div
        key={turno.idTurno}
        className="turnos-agenda-card"
        role="button"
        tabIndex={0}
        aria-label={`Ver turno de ${turno.cliente.nombre}`}
        onClick={() => onSelectTurno(turno.idTurno)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectTurno(turno.idTurno);
          }
        }}
      >
        <div className="d-flex align-items-center justify-content-between gap-2">
          <span className="turnos-agenda-card-hora d-flex align-items-center gap-1">
            <Clock size={14} className="text-secondary" aria-hidden="true" />
            {formatearHorarioTurno(turno)}
          </span>
          <span className={`turnos-agenda-etiqueta ${pConf.code === 'P1' ? 'turnos-agenda-etiqueta--p1' : ''}`}>
            {etiquetaPrioridad}
          </span>
        </div>

        <h6 className="turnos-agenda-card-cliente">{turno.cliente.nombre}</h6>
        <div className="turnos-agenda-card-direccion">
          <MapPin size={13} className="mt-1 flex-shrink-0" aria-hidden="true" />
          <span className="min-w-0">{turno.inmueble.direccion}</span>
        </div>

        {(isEjecucion || isRealizado) && (
          <div className="mt-2">
            {isEjecucion && (
              <span className="turnos-agenda-etiqueta turnos-agenda-etiqueta--en-curso">
                <span className="turno-en-curso-dot" aria-hidden="true" /> En curso
              </span>
            )}
            {isRealizado && (
              <span className="turnos-agenda-etiqueta turnos-agenda-etiqueta--realizado">
                Realizado · {turno.duracionReal}
              </span>
            )}
          </div>
        )}

        <div className="turnos-agenda-card-pie">
          <span className="fw-semibold text-dark min-w-0 text-break">{turno.servicio.descripcion}</span>
          <span className="fw-semibold text-nowrap d-flex align-items-center flex-shrink-0" style={{ color: '#1B3006' }}>
            {isEjecucion ? 'Ver ficha' : 'Detalle'} <ChevronRight size={14} />
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card className="turnos-kanban-card p-0 shadow-sm border-0 rounded-4 bg-white overflow-hidden">
      {/* Filtros exclusivos de estado del Kanban */}
      <div className="hovy-filter-group mb-3" role="group" aria-label="Filtrar turnos por estado">
        <button 
          type="button"
          onClick={() => seleccionarEstado('TODOS')}
          aria-pressed={colFiltro === 'TODOS'}
          className={`btn btn-sm rounded-pill fw-bold border shadow-sm ${colFiltro === 'TODOS' ? 'bg-dark text-white border-dark' : 'bg-white text-secondary'}`}
        >
          <span className="hovy-filter-label">Todos</span>
          <span className={`hovy-filter-count badge rounded-circle ${colFiltro === 'TODOS' ? 'bg-secondary' : 'bg-light text-secondary border'}`}>{turnos.length}</span>
        </button>
        {columnasConfig.map(col => {
          const count = getTurnosPorEstado(col.id).length;
          return (
            <button 
              key={col.id}
              type="button"
              onClick={() => seleccionarEstado(col.id)}
              aria-pressed={colFiltro === col.id}
              className={`btn btn-sm rounded-pill fw-bold border shadow-sm ${colFiltro === col.id ? 'bg-white text-dark border-dark' : 'bg-white text-secondary'}`}
            >
              <span className={`hovy-filter-dot ${col.id === 'EN_EJECUCION' ? 'turno-en-curso-dot' : `rounded-circle ${col.dotColor}`}`} style={{width: 8, height: 8}} aria-hidden="true"></span>
              <span className="hovy-filter-label">{col.title.charAt(0) + col.title.slice(1).toLowerCase()}</span>
              <span className="hovy-filter-count badge bg-light text-secondary border rounded-circle">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Estados apilados en móvil; dos columnas en tablet y cuatro en escritorio. */}
      <div className={`turnos-estados-grid ${colFiltro !== 'TODOS' ? 'is-filtered' : ''}`}>
        {columnasConfig.map(col => {
          const colTurnos = getTurnosPorEstado(col.id);
          
          // Ocultar si el filtro está activo en otra columna
          if (colFiltro !== 'TODOS' && colFiltro !== col.id) return null;
          const abierto = estadosAbiertos[col.id] ?? colTurnos.length > 0;
          
          return (
            <details
              key={col.id}
              className="turnos-estado"
              open={abierto}
              onToggle={(event) => {
                const nuevoEstado = event.currentTarget.open;
                if (nuevoEstado === abierto) return;
                setEstadosAbiertos(actuales => actuales[col.id] === nuevoEstado ? actuales : { ...actuales, [col.id]: nuevoEstado });
              }}
            >
              
              {/* Cabecera de Columna */}
              <summary className="turnos-estado-header" aria-controls={`${idBase}-${col.id}`}>
                <span className={`turnos-estado-dot ${col.id === 'EN_EJECUCION' ? 'turno-en-curso-dot' : `rounded-circle ${col.dotColor}`}`} aria-hidden="true" />
                <h3 className="turnos-estado-titulo">{col.title.charAt(0) + col.title.slice(1).toLowerCase()}</h3>
                <span className="turnos-estado-count badge bg-white text-secondary border rounded-pill">{colTurnos.length}</span>
                <ChevronDown size={16} className="turnos-estado-chevron" aria-hidden="true" />
              </summary>

              {/* Contenedor de Tarjetas */}
              <div className="turnos-estado-lista" id={`${idBase}-${col.id}`}>
                {colTurnos.length === 0 ? (
                  <div className="text-center p-3 text-secondary small fw-medium opacity-50 border border-dashed rounded-3">
                    Sin turnos en este estado
                  </div>
                ) : (
                  colTurnos.map(turno => renderCard(turno))
                )}
              </div>

            </details>
          );
        })}
      </div>

    </Card>
  );
}
