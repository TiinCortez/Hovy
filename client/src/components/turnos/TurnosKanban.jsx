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

    // Reglas estrictas de diseño para "En Ejecución" (todo azul) y "Realizado"
    const cardBorderColor = isEjecucion ? 'border-primary' : 'border-light-subtle';
    const badgeColor = isEjecucion ? 'primary' : pConf.color;
    
    let badgeText = pConf.short;
    if (isRealizado) badgeText = pConf.short.replace(pConf.short.split('-')[1], ' COMPLETADO');
    if (isEjecucion) badgeText = pConf.short.replace(pConf.short.split('-')[1], ' EN CURSO');

    return (
      <div 
        key={turno.idTurno} 
        className={`turnos-agenda-card card rounded-4 bg-white shadow-sm border ${cardBorderColor} ${isEjecucion ? 'turno-en-curso-card' : ''}`}
        style={{ cursor: 'pointer' }}
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
        <div className="row g-0 h-100 position-relative">
          {/* Borde indicador izquierdo (Azul si es en ejecución) */}
          <div className={`position-absolute top-0 start-0 h-100 ${isEjecucion ? 'turno-en-curso-bg' : `bg-${pConf.color}`}`} style={{ width: '4px' }}></div>
          
          <div className="col-12 p-3 ps-4 d-flex flex-column">
            
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <span className={`badge bg-${badgeColor}-subtle text-${badgeColor} border border-${badgeColor}-subtle rounded-pill px-2 py-1 fw-bold ${isEjecucion ? 'turno-en-curso-subtle' : ''}`} style={{fontSize: '0.65rem'}}>
                {isEjecucion && <span className="turno-en-curso-dot me-1" />}
                {badgeText}
              </span>
              <span className={`small fw-bold d-flex align-items-center gap-1 ${isRealizado ? 'text-success' : isEjecucion ? 'turno-en-curso-text' : 'text-secondary'}`}>
                {isRealizado && <Clock size={14} />} {formatearHorarioTurno(turno)}
              </span>
            </div>

            <h6 className={`fw-bold m-0 mb-1 fs-6 ${isEjecucion ? 'text-dark' : 'text-dark'}`}>{turno.cliente.nombre}</h6>
            <div className={`small d-flex align-items-start gap-1 mb-3 ${isEjecucion ? 'text-secondary' : 'text-secondary'}`}>
              <MapPin size={14} className="mt-1 flex-shrink-0"/> 
              <span className="min-w-0">{turno.inmueble.direccion}</span>
            </div>

            <hr className="my-0 mb-2 opacity-10" />

            <div className="d-flex flex-column align-items-start gap-2 mt-auto">
              <div className={`small fw-medium w-100 min-w-0 text-break ${isEjecucion ? 'turno-en-curso-text' : 'text-secondary'}`}>
                {turno.servicio.descripcion}
              </div>
              
              {isRealizado ? (
                <div className="d-flex flex-wrap align-items-center gap-1 bg-light rounded-2 px-2 py-1 text-secondary small border align-self-end">
                  <Clock size={12} /> Duración: <strong className="text-dark ms-1">{turno.duracionReal}</strong>
                </div>
              ) : (
                <span className={`small fw-bold text-nowrap d-flex align-items-center gap-1 flex-shrink-0 align-self-end ${isEjecucion ? 'turno-en-curso-text' : 'text-secondary'}`}>
                  {isEjecucion ? 'Ver Ficha' : 'Detalle'} <ChevronRight size={14} />
                </span>
              )}
            </div>

          </div>
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
              <summary className={`turnos-estado-header border-top border-2 ${col.borderColor}`} aria-controls={`${idBase}-${col.id}`}>
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
