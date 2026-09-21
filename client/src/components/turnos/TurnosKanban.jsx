import { useState } from 'react';
import { MapPin, Clock, ChevronRight } from 'lucide-react';
import Card from '../ui/Card';

export default function TurnosKanban({ turnos, onSelectTurno }) {
  const [colFiltro, setColFiltro] = useState('TODOS'); // Filtro de columnas activo restaurado

  const prioridadesConfig = {
    'P1_REASIGNADO': { label: 'P1 Reasignado', short: 'P1 - REASIGNADO', color: 'danger', weight: 3 },
    'P2_FIJO': { label: 'P2 Fijo', short: 'P2 - FIJO', color: 'success', weight: 2 },
    'P3_CASUAL': { label: 'P3 Casual', short: 'P3 - CASUAL', color: 'secondary', weight: 1 }
  };

  const columnasConfig = [
    { id: 'COORDINADO', title: 'COORDINADOS', subtitle: 'Pendiente validación', dotColor: 'bg-warning', borderColor: 'border-warning' },
    { id: 'CONFIRMADO', title: 'CONFIRMADOS', subtitle: 'Listos para jornada', dotColor: 'bg-success', borderColor: 'border-success' },
    { id: 'EN_EJECUCION', title: 'EN EJECUCIÓN', subtitle: 'En curso', dotColor: 'turno-en-curso-bg', borderColor: 'turno-en-curso-border' },
    { id: 'REALIZADO', title: 'REALIZADOS', subtitle: 'Completados', dotColor: 'bg-secondary', borderColor: 'border-secondary' }
  ];

  const ordenarTurnos = (turnosArray) => {
    return [...turnosArray].sort((a, b) => {
      const weightA = prioridadesConfig[a.prioridad].weight;
      const weightB = prioridadesConfig[b.prioridad].weight;
      if (weightA !== weightB) return weightB - weightA;
      return a.franjaHoraria.horaInicio.localeCompare(b.franjaHoraria.horaInicio);
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
        className={`card rounded-4 overflow-hidden mb-3 bg-white shadow-sm border ${cardBorderColor} ${isEjecucion ? 'turno-en-curso-card' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelectTurno(turno.idTurno)}
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
                {isRealizado && <Clock size={14} />} {turno.franjaHoraria.horaInicio} - {turno.franjaHoraria.horaFin} hs
              </span>
            </div>

            <h6 className={`fw-bold m-0 mb-1 fs-6 ${isEjecucion ? 'text-dark' : 'text-dark'}`}>{turno.cliente.nombre}</h6>
            <div className={`small d-flex align-items-start gap-1 mb-3 ${isEjecucion ? 'text-secondary' : 'text-secondary'}`}>
              <MapPin size={14} className="mt-1 flex-shrink-0"/> 
              <span className="text-truncate">{turno.inmueble.direccion}</span>
            </div>

            <hr className="my-0 mb-2 opacity-10" />

            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-end gap-2 mt-auto">
              <div className={`small fw-medium w-100 text-break ${isEjecucion ? 'turno-en-curso-text' : 'text-secondary'}`}>
                {isEjecucion ? (
                  <span style={{fontSize: '0.75rem'}}>Cuadrilla: Carlos & Lucas · Inicio: 14:10 hs</span>
                ) : (
                  turno.servicio.descripcion
                )}
              </div>
              
              {isRealizado ? (
                <div className="d-flex align-items-center gap-1 bg-light rounded-2 px-2 py-1 text-secondary small border flex-shrink-0 align-self-end">
                  <Clock size={12} /> Duración: <strong className="text-dark ms-1">{turno.duracionReal}</strong>
                </div>
              ) : (
                <span className={`small fw-bold text-nowrap d-flex align-items-center gap-1 flex-shrink-0 align-self-end ${isEjecucion ? 'turno-en-curso-text' : 'text-secondary'}`}>
                  {isEjecucion ? 'Ver Ficha' : 'Detalle'} <ChevronRight size={14} />
                </span>
              )}
            </div>

            {isEjecucion && (
              <div className="mt-2 text-dark small fw-medium text-truncate">{turno.servicio.descripcion}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="turnos-kanban-card p-0 shadow-sm border-0 rounded-4 bg-white overflow-hidden">
      {/* Filtros exclusivos de estado del Kanban */}
      <div className="d-flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none w-100">
        <button 
          onClick={() => setColFiltro('TODOS')} 
          className={`btn btn-sm rounded-pill fw-bold px-3 py-2 text-nowrap d-flex align-items-center gap-2 border shadow-sm ${colFiltro === 'TODOS' ? 'bg-dark text-white border-dark' : 'bg-white text-secondary'}`}
        >
          Todos <span className={`badge rounded-circle ${colFiltro === 'TODOS' ? 'bg-secondary' : 'bg-light text-secondary border'}`}>{turnos.length}</span>
        </button>
        {columnasConfig.map(col => {
          const count = getTurnosPorEstado(col.id).length;
          return (
            <button 
              key={col.id}
              onClick={() => setColFiltro(col.id)}
              className={`btn btn-sm rounded-pill fw-bold px-3 py-2 text-nowrap d-flex align-items-center gap-2 border shadow-sm ${colFiltro === col.id ? 'bg-white text-dark border-dark' : 'bg-white text-secondary'}`}
            >
              <span className={col.id === 'EN_EJECUCION' ? 'turno-en-curso-dot' : `rounded-circle ${col.dotColor}`} style={{width: 8, height: 8}}></span>
              {col.title.charAt(0) + col.title.slice(1).toLowerCase()} <span className="badge bg-light text-secondary border rounded-circle">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grilla Kanban */}
      <div className="row g-4">
        {columnasConfig.map(col => {
          const colTurnos = getTurnosPorEstado(col.id);
          
          // Ocultar si el filtro está activo en otra columna
          if (colFiltro !== 'TODOS' && colFiltro !== col.id) return null;
          
          return (
            // col-12 en móviles asegura que se apilen una debajo de la otra. col-xl-3 las pone en línea en PC.
            <div key={col.id} className="col-12 col-xl-3 d-flex flex-column">
              
              {/* Cabecera de Columna */}
              <div className={`border-top border-2 pt-3 mb-3 d-flex justify-content-between align-items-start ${col.borderColor}`}>
                <div className="d-flex align-items-center gap-2">
                  <span className={col.id === 'EN_EJECUCION' ? 'turno-en-curso-dot' : `rounded-circle ${col.dotColor}`} style={{width: 10, height: 10}}></span>
                  <h6 className="m-0 fw-bold text-dark">{col.title}</h6>
                  <span className="badge bg-warning bg-opacity-25 text-dark rounded-circle px-2 py-1 border border-warning border-opacity-50">{colTurnos.length}</span>
                </div>
                <span className="small text-secondary fw-medium text-end ps-2">{col.subtitle}</span>
              </div>

              {/* Contenedor de Tarjetas */}
              <div className="flex-grow-1">
                {colTurnos.length === 0 ? (
                  <div className="text-center p-3 text-secondary small fw-medium opacity-50 border border-dashed rounded-3">
                    Sin turnos en este estado
                  </div>
                ) : (
                  colTurnos.map(turno => renderCard(turno))
                )}
              </div>

            </div>
          );
        })}
      </div>

    </Card>
  );
}
