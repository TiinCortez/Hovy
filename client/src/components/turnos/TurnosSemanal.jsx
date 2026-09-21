import { useState, useEffect } from 'react';
import { MapPin, ChevronRight, Clock } from 'lucide-react';
import Card from '../ui/Card';

export default function TurnosSemanal({ turnos, fechaReferencia, onSelectTurno, onCreateTurno }) {
  const [horaActualDecimal, setHoraActualDecimal] = useState(null);
  const [diaSeleccionadoMobile, setDiaSeleccionadoMobile] = useState('');

  // Parámetros de la grilla temporal
  const HORA_INICIO = 8;
  const HORA_FIN = 19;
  const ALTURA_HORA_PX = 100;

  // Configuración estandarizada (Heredada del Kanban)
  const prioridadesConfig = {
    'P1_REASIGNADO': { label: 'P1 Reasignado', short: 'P1 - REASIGNADO', color: 'danger', weight: 3 },
    'P2_FIJO': { label: 'P2 Fijo', short: 'P2 - FIJO', color: 'success', weight: 2 },
    'P3_CASUAL': { label: 'P3 Casual', short: 'P3 - CASUAL', color: 'secondary', weight: 1 }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date(2026, 9, 24, 14, 45); // Mock de hora actual
      setHoraActualDecimal(now.getHours() + now.getMinutes() / 60);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const obtenerDiasSemana = (fecha) => {
    const curr = new Date(fecha);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); 
    const startOfWeek = new Date(curr.setDate(diff));

    const dias = [];
    const nombres = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const hoyStr = new Date(2026, 9, 24).toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const isoStr = d.toISOString().split('T')[0];
      
      dias.push({
        iso: isoStr,
        nombre: nombres[d.getDay()],
        diaNumero: d.getDate(),
        isToday: isoStr === hoyStr,
        turnosCount: turnos.filter(t => t.fechaAsignada === isoStr && t.estado !== 'CANCELADO').length
      });
    }
    return dias;
  };

  const dias = obtenerDiasSemana(fechaReferencia);

  const diaSeleccionadoActivo = dias.some((dia) => dia.iso === diaSeleccionadoMobile)
    ? diaSeleccionadoMobile
    : (dias.find((dia) => dia.isToday)?.iso || dias[0].iso);

  const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':');
    return parseInt(h, 10) + parseInt(m, 10) / 60;
  };

  const formatTime = (dec) => {
    const h = Math.floor(dec);
    const m = Math.round((dec - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const procesarTurnosDia = (diaIso) => {
    return turnos.filter(t => {
      if (t.estado === 'CANCELADO' || t.fechaAsignada !== diaIso) return false;
      return true;
    }).sort((a, b) => parseTime(a.franjaHoraria.horaInicio) - parseTime(b.franjaHoraria.horaInicio));
  };

  const procesarBloquesGrid = (diaObj) => {
    const turnosDelDia = procesarTurnosDia(diaObj.iso);
    const bloques = [];
    let tiempoActual = HORA_INICIO;

    turnosDelDia.forEach(turno => {
      const start = parseTime(turno.franjaHoraria.horaInicio);
      const end = parseTime(turno.franjaHoraria.horaFin);
      if (start > tiempoActual) bloques.push({ isHueco: true, start: tiempoActual, end: start });
      bloques.push({ isHueco: false, data: turno, start, end });
      tiempoActual = Math.max(tiempoActual, end);
    });

    if (tiempoActual < HORA_FIN) bloques.push({ isHueco: true, start: tiempoActual, end: HORA_FIN });
    return bloques;
  };

  const horasGrid = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);

  return (
    <Card className="turnos-calendar-card p-0 shadow-sm border-0 rounded-4 bg-white overflow-hidden flex-shrink-0">
      
      {/* VISTA MOBILE: Lista Vertical */}
      <div className="d-flex d-lg-none flex-column w-100 bg-light bg-opacity-50">
        
        {/* Selector de Días Horizontales */}
        <div className="d-flex overflow-x-auto border-bottom bg-white shadow-sm scrollbar-none py-2 px-1">
          {dias.map(dia => {
            const isSelected = dia.iso === diaSeleccionadoActivo;
            return (
              <div 
                key={dia.iso} 
                className={`d-flex flex-column align-items-center justify-content-center px-3 py-2 mx-1 rounded-4 flex-shrink-0 ${isSelected ? 'bg-dark text-white shadow-sm' : 'text-secondary hover-opacity'}`}
                style={{ cursor: 'pointer', minWidth: '70px' }}
                onClick={() => setDiaSeleccionadoMobile(dia.iso)}
              >
                <span className="fw-bold" style={{ fontSize: '0.70rem' }}>{dia.nombre}</span>
                <span className={`fs-5 fw-bold ${isSelected ? 'text-white' : 'text-dark'}`}>{dia.diaNumero}</span>
                {dia.isToday ? (
                  <span className={`badge mt-1 rounded-pill ${isSelected ? 'bg-success text-white' : 'bg-warning text-dark'}`} style={{fontSize: '0.60rem'}}>HOY</span>
                ) : (
                  <span className={`rounded-circle mt-1 ${dia.turnosCount > 0 ? 'bg-success' : 'bg-transparent'}`} style={{width: 6, height: 6}}></span>
                )}
              </div>
            );
          })}
        </div>

        {/* Lista de Turnos (Tarjetas estilo Kanban) */}
        <div className="p-3">
          {procesarTurnosDia(diaSeleccionadoActivo).length === 0 ? (
             <div className="text-center p-4 text-secondary small fw-medium opacity-50 border border-dashed rounded-3 bg-white">No hay turnos para este día.</div>
          ) : (
            procesarTurnosDia(diaSeleccionadoActivo).map(turno => {
              const isEjecucion = turno.estado === 'EN_EJECUCION';
              const pConf = prioridadesConfig[turno.prioridad];
              
              return (
                <div key={turno.idTurno} className="d-flex align-items-stretch mb-3 gap-2" onClick={() => onSelectTurno(turno.idTurno)}>
                  
                  {/* Hora */}
                  <div className="d-flex flex-column align-items-end justify-content-start pt-2 pe-2 text-end flex-shrink-0" style={{ width: '60px' }}>
                    <span className={`fw-bold ${isEjecucion ? 'turno-en-curso-text' : 'text-dark'}`} style={{ fontSize: '0.90rem' }}>{turno.franjaHoraria.horaInicio}</span>
                    <span className="text-secondary small">{turno.franjaHoraria.horaFin}</span>
                    {isEjecucion && <span className="badge turno-en-curso-solid rounded-pill px-2 mt-1" style={{ fontSize: '0.60rem' }}>AHORA</span>}
                  </div>

                  {/* Tarjeta */}
                  <div className={`card flex-grow-1 border shadow-sm rounded-4 overflow-hidden bg-white ${isEjecucion ? 'border-primary turno-en-curso-card' : 'border-light-subtle'}`}>
                    <div className="row g-0 h-100 position-relative">
                      <div className={`position-absolute top-0 start-0 h-100 ${isEjecucion ? 'turno-en-curso-bg' : `bg-${pConf.color}`}`} style={{ width: '4px' }}></div>
                      <div className="col-12 p-3 ps-4 d-flex flex-column">
                        
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                          <span className={`badge bg-${isEjecucion ? 'primary' : pConf.color}-subtle text-${isEjecucion ? 'primary' : pConf.color} border border-${isEjecucion ? 'primary' : pConf.color}-subtle rounded-pill px-2 py-1 fw-bold ${isEjecucion ? 'turno-en-curso-subtle' : ''}`} style={{fontSize: '0.65rem'}}>
                            {isEjecucion ? `${pConf.short.split(' ')[0]} - EN CURSO` : pConf.short.replace('P1 ', '').replace('P2 ', '').replace('P3 ', '')}
                          </span>
                          <span className={`badge rounded-pill border ${isEjecucion ? 'turno-en-curso-solid' : 'bg-white text-secondary border-light-subtle'}`} style={{fontSize: '0.65rem'}}>
                            {isEjecucion && <span className="turno-en-curso-dot turno-en-curso-dot--light me-1" />}
                            {isEjecucion ? 'EN CURSO' : turno.estado.replace('_', ' ')}
                          </span>
                        </div>

                        <h6 className="fw-bold m-0 mb-1 fs-6 text-dark">{turno.cliente.nombre}</h6>
                        <div className="small d-flex align-items-start gap-1 mb-2 text-secondary">
                          <MapPin size={14} className="mt-1 flex-shrink-0"/> 
                          <span className="text-truncate">{turno.inmueble.direccion}</span>
                        </div>

                        <hr className="my-0 mb-2 opacity-10" />

                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-end gap-2 mt-auto">
                          <div className={`small fw-medium w-100 text-break ${isEjecucion ? 'turno-en-curso-text' : 'text-secondary'}`}>
                            {isEjecucion ? <span className="d-flex align-items-center gap-1"><Clock size={12}/> Cuadrilla: Carlos & Lucas</span> : turno.servicio.descripcion}
                          </div>
                          <span className={`small fw-bold text-nowrap d-flex align-items-center gap-1 align-self-end flex-shrink-0 ${isEjecucion ? 'turno-en-curso-text' : 'text-dark'}`}>
                            Detalles <ChevronRight size={14} />
                          </span>
                        </div>

                      </div>
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. VISTA DESKTOP: Grilla Absoluta */}
      <div className="turnos-week-grid d-none d-lg-flex flex-column w-100 bg-light bg-opacity-50" style={{ minWidth: '950px' }}>
        
        {/* Header de Días */}
        <div className="d-flex border-bottom text-center bg-white sticky-top z-3 shadow-sm">
          <div className="d-flex align-items-center justify-content-center text-secondary small fw-bold border-end" style={{ width: '70px', minWidth: '70px' }}>
            Horario
          </div>
          {dias.map(dia => (
            <div key={dia.iso} className="flex-grow-1 border-end py-2 px-1" style={{ flexBasis: 0 }}>
              <div className="d-flex align-items-center justify-content-center gap-2">
                {dia.isToday && <span className="badge bg-dark text-white rounded-pill px-2" style={{fontSize: '0.65rem'}}>HOY</span>}
                <span className={`fw-bold ${dia.isToday ? 'text-success' : 'text-secondary'}`}>
                  {dia.nombre} {dia.diaNumero}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Cuerpo del Calendario */}
        <div className="d-flex position-relative bg-white" style={{ height: `${(HORA_FIN - HORA_INICIO) * ALTURA_HORA_PX}px` }}>
          
          {/* Eje Horario */}
          <div className="border-end d-flex flex-column position-relative bg-white z-2" style={{ width: '70px', minWidth: '70px' }}>
            {horasGrid.map(hora => (
              <div
                key={hora}
                className="text-center text-secondary small fw-bold position-absolute w-100"
                style={{
                  top: `${(hora - HORA_INICIO) * ALTURA_HORA_PX}px`,
                  marginTop: hora === HORA_INICIO ? '0' : hora === HORA_FIN ? '-20px' : '-10px'
                }}
              >
                {hora.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Líneas Horizontales */}
          <div className="position-absolute h-100 pointer-events-none" style={{ left: '70px', right: 0, zIndex: 0 }}>
            {horasGrid.map(hora => (
              <div key={`line-${hora}`} className="border-top border-light-subtle w-100 position-absolute" style={{ top: `${(hora - HORA_INICIO) * ALTURA_HORA_PX}px` }}></div>
            ))}
          </div>

          {/* Columnas por Día */}
          <div className="d-flex flex-grow-1 position-relative" style={{ zIndex: 1 }}>
            {dias.map(dia => {
              const bloques = procesarBloquesGrid(dia);
              const isHoy = dia.isToday;

              return (
                <div key={dia.iso} className="flex-grow-1 position-relative border-end" style={{ flexBasis: 0 }}>
                  
                  {/* Línea HOY */}
                  {isHoy && horaActualDecimal >= HORA_INICIO && horaActualDecimal <= HORA_FIN && (
                    <div className="position-absolute w-100" style={{ top: `${(horaActualDecimal - HORA_INICIO) * ALTURA_HORA_PX}px`, zIndex: 10 }}>
                      <div className="bg-primary position-absolute rounded-circle" style={{ width: 8, height: 8, left: -4, top: -3 }}></div>
                      <div className="bg-primary opacity-75" style={{ height: 2, width: '100%' }}></div>
                    </div>
                  )}

                  {/* Bloques */}
                  {bloques.map((b, idx) => {
                    const topPx = (b.start - HORA_INICIO) * ALTURA_HORA_PX;
                    const heightPx = (b.end - b.start) * ALTURA_HORA_PX;

                    if (b.isHueco) {
                      return (
                        <div key={`hueco-${idx}`} className="position-absolute w-100 p-1" style={{ top: `${topPx}px`, height: `${heightPx}px` }}>
                          <div 
                            className="h-100 w-100 rounded-3 d-flex align-items-center justify-content-center text-secondary opacity-50 border border-dashed hover-opacity bg-light"
                            style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                            onClick={() => onCreateTurno({ fecha: dia.iso, horaInicio: formatTime(b.start) })}
                          >
                            Hueco disponible
                          </div>
                        </div>
                      );
                    }

                    const turno = b.data;
                    const isEjecucion = turno.estado === 'EN_EJECUCION';
                    const config = prioridadesConfig[turno.prioridad];

                    return (
                      <div key={`turno-${turno.idTurno}`} className="position-absolute w-100 p-1" style={{ top: `${topPx}px`, height: `${heightPx}px` }}>
                        <div 
                          className={`h-100 w-100 rounded-3 border d-flex flex-column p-2 overflow-hidden shadow-sm hover-opacity bg-white border-${isEjecucion ? 'primary' : config.color}-subtle ${isEjecucion ? 'turno-en-curso-card' : ''}`}
                          style={{ cursor: 'pointer', borderLeft: `4px solid var(--bs-${isEjecucion ? 'primary' : config.color})` }}
                          onClick={() => onSelectTurno(turno.idTurno)}
                        >
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <span className="fw-bold text-dark" style={{ fontSize: '0.70rem' }}>
                              {turno.franjaHoraria.horaInicio} - {turno.franjaHoraria.horaFin}
                            </span>
                            <span className={`badge bg-${isEjecucion ? 'primary' : config.color}-subtle text-${isEjecucion ? 'primary' : config.color} border border-${isEjecucion ? 'primary' : config.color}-subtle rounded-1 px-1 fw-bold ${isEjecucion ? 'turno-en-curso-subtle' : ''}`} style={{ fontSize: '0.60rem' }}>
                              {isEjecucion && <span className="turno-en-curso-dot me-1" />}
                              {isEjecucion ? `${config.short.split(' ')[0]} - EN CURSO` : config.short}
                            </span>
                          </div>
                          
                          <div className="flex-grow-1 overflow-hidden d-flex flex-column mt-1">
                            <span className="fw-bold text-truncate text-dark" style={{ fontSize: '0.80rem' }}>{turno.cliente.nombre}</span>
                            <span className={`small text-truncate ${isEjecucion ? 'turno-en-curso-text' : 'text-secondary'}`} style={{ fontSize: '0.70rem' }}>{turno.inmueble.direccion}</span>
                          </div>

                          <div className="mt-auto pt-1 d-flex justify-content-end">
                            <span className={`badge rounded-pill fw-medium border ${isEjecucion ? 'turno-en-curso-solid' : 'bg-white text-secondary border-light-subtle'}`} style={{ fontSize: '0.65rem' }}>
                              {isEjecucion ? 'EN CURSO' : turno.estado.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </Card>
  );
}
