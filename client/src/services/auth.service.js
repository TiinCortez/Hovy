import { supabase } from './supaBaseClient.js';

// Adaptación del auth.service.js para operar de forma segura con Supabase[cite: 4]
const login = async (email, password, navigateToComponent) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    console.error('Error de autenticación:', error.message);
    throw new Error('Usuario o clave incorrectos'); // Abstracción del manejo de error[cite: 4]
  }

  if (data.session) {
    navigateToComponent();
  }
};

const logout = async (navigateToHome) => {
  await supabase.auth.signOut();
  if (navigateToHome) {
    navigateToHome();
  }
};

const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

const AuthService = {
  login,
  logout,
  getSession,
};

export default AuthService;