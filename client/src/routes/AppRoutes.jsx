import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts y Guardianes
import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import RequireAuth from '../components/layout/RequireAuth.jsx';

// Vistas Públicas
import Home from '../pages/Home.jsx';
import Login from '../pages/Auth/Login.jsx';
import Register from '../pages/Auth/Register.jsx';

// Vistas Privadas Reales
import Dashboard from '../pages/Dashboard.jsx';
import ClientsPage from '../pages/ClientsPage.jsx';
import ClientInmueblesPage from '../pages/ClientInmueblesPage.jsx';
import TurnosPage from '../pages/TurnosPage.jsx'; // <--- IMPORTAMOS LA NUEVA PÁGINA

// Componentes temporales (Mocks)
const Analytics = () => <h1>Estadísticas</h1>;

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Rutas Privadas */}
        <Route 
          path="/dashboard" 
          element={
            <RequireAuth>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </RequireAuth>
          } 
        />
        
        <Route 
          path="/clients" 
          element={
            <RequireAuth>
              <DashboardLayout>
                <ClientsPage />
              </DashboardLayout>
            </RequireAuth>
          } 
        />

        <Route 
          path="/clients/:id/inmuebles" 
          element={
            <RequireAuth>
              <DashboardLayout>
                <ClientInmueblesPage />
              </DashboardLayout>
            </RequireAuth>
          } 
        />
        
        {/* RUTA DE AGENDA ACTUALIZADA */}
        <Route 
          path="/calendar" 
          element={
            <RequireAuth>
              <DashboardLayout>
                <TurnosPage />
              </DashboardLayout>
            </RequireAuth>
          } 
        />
        
        <Route 
          path="/analytics" 
          element={
            <RequireAuth>
              <DashboardLayout>
                <Analytics />
              </DashboardLayout>
            </RequireAuth>
          } 
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}