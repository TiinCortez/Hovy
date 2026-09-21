import { useEffect, useState } from 'react';
import { Sun, CloudSun, Cloud, CloudRain, CloudLightning, Droplets, Wind, SunDim, AlertTriangle, Clock } from 'lucide-react';
import ClimaService from '../../services/api/clima.service';

export default function PanelClima() {
  const [clima, setClima] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [diaSeleccionado, setDiaSeleccionado] = useState(0);
  const [horaSeleccionada, setHoraSeleccionada] = useState(new Date().getHours());

  useEffect(() => {
    const fetchClima = async () => {
      try {
        const data = await ClimaService.getPronosticoOperativo();
        setClima(data);
      } catch (error) {
        console.error("Error al obtener el clima:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClima();
  }, []);

  const getWeatherInfo = (code, size = 20) => {
    if (code === 0) return { text: 'Soleado • Despejado', icon: <Sun className="text-warning" size={size} /> };
    if (code >= 1 && code <= 3) return { text: 'Parcialmente Nublado', icon: <CloudSun className="text-warning" size={size} /> };
    if (code >= 45 && code <= 48) return { text: 'Niebla', icon: <Cloud className="text-secondary" size={size} /> };
    if (code >= 51 && code <= 67) return { text: 'Lluvia', icon: <CloudRain className="text-primary" size={size} /> };
    if (code >= 80 && code <= 82) return { text: 'Chubascos', icon: <CloudRain className="text-primary" size={size} /> };
    if (code >= 95) return { text: 'Tormenta', icon: <CloudLightning className="text-danger" size={size} /> };
    return { text: 'Despejado', icon: <Sun className="text-warning" size={size} /> };
  };

  const formatUvText = (uv) => {
    if (uv <= 2) return `${uv} (Bajo)`;
    if (uv <= 5) return `${uv} (Mod.)`;
    if (uv <= 7) return `${uv} (Alto)`;
    if (uv <= 10) return `${uv} (Muy Alto)`;
    return `${uv} (Extremo)`;
  };

  const formatDayName = (dateString, index) => {
    const date = new Date(dateString + 'T00:00:00');
    const day = date.getDate();
    if (index === 0) {
      const month = date.toLocaleString('es-ES', { month: 'short' });
      return `Hoy ${day} ${month.charAt(0).toUpperCase() + month.slice(1)}`;
    }
    const dayName = date.toLocaleString('es-ES', { weekday: 'short' });
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${day}`;
  };

  if (loading) {
    return <div className="card border-0 shadow-sm rounded-4 p-3 text-center w-100">Cargando pronóstico...</div>;
  }

  if (!clima) {
    return (
      <div className="card border-0 shadow-sm rounded-4 p-3 text-center text-danger w-100">
        <AlertTriangle className="mx-auto mb-2" /> Error al cargar el clima.
      </div>
    );
  }

  const horaActual = new Date().getHours();
  const indexHoraExacta = (diaSeleccionado * 24) + horaSeleccionada;
  
  const tempPrincipal = Math.round(clima.hourly.temperature_2m[indexHoraExacta]);
  const tempSensacion = Math.round(clima.hourly.apparent_temperature[indexHoraExacta]);
  const probLluvia = clima.hourly.precipitation_probability[indexHoraExacta];
  const uvIndex = Math.round(clima.hourly.uv_index[indexHoraExacta]);
  const viento = Math.round(clima.hourly.wind_speed_10m[indexHoraExacta]);
  const weatherCode = clima.hourly.weather_code[indexHoraExacta];
  
  const weatherInfo = getWeatherInfo(weatherCode);

  return (
    <div 
      className="card border-1 shadow-sm p-3 d-flex flex-column gap-3 w-100 mx-auto" 
      style={{ 
        backgroundColor: '#fcfcfc', 
        borderColor: '#f0f0f0', 
        borderRadius: '1.25rem',
        overflow: 'hidden' // Evita físicamente que cualquier elemento interno sobresalga
      }}
    >
      
      {/* 1. CABECERA Y SELECTORES */}
      <div className="d-flex align-items-start justify-content-between border-bottom pb-2 gap-2" style={{ borderColor: '#f0f0f0' }}>
        
        {/* Lado Izquierdo */}
        <div className="d-flex align-items-center gap-2 flex-shrink-1" style={{ minWidth: 0 }}>
          <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '32px', height: '32px', backgroundColor: '#eef6ec', color: '#3d6135' }}>
            <Sun size={16} />
          </div>
          <div className="lh-1 text-truncate">
            <h2 className="m-0 fs-6 fw-bold text-truncate" style={{ color: '#093624' }}>Clima</h2>
            <span className="small text-secondary text-truncate d-block" style={{ fontSize: '0.7rem' }}>Córdoba Cap.</span>
          </div>
        </div>
        
        {/* Lado Derecho - Controles fluidos con límite de ancho */}
        <div className="d-flex flex-column align-items-end gap-1 flex-shrink-1" style={{ minWidth: 0, maxWidth: '135px', flex: '1 1 auto' }}>
          <div className="badge rounded-pill fw-medium px-2 py-1 text-dark text-truncate w-100 text-end text-center" style={{ backgroundColor: '#eef6ec', border: '1px solid #d4ebd0', fontSize: '0.75rem' }}>
            {formatDayName(clima.daily.time[diaSeleccionado], diaSeleccionado)}
          </div>
          
          <div className="d-flex align-items-center gap-1 bg-white rounded-pill pe-1 ps-1 shadow-sm w-100" style={{ border: '1px solid #eaeaea' }}>
            <Clock size={12} className="text-secondary ms-1 flex-shrink-0" />
            <select 
              className="form-select form-select-sm border-0 shadow-none fw-medium text-dark bg-transparent px-1 py-0 text-truncate"
              style={{ width: '100%', minWidth: 0, cursor: 'pointer', fontSize: '0.75rem' }}
              value={horaSeleccionada}
              onChange={(e) => setHoraSeleccionada(Number(e.target.value))}
            >
              {[...Array(24)].map((_, i) => (
                <option key={i} value={i}>
                  {i.toString().padStart(2, '0')}:00 {diaSeleccionado === 0 && i === horaActual ? '(Ahora)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. TEMPERATURA EXACTA */}
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div className="flex-shrink-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-start" style={{ color: '#093624' }}>
            <span style={{ fontSize: '3rem', fontWeight: '800', lineHeight: '1' }}>{tempPrincipal}°</span>
            <span className="fs-5 fw-bold mt-1">C</span>
          </div>
          <div className="d-flex align-items-center gap-1 mt-1 fw-medium text-dark text-truncate" style={{ fontSize: '0.8rem' }}>
            <span className="flex-shrink-0">{weatherInfo.icon}</span> 
            <span className="text-truncate">{weatherInfo.text.split('•')[0]}</span>
          </div>
        </div>
        <div className="text-end flex-shrink-0">
          <span className="text-secondary small d-block mb-0 text-truncate" style={{ fontSize: '0.75rem' }}>Sensación</span>
          <span className="fs-4 fw-bold" style={{ color: '#093624' }}>{tempSensacion}°C</span>
        </div>
      </div>

      {/* 3. MÉTRICAS */}
      <div className="row g-1 mt-0">
        <div className="col-4">
          <div className="p-1 py-2 text-center rounded-3 border h-100 d-flex flex-column justify-content-center overflow-hidden" style={{ backgroundColor: '#faf9f6', borderColor: '#eaeaea' }}>
            <Droplets size={14} className="text-primary mx-auto mb-1 flex-shrink-0" />
            <span className="d-block text-secondary mb-1 text-truncate w-100" style={{ fontSize: '0.6rem' }}>Lluvia</span>
            <strong className="d-block text-truncate w-100" style={{ color: '#093624', fontSize: '0.8rem' }}>{probLluvia}%</strong>
          </div>
        </div>
        <div className="col-4">
          <div className="p-1 py-2 text-center rounded-3 border h-100 d-flex flex-column justify-content-center overflow-hidden" style={{ backgroundColor: '#faf9f6', borderColor: '#eaeaea' }}>
            <SunDim size={14} className="text-warning mx-auto mb-1 flex-shrink-0" />
            <span className="d-block text-secondary mb-1 text-truncate w-100" style={{ fontSize: '0.6rem' }}>Índice UV</span>
            <strong className="d-block text-truncate w-100" style={{ color: '#d97706', fontSize: '0.8rem' }}>{formatUvText(uvIndex)}</strong>
          </div>
        </div>
        <div className="col-4">
          <div className="p-1 py-2 text-center rounded-3 border h-100 d-flex flex-column justify-content-center overflow-hidden" style={{ backgroundColor: '#faf9f6', borderColor: '#eaeaea' }}>
            <Wind size={14} className="text-success mx-auto mb-1 flex-shrink-0" />
            <span className="d-block text-secondary mb-1 text-truncate w-100" style={{ fontSize: '0.6rem' }}>Viento</span>
            <strong className="d-block text-truncate w-100" style={{ color: '#093624', fontSize: '0.8rem' }}>{viento} km/h</strong>
          </div>
        </div>
      </div>

      {/* 4. SELECTOR DE PRÓXIMOS DÍAS */}
      <div className="mt-0">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <strong className="text-secondary text-truncate" style={{ letterSpacing: '0.5px', fontSize: '0.7rem' }}>PRÓXIMOS DÍAS</strong>
          <span className="text-secondary text-truncate ms-2" style={{ fontSize: '0.7rem' }}>Máximas</span>
        </div>
        
        {/* flex: '1 1 0' garantiza que se dividan el espacio exactamente igual y no se desborden */}
        <div className="d-flex p-1 rounded-4 justify-content-between w-100 gap-1" style={{ backgroundColor: '#f5f4ef' }}>
          {clima.daily.time.slice(0, 5).map((date, index) => {
            const isSelected = diaSeleccionado === index;
            const dayWeather = getWeatherInfo(clima.daily.weather_code[index], 16); 
            
            return (
              <div 
                key={date}
                onClick={() => setDiaSeleccionado(index)}
                className={`d-flex flex-column align-items-center justify-content-center p-1 rounded-3 text-center overflow-hidden ${isSelected ? 'bg-white shadow-sm' : ''}`}
                style={{ cursor: 'pointer', flex: '1 1 0', minWidth: 0, transition: 'all 0.2s', border: isSelected ? '1px solid #eaeaea' : '1px solid transparent' }}
              >
                <span className={`fw-medium mb-1 text-truncate w-100 ${isSelected ? 'text-dark' : 'text-secondary'}`} style={{ fontSize: '0.7rem' }}>
                  {formatDayName(date, index).split(' ')[0]}
                </span>
                <div className="mb-1 flex-shrink-0">{dayWeather.icon}</div>
                <strong className="text-truncate w-100" style={{ color: isSelected ? '#093624' : '#6c757d', fontSize: '0.85rem' }}>
                  {Math.round(clima.daily.temperature_2m_max[index])}°
                </strong>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}