import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts y Guardianes
import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import RequireAuth from '../components/layout/RequireAuth.jsx';

// Vistas Públicas
import Home from '../pages/Home.jsx';
import Login from '../pages/Auth/Login.jsx';

// Vistas Privadas Reales
import Dashboard from '../pages/Dashboard.jsx';
import ClientsPage from '../pages/ClientsPage.jsx';
import ClientInmueblesPage from '../pages/ClientInmueblesPage.jsx'; // <--- Importar la nueva página

// Componentes temporales (Mocks)
const Calendar = () => <h1>Agenda Semanal</h1>;
const Analytics = () => <h1>Estadísticas</h1>;

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas Privadas */}
        <Route 
          path="/dashboard" 
          element={
            //<RequireAuth>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            //</RequireAuth>
          } 
        />
        
        <Route 
          path="/clients" 
          element={
            //<RequireAuth>
              <DashboardLayout>
                <ClientsPage />
              </DashboardLayout>
            //</RequireAuth>
          } 
        />

        {/* Ruta a Inmuebles de Cliente Especifico */}
        <Route 
          path="/clients/:id/inmuebles" 
          element={
            //<RequireAuth>
              <DashboardLayout>
                <ClientInmueblesPage />
              </DashboardLayout>
            //</RequireAuth>
          } 
        />
        
        <Route 
          path="/calendar" 
          element={
            <RequireAuth>
              <DashboardLayout>
                <Calendar />
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