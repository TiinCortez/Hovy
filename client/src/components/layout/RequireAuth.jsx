import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import httpService from '../../services/api/http.service.js';

export default function RequireAuth({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Verificamos si existe el token en el navegador
      const token = sessionStorage.getItem('accessToken');

      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        // 2. Calculamos la URL correcta para validar
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const cleanUrl = baseUrl.replace(/\/api$/, '');

        // 3. Le pegamos al backend para ver si el token sigue vivo
        // Tu httpService ya le inyecta el Bearer Token automáticamente
        await httpService.get(`${cleanUrl}/auth/me`);

        setIsAuthenticated(true);
      } catch {
        // Si el backend devuelve 401 (expirado o inválido), limpiamos y pateamos
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
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

  // Si no pasa la autenticación, redirigimos al Login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si todo está OK, renderizamos el Dashboard o la vista protegida
  return children;
}