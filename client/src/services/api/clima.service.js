import axios from 'axios';

const ClimaService = {
  getPronosticoOperativo: async (lat = -24.2335, lon = -65.2613) => {
    // Pedimos TODAS las métricas detalladas por hora
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max&timezone=auto`;
    
    const response = await axios.get(url);
    return response.data;
  }
};

export default ClimaService;