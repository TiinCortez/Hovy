import { useState, useMemo } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import Card from '../ui/Card';

const PRIORIDADES_CONFIG = {
  P1_REASIGNADO: { short: 'P1', full: 'P1 Reasignado', color: 'danger', weight: 3 },
  P2_FIJO: { short: 'P2', full: 'P2 Fijo', color: 'success', weight: 2 },
  P3_CASUAL: { short: 'P3', full: 'P3 Casual', color: 'secondary', weight: 1 }
};

export default function TurnosMensual({ turnos, fechaReferencia, onSelectTurno, onSwitchToDailyView }) {
  // Estado para la vista mobile (día seleccionado)
  const [diaSeleccionadoMobile, setDiaSeleccionadoMobile] = useState('');

  // Determinar "Hoy" global (Mockeado)
  const hoyIsoStr = new Date(2026, 9, 24).toISOString().split('T')[0];

  // =======================================================
  // 1. GENERACIÓN DE LA MATRIZ DEL CALENDARIO (6 Semanas)
  // =======================================================
  const diasCalendario = useMemo(() => {
    const year = fechaReferencia.getFullYear();
    const month = fechaReferencia.getMonth();
    
    // Primer día del mes (Ajustado para que Lunes sea 0)
    let firstDayIndex = new Date(year, month, 1).getDay();
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const matrix = [];
    
    // Rellenar días del mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      matrix.push({
        iso: d.toISOString().split('T')[0],
        diaNumero: d.getDate(),
        isCurrentMonth: false,
        isToday: d.toISOString().split('T')[0] === hoyIsoStr
      });
    }

    // Rellenar días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      matrix.push({
        iso: d.toISOString().split('T')[0],
        diaNumero: d.getDate(),
        isCurrentMonth: true,
        isToday: d.toISOString().split('T')[0] === hoyIsoStr
      });
    }

    // Rellenar días del mes siguiente (Hasta completar 42 celdas = 6 semanas)
    const paddingRight = 42 - matrix.length;
    for (let i = 1; i <= paddingRight; i++) {
      const d = new Date(year, month + 1, i);
      matrix.push({
        iso: d.toISOString().split('T')[0],
        diaNumero: d.getDate(),
        isCurrentMonth: false,
        isToday: d.toISOString().split('T')[0] === hoyIsoStr
      });
    }

    return matrix;
  }, [fechaReferencia, hoyIsoStr]);

  const diaSeleccionadoActivo = diasCalendario.some((dia) => dia.iso === diaSeleccionadoMobile)
    ? diaSeleccionadoMobile
    : (
      diasCalendario.find((dia) => dia.isToday && dia.isCurrentMonth)?.iso
      || diasCalendario.find((dia) => dia.isCurrentMonth)?.iso
      || ''
    );

  // =======================================================
  // 2. AGRUPACIÓN Y ORDENAMIENTO DE TURNOS
  // =======================================================
  const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':');
    return parseInt(h, 10) * 60 + parseInt(m, 10);
  };

  const turnosAgrupados = useMemo(() => {
    const grouped = {};
    turnos.forEach(t => {
      if (t.estado === 'CANCELADO') return;
      if (!grouped[t.fechaAsignada]) grouped[t.fechaAsignada] = [];
      grouped[t.fechaAsignada].push(t);
    });

    // Ordenar internamente (Hora de inicio > Prioridad)
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const timeDifference = parseTime(a.franjaHoraria.horaInicio) - parseTime(b.franjaHoraria.horaInicio);
        if (timeDifference !== 0) return timeDifference;
        const weightA = PRIORIDADES_CONFIG[a.prioridad].weight;
        const weightB = PRIORIDADES_CONFIG[b.prioridad].weight;
        return weightB - weightA;
      });
    });
    return grouped;
  }, [turnos]);

  // Total de turnos en el mes visible
  const totalTurnosMes = useMemo(() => {
    return turnos.filter(t => t.estado !== 'CANCELADO' && t.fechaAsignada.startsWith(fechaReferencia.toISOString().split('T')[0].substring(0, 7))).length;
  }, [turnos, fechaReferencia]);

  const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const nombresDiasCorto = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  // Agrupar en semanas para renderizar las filas
  const semanas = [];
  for (let i = 0; i < 42; i += 7) semanas.push(diasCalendario.slice(i, i + 7));

  return (
    <Card className="turnos-calendar-card p-0 shadow-sm border-0 rounded-4 bg-white overflow-hidden d-flex flex-column h-100">
      
      {/* ========================================================
          VISTA MOBILE: Calendario Compacto + Lista
          ======================================================== */}
      <div className="d-flex d-lg-none flex-column w-100 h-100 bg-light bg-opacity-50 overflow-hidden">
        
        {/* Calendario superior */}
        <div className="bg-white px-3 pb-3 shadow-sm border-bottom">
          <div className="d-flex justify-content-between text-secondary small fw-bold text-center mb-2 mt-3">
            {nombresDiasCorto.map(d => <div key={d} style={{width: '14.28%'}}>{d}</div>)}
          </div>
          
          <div className="d-flex flex-column gap-1">
            {semanas.map((semana, idx) => (
              <div key={idx} className="d-flex justify-content-between text-center">
                {semana.map(dia => {
                  const turnosDia = turnosAgrupados[dia.iso] || [];
                  const isSelected = dia.iso === diaSeleccionadoActivo;
                  // Extraer hasta 3 colores para los puntitos
                  const dots = turnosDia.slice(0, 3).map(t => PRIORIDADES_CONFIG[t.prioridad].color);
                  
                  return (
                    <div 
                      key={dia.iso} 
                      className={`d-flex flex-column align-items-center justify-content-start py-1 rounded-4 ${dia.isCurrentMonth ? '' : 'opacity-25'} ${isSelected ? 'bg-dark text-white' : ''}`}
                      style={{width: '14.28%', cursor: 'pointer', height: '48px'}}
                      onClick={() => setDiaSeleccionadoMobile(dia.iso)}
                    >
                      {dia.isToday && isSelected && <span style={{fontSize: '0.50rem', fontWeight: 800, marginTop: '-2px'}}>HOY</span>}
                      <span className={`fw-bold ${isSelected ? 'text-white' : dia.isToday ? 'text-success' : 'text-secondary'}`} style={{fontSize: '1rem', lineHeight: '1.2'}}>
                        {dia.diaNumero}
                      </span>
                      {/* Puntitos de turnos */}
                      {turnosDia.length > 0 && (
                        <div className="d-flex gap-1 mt-1 justify-content-center w-100">
                          {dots.map((color, i) => <div key={i} className={`rounded-circle bg-${color}`} style={{width: 5, height: 5}}></div>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
            <span className="fw-bold small text-dark">{totalTurnosMes} turnos/mes</span>
          </div>
        </div>

        {/* Header Lista del Día */}
        <div className="px-3 py-3 d-flex justify-content-between align-items-center bg-light">
          <div>
            <h6 className="fw-bold m-0 text-dark">Turnos del {diaSeleccionadoActivo.split('-')[2]} de {fechaReferencia.toLocaleDateString('es-AR', {month:'long'})}</h6>
            <span className="small text-secondary">Cuadrilla Norte & Centro</span>
          </div>
          <span className="badge bg-warning bg-opacity-25 text-dark border border-warning border-opacity-50 rounded-pill px-3 py-2">
            {(turnosAgrupados[diaSeleccionadoActivo] || []).length} turnos
          </span>
        </div>

        {/* Lista del Día */}
        <div className="px-3 pb-4 overflow-y-auto flex-grow-1">
          {(turnosAgrupados[diaSeleccionadoActivo] || []).length === 0 ? (
             <div className="text-center p-4 text-secondary small fw-medium opacity-50 border border-dashed rounded-3 bg-white">Día libre. Sin turnos.</div>
          ) : (
            (turnosAgrupados[diaSeleccionadoActivo] || []).map(turno => {
              const isEjecucion = turno.estado === 'EN_EJECUCION';
              const pConf = PRIORIDADES_CONFIG[turno.prioridad];
              
              return (
                <div key={turno.idTurno} className={`card mb-3 border shadow-sm rounded-4 overflow-hidden bg-white ${isEjecucion ? 'border-primary turno-en-curso-card' : 'border-light-subtle'}`} onClick={() => onSelectTurno(turno.idTurno)}>
                  <div className="row g-0 position-relative">
                    <div className={`position-absolute top-0 start-0 h-100 ${isEjecucion ? 'turno-en-curso-bg' : `bg-${pConf.color}`}`} style={{ width: '4px' }}></div>
                    <div className="col-12 p-3 ps-4">
                      
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold bg-light rounded-2 px-2 py-1 border">{turno.franjaHoraria.horaInicio} hs</span>
                          <h6 className="fw-bold m-0 text-dark fs-6">{turno.cliente.nombre}</h6>
                        </div>
                        <span className={`badge bg-${isEjecucion ? 'primary' : pConf.color}-subtle text-${isEjecucion ? 'primary' : pConf.color} border border-${isEjecucion ? 'primary' : pConf.color}-subtle rounded-pill px-2 py-1 fw-bold ${isEjecucion ? 'turno-en-curso-subtle' : ''}`} style={{fontSize: '0.65rem'}}>
                          <span className={`${isEjecucion ? 'turno-en-curso-bg' : `bg-${pConf.color}`} rounded-circle d-inline-block me-1`} style={{width: 6, height: 6}}></span>
                          {isEjecucion ? `${pConf.short} - En curso` : pConf.short.replace('P1', 'P1 Reasignado').replace('P2', 'P2 Fijo').replace('P3', 'P3 Casual')}
                        </span>
                      </div>

                      <div className="d-flex justify-content-between align-items-center">
                        <div className="small d-flex align-items-center gap-1 text-secondary">
                          <MapPin size={14}/> 
                          <span className="text-truncate">{turno.inmueble.direccion}</span>
                        </div>
                        <span className={`small fw-bold d-flex align-items-center gap-1 ${isEjecucion ? 'turno-en-curso-text' : 'text-warning'}`}>
                          {isEjecucion ? <span className="d-flex align-items-center gap-1"><span className="turno-en-curso-dot" /> En curso</span> : <span className="d-flex align-items-center gap-1"><div className="rounded-circle bg-warning" style={{width: 6, height: 6}}></div> Coordinado <ChevronRight size={14}/></span>}
                        </span>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================
          VISTA DESKTOP: Grilla Mensual
          ======================================================== */}
      <div className="d-none d-lg-flex flex-column h-100 w-100 bg-light border-top">
        
        {/* Header Días */}
        <div className="d-flex bg-white border-bottom shadow-sm z-1">
          {nombresDias.map(dia => (
            <div key={dia} className="flex-grow-1 text-center py-2 text-secondary small fw-bold" style={{ width: '14.28%' }}>
              {dia}
            </div>
          ))}
        </div>

        {/* Matriz 6 Semanas */}
        <div className="d-flex flex-column flex-grow-1 overflow-auto bg-light">
          {semanas.map((semana, wIdx) => (
            <div key={wIdx} className="d-flex flex-grow-1 w-100">
              {semana.map(dia => {
                const turnosDia = turnosAgrupados[dia.iso] || [];
                const turnosMostrados = turnosDia.slice(0, 3); // Límite visual de 3
                const desborde = turnosDia.length - 3;
                
                return (
                  <div 
                    key={dia.iso} 
                    className="border-end border-bottom d-flex flex-column p-1 position-relative" 
                    style={{ width: '14.28%', minHeight: '110px', backgroundColor: dia.isCurrentMonth ? '#ffffff' : '#f8f9fa' }}
                    onDoubleClick={() => onSwitchToDailyView(dia.iso)}
                  >
                    {/* Número de día */}
                    <div className="d-flex justify-content-end mb-1">
                      {dia.isToday ? (
                        <span className="badge bg-dark text-white rounded-pill px-2 py-1 shadow-sm mt-1 me-1">HOY {dia.diaNumero}</span>
                      ) : (
                        <span className={`small fw-bold pe-2 pt-1 ${dia.isCurrentMonth ? 'text-dark' : 'text-secondary opacity-50'}`}>{dia.diaNumero}</span>
                      )}
                    </div>

                    {/* Pastillas de Turno */}
                    <div className="d-flex flex-column gap-1 flex-grow-1 px-1">
                      {turnosMostrados.map(t => {
                        const isEjecucion = t.estado === 'EN_EJECUCION';
                        const conf = PRIORIDADES_CONFIG[t.prioridad];
                        const bg = isEjecucion ? 'bg-primary text-white' : `bg-${conf.color}-subtle text-${conf.color}`;
                        const border = isEjecucion ? 'border-primary' : `border-${conf.color}-subtle`;
                        
                        return (
                          <div 
                            key={t.idTurno} 
                            onClick={(e) => { e.stopPropagation(); onSelectTurno(t.idTurno); }}
                            className={`badge border ${bg} ${border} rounded-2 text-start p-1 px-2 d-flex align-items-center w-100 shadow-sm hover-opacity ${isEjecucion ? 'turno-en-curso-solid' : ''}`}
                            style={{ cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600 }}
                            title={`${t.franjaHoraria.horaInicio} ${t.cliente.nombre}`}
                          >
                            <span className="me-1 flex-shrink-0 d-flex align-items-center gap-1">
                              {isEjecucion ? <span className="turno-en-curso-dot turno-en-curso-dot--light" /> : '•'}
                              {t.franjaHoraria.horaInicio}
                            </span>
                            <span className="text-truncate flex-grow-1">{t.cliente.nombre.split(' ')[0]}</span>
                            <span className="ms-1 flex-shrink-0 opacity-75">[{conf.short}]</span>
                          </div>
                        );
                      })}
                      
                      {/* Indicador Desbordamiento */}
                      {desborde > 0 && (
                        <div 
                          className="text-secondary small fw-bold ps-1 mt-auto pb-1 hover-opacity" 
                          style={{fontSize: '0.70rem', cursor: 'pointer'}}
                          onClick={(e) => { e.stopPropagation(); onSwitchToDailyView(dia.iso); }}
                        >
                          +{desborde} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Leyendas (Desktop) */}
        <div className="bg-white border-top p-3 d-flex justify-content-between align-items-center mt-auto flex-shrink-0 shadow-sm z-1">
          <span className="text-secondary small">Turnos programados en el mes: <strong className="text-dark fs-6">{totalTurnosMes} turnos</strong></span>
        </div>
      </div>

    </Card>
  );
}
