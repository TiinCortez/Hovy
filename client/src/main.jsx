import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/fraunces/700.css'; // Tipografía del nombre en el logo del header
// Tipografía base de la app (los pesos que usa el SCSS: 400 a 800)
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './styles/main.scss'; // Entrypoint maestro de estilos SCSS y Bootstrap

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);