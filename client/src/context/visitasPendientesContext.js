import { createContext, useContext } from 'react';

// Estado compartido de las solicitudes de visita pendientes. Vive aparte del
// provider para que el archivo .jsx exporte solo componentes (react-refresh).
export const VisitasPendientesContext = createContext(null);

export const useVisitasPendientes = () => {
  const contexto = useContext(VisitasPendientesContext);
  if (!contexto) {
    throw new Error('useVisitasPendientes tiene que usarse dentro de <VisitasPendientesProvider>.');
  }
  return contexto;
};
