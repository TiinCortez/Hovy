import httpService from './api/http.service.js';

// Calculamos la URL base correcta para el auth (quitando el /api si existe)
// porque el backend expone la ruta directo en /auth
const getAuthUrl = (endpoint) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const cleanUrl = baseUrl.replace(/\/api$/, '');
  return `${cleanUrl}/auth${endpoint}`;
};

const login = async (email, password, navigateToComponent) => {
  try {
    // Hacemos el POST al endpoint del backend
    const response = await httpService.post(getAuthUrl('/login'), { email, password });

    // El backend devuelve { ok: true, token: "...", user: {...} }
    if (response.data.ok && response.data.token) {
      // Guardamos el token donde http.service.js espera encontrarlo
      sessionStorage.setItem('accessToken', response.data.token);
      
      // Opcional: guardamos los datos del usuario por si los necesitás en la UI
      sessionStorage.setItem('user', JSON.stringify(response.data.user));

      navigateToComponent();
    }
  } catch (error) {
    console.error('Error de autenticación:', error);
    
    // http.service.js ya captura errores, extraemos el mensaje real del backend
    const errorMessage = error.response?.data?.error || 'Usuario o clave incorrectos';
    throw new Error(errorMessage, { cause: error });
  }
};

const logout = (navigateToHome) => {
  // Destruimos la sesión local
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('user');

  if (navigateToHome) {
    navigateToHome();
  }
};

const getSession = () => {
  // Ya no usamos promesas de Supabase, leemos localmente
  const token = sessionStorage.getItem('accessToken');
  const user = sessionStorage.getItem('user');
  return token ? { token, user: JSON.parse(user) } : null;
};

const AuthService = {
  login,
  logout,
  getSession,
};

export default AuthService;