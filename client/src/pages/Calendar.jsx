import { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  MoreVertical, 
  Sun, 
  Wind, 
  Droplets, 
  CloudRain, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';

export default function Calendar() {
  // Estado para la API del clima
  const [weatherData, setWeatherData] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  // Estados para la agenda
  const [selectedDate, setSelectedDate] = useState(new Date('2026-09-14'));

  // Simulación de llamada a la API del Clima
  useEffect(() => {
    const fetchWeather = async () => {
      setIsLoadingWeather(true);
      try {
        // Aquí reemplazarías con tu fetch real a la API (ej: OpenWeatherMap)
        // const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Cordoba,AR&appid=TU_API_KEY&units=metric`);
        // const data = await response.json();
        
        // Mock simulando la respuesta de la API basándonos en tu diseño original
        setTimeout(() => {
          setWeatherData({
            temp: 24,
            condition: "Soleado",
            feelsLike: 25,
            wind: 12,
            humidity: 48,
            rainChance: 10,
            forecast: [
              { day: 'Mañana', tempMax: 26, tempMin: 14, icon: <Sun size={20} className="text-warning" /> },
              { day: 'Jueves', tempMax: 22, tempMin: 13, icon: <CloudRain size={20} className="text-info" /> },
              { day: 'Viernes', tempMax: 25, tempMin: 15, icon: <Sun size={20} className="text-warning" /> },
              { day: 'Sábado', tempMax: 27, tempMin: 16, icon: <Sun size={20} className="text-warning" /> },
            ]
          });
          setIsLoadingWeather(false);
        }, 1000);
      } catch (error) {
        console.error("Error al cargar el clima", error);
        setIsLoadingWeather(false);
      }
    };

    fetchWeather();
  }, []);

  // Mock de Turnos para la Agenda
  const turnosHoy = [
    { id: 1, cliente: "Residencia Silva", servicio: "Mantenimiento", horario: "09:00 - 11:30 hs", direccion: "Av. Hipólito Yrigoyen 325", estado: "En Curso" },
    { id: 2, cliente: "Country Los Olivos", servicio: "Diseño Paisajístico", horario: "14:00 - 16:00 hs", direccion: "Lote 4B", estado: "Pendiente" }
  ];

  // Días de la semana para el selector (Strips)
  const days = [
    { code: 'LUN', number: '14', fullDate: '2026-09-14' },
    { code: 'MAR', number: '15', fullDate: '2026-09-15' },
    { code: 'MIE', number: '16', fullDate: '2026-09-16' },
    { code: 'JUE', number: '17', fullDate: '2026-09-17' },
    { code: 'VIE', number: '18', fullDate: '2026-09-18' },
  ];

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      
      {/* HEADER DE LA PÁGINA */}
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
        <div>
          <h2 className="fw-bold fs-2 text-dark m-0">Agenda Semanal</h2>
          <p className="text-secondary small m-0">Gestiona tus turnos operativos y visualiza las condiciones climáticas.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button variant="outline-primary" className="btn-sm text-nowrap rounded-3 bg-white shadow-sm border-light-subtle text-dark fw-medium px-3 py-2">
            <CalendarIcon size={16} /> Sincronizar Calendario
          </Button>
        </div>
      </div>

      <div className="row g-4">
        
        {/* COLUMNA IZQUIERDA: CALENDARIO Y CLIMA (Se adapta en Mobile) */}
        <div className="col-12 col-lg-4 d-flex flex-column gap-4 order-2 order-lg-1">
          
          {/* WIDGET DEL CLIMA (API Integrada) */}
          <Card className="h-100 p-0 overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #ffffff, #f4f7f2)', borderColor: '#d6e5d2' }}>
            <div className="p-4">
              <div className="d-flex items-center justify-content-between mb-3 pb-2 border-bottom border-light">
                <div className="d-flex align-items-center gap-2">
                  <Sun size={20} className="text-warning fill-warning" />
                  <h6 className="fw-bold text-uppercase m-0" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Condiciones del Clima</h6>
                </div>
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">Óptimo exteriores</span>
              </div>

              {isLoadingWeather ? (
                <div className="text-center py-4"><div className="spinner-border text-success" role="status"></div></div>
              ) : weatherData ? (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <div className="d-flex align-items-baseline gap-1">
                        <span className="fw-bolder text-dark" style={{ fontSize: '2.5rem', letterSpacing: '-0.02em' }}>{weatherData.temp}°</span>
                        <span className="fw-semibold text-secondary">{weatherData.condition}</span>
                      </div>
                      <p className="text-secondary small m-0">Córdoba Capital • Sensación {weatherData.feelsLike}°C</p>
                    </div>
                    
                    <div className="d-flex gap-3 text-end">
                      <div>
                        <Wind size={14} className="text-secondary d-block mx-auto mb-1" />
                        <span className="fw-bold text-dark d-block" style={{ fontSize: '0.75rem' }}>{weatherData.wind} <span className="fw-normal text-secondary">km/h</span></span>
                      </div>
                      <div>
                        <Droplets size={14} className="text-info d-block mx-auto mb-1" />
                        <span className="fw-bold text-dark d-block" style={{ fontSize: '0.75rem' }}>{weatherData.humidity}%</span>
                      </div>
                      <div>
                        <CloudRain size={14} className="text-primary d-block mx-auto mb-1" />
                        <span className="fw-bold text-dark d-block" style={{ fontSize: '0.75rem' }}>{weatherData.rainChance}%</span>
                      </div>
                    </div>
                  </div>

                  {/* PRONÓSTICO SEMANAL */}
                  <div className="pt-3 border-top border-light">
                    <p className="text-secondary fw-bold text-uppercase mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Pronóstico Semanal</p>
                    <div className="d-flex justify-content-between gap-2 text-center">
                      {weatherData.forecast.map((day, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-3 border flex-grow-1 shadow-sm d-flex flex-column align-items-center">
                          <span className="text-secondary fw-semibold mb-1" style={{ fontSize: '0.65rem' }}>{day.day}</span>
                          {day.icon}
                          <span className="fw-bold text-dark mt-1" style={{ fontSize: '0.75rem' }}>{day.tempMax}° <span className="text-secondary fw-normal">{day.tempMin}°</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </Card>
        </div>

        {/* COLUMNA DERECHA: AGENDA Y TURNOS */}
        <div className="col-12 col-lg-8 order-1 order-lg-2">
          <Card className="h-100">
            
            {/* SELECTOR DE DÍAS (Strips Verticales) */}
            <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
              <button className="btn btn-sm btn-light rounded-circle p-2 text-secondary shadow-sm"><ChevronLeft size={20}/></button>
              
              <div className="d-flex gap-2 gap-md-3 overflow-x-auto scrollbar-none px-2">
                {days.map((day) => {
                  const isActive = day.fullDate === selectedDate.toISOString().split('T')[0];
                  return (
                    <button 
                      key={day.code}
                      onClick={() => setSelectedDate(new Date(day.fullDate))}
                      className={`btn d-flex flex-column align-items-center justify-content-center rounded-4 py-2 px-3 transition-all ${isActive ? 'shadow' : 'border shadow-sm'}`}
                      style={{ 
                        minWidth: '65px',
                        backgroundColor: isActive ? '#2d4a27' : '#ffffff',
                        color: isActive ? '#ffffff' : '#5F695D',
                        borderColor: isActive ? '#2d4a27' : '#EAE6DF'
                      }}
                    >
                      <span className="fw-bold" style={{ fontSize: '0.70rem', letterSpacing: '0.05em' }}>{day.code}</span>
                      <span className="fw-bolder fs-5">{day.number}</span>
                    </button>
                  )
                })}
              </div>

              <button className="btn btn-sm btn-light rounded-circle p-2 text-secondary shadow-sm"><ChevronRight size={20}/></button>
            </div>

            {/* LISTADO DE TURNOS DEL DÍA */}
            <div className="d-flex flex-column gap-3">
              <h5 className="fw-bold text-dark m-0 fs-5 mb-2">Turnos Programados</h5>
              
              {turnosHoy.length > 0 ? turnosHoy.map(turno => (
                <div key={turno.id} className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between p-3 rounded-4 border bg-white shadow-sm gap-3">
                  <div className="d-flex align-items-center gap-3 w-100">
                    <div className="p-3 rounded-4 d-flex flex-column align-items-center justify-content-center text-white flex-shrink-0" style={{ backgroundColor: '#2d4a27', minWidth: '80px' }}>
                      <Clock size={20} className="mb-1"/>
                      <span className="fw-bold text-center" style={{ fontSize: '0.70rem' }}>{turno.horario.split(' ')[0]}</span>
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <h6 className="fw-bold text-dark m-0">{turno.cliente}</h6>
                        <span className={`badge rounded-pill px-2 py-1 border ${turno.estado === 'En Curso' ? 'bg-success-subtle text-success border-success-subtle' : 'bg-light text-secondary border-light-subtle'}`} style={{ fontSize: '0.65rem' }}>
                          {turno.estado}
                        </span>
                      </div>
                      <p className="text-secondary small m-0 fw-medium d-flex align-items-center gap-1"><MapPin size={14}/> {turno.direccion}</p>
                      <p className="text-muted small m-0 mt-1">Servicio: {turno.servicio}</p>
                    </div>
                  </div>
                  
                  <div className="w-100 w-md-auto d-flex justify-content-end mt-2 mt-md-0 border-top border-md-0 pt-2 pt-md-0">
                    <Button variant="outline-primary" className="btn-sm bg-white border text-dark fw-semibold w-100 px-4 py-2">
                      Ver Detalle
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="text-center p-5 bg-light rounded-4 border">
                  <p className="text-secondary m-0">No hay turnos programados para este día.</p>
                </div>
              )}
            </div>

          </Card>
        </div>
      </div>
    </div>
  );
}