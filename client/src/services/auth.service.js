import httpService from './api/http.service.js';

// Calculamos la URL base correcta para el auth (quitando el /api si existe)
// porque el backend expone la ruta directo en /auth
const getAuthUrl = (endpoint) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const cleanUrl = baseUrl.replace(/\/api$/, '');
  return `${cleanUrl}/auth${endpoint}`;
};

const guardarSesion = (data) => {
  sessionStorage.setItem('accessToken', data.token);
  sessionStorage.setItem('user', JSON.stringify(data.user));
};

const extraerError = (error, fallback) => {
  const err = new Error(error.response?.data?.error || fallback, { cause: error });
  if (error.response?.data?.requiereCambioPassword) {
    err.requiereCambioPassword = true;
  }
  return err;
};

const login = async (email, password, navigateToComponent) => {
  try {
    const response = await httpService.post(getAuthUrl('/login'), { email, password });

    if (response.data.ok && response.data.token) {
      guardarSesion(response.data);
      navigateToComponent();
    }
  } catch (error) {
    console.error('Error de autenticación:', error);
    throw extraerError(error, 'Usuario o clave incorrectos');
  }
};

const cambiarPasswordInicial = async ({ email, passwordTemporal, nuevaPassword }, navigateToComponent) => {
  try {
    const response = await httpService.post(getAuthUrl('/cambiar-password-inicial'), {
      email,
      passwordTemporal,
      nuevaPassword,
    });

    if (response.data.ok && response.data.token) {
      guardarSesion(response.data);
      navigateToComponent();
    }
    return response.data;
  } catch (error) {
    throw extraerError(error, 'No se pudo actualizar la contraseña');
  }
};

const solicitarCodigoRecuperacion = async (email) => {
  try {
    const response = await httpService.post(getAuthUrl('/olvide-password'), { email });
    return response.data;
  } catch (error) {
    throw extraerError(error, 'No se pudo enviar el código de recuperación');
  }
};

const reenviarCodigoRecuperacion = async (email) => {
  try {
    const response = await httpService.post(getAuthUrl('/reenviar-codigo'), {
      email,
      tipo: 'recuperacion_password',
    });
    return response.data;
  } catch (error) {
    throw extraerError(error, 'No se pudo reenviar el código');
  }
};

const restablecerPassword = async ({ email, codigo, nuevaPassword }) => {
  try {
    const response = await httpService.post(getAuthUrl('/restablecer-password'), {
      email,
      codigo,
      nuevaPassword,
    });
    return response.data;
  } catch (error) {
    throw extraerError(error, 'No se pudo restablecer la contraseña');
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
  cambiarPasswordInicial,
  solicitarCodigoRecuperacion,
  reenviarCodigoRecuperacion,
  restablecerPassword,
  logout,
  getSession,
};

export default AuthService;