import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login/Login';

// Importa aquí otras páginas a medida que las crees
// import Register from './pages/Auth/Register';
// import Dashboard from './pages/Dashboard/Dashboard';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirige la ruta raíz ("/") directamente al Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Ruta para la pantalla de Login */}
        <Route path="/login" element={<Login />} />

        {/* Agrega más rutas en el futuro según lo necesites */}
        {/* <Route path="/register" element={<Register />} /> */}
        {/* <Route path="/dashboard" element={<Dashboard />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App
