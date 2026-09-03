import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import RequireAuth from '../components/layout/requireAuth.jsx';
import Home from '../pages/Home.jsx';
import Login from '../pages/Auth/Login.jsx';

// Componentes temporales (Mocks) que reemplazaremos por las vistas reales
const Dashboard = () => <h1>Panel General (Dashboard)</h1>;
const Clients = () => <h1>Listado de Clientes</h1>;
const Calendar = () => <h1>Agenda Semanal</h1>;
const Analytics = () => <h1>Estadísticas</h1>;

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas Privadas: Envueltas en el Guardián (RequireAuth) y luego en el Layout */}
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
                <Clients />
              </DashboardLayout>
            </RequireAuth>
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