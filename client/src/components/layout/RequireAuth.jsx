import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../services/supaBaseClient';

// Componente Guardián de Rutas basado en el patrón RequireAuth
export default function RequireAuth({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificamos la sesión actual al montar el componente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Nos suscribimos a los cambios de estado (ej: si el token expira o cierra sesión)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: '#F2F2E6' }}>
        <div className="spinner-border" style={{ color: '#1B3006' }} role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  // Si no hay sesión activa, redirigimos al Login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Si pasa la autenticación, renderizamos el componente hijo (Dashboard, etc.)
  return children;
}