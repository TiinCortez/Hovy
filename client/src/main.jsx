import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/fraunces/700.css'; // Tipografía del nombre en el logo del header
import './styles/main.scss'; // Entrypoint maestro de estilos SCSS y Bootstrap

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);