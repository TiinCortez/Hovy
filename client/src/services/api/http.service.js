import axios from 'axios';

// Configuración base de Axios siguiendo el patrón de interceptores para manejo global
const httpService = axios.create({
  // Si tienes un backend propio aparte de Supabase, define la URL aquí.
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de Peticiones (Request)
httpService.interceptors.request.use(
  (request) => {
    // Aquí puedes integrar lógica para bloquear la pantalla o mostrar un spinner global
    
    // Inyectamos el token de autorización si existe en la sesión
    const accessToken = sessionStorage.getItem('accessToken');
    if (accessToken) {
      request.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return request;
  },
  (error) => {
    console.error('Error en la petición (request):', error);
    return Promise.reject(error);
  }
);

// Interceptor de Respuestas (Response)
httpService.interceptors.response.use(
  (response) => {
    // Aquí puedes ocultar el spinner global o desbloquear la pantalla
    return response;
  },
  (error) => {
    // Manejo centralizado de errores HTTP
    if (error.response) {
      if (error.response.status === 401) {
        console.error('No autenticado: La sesión ha expirado o no es válida.');
        // Aquí luego conectaremos el deslogueo automático o redirección al /login
      } else if (error.response.status === 403) {
        console.error('No autorizado: No tienes permisos para acceder a esta funcionalidad.');
      } else {
        console.error(error.response.data?.message || 'Inconvenientes en el servidor. Intente más tarde.');
      }
    } else {
      console.error('Error de red: El servidor no responde.');
    }
    
    return Promise.reject(error);
  }
);

export default httpService;