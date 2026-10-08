import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VisitaService from '../services/api/visita.service';
import { VisitasPendientesContext } from './visitasPendientesContext.js';

const INTERVALO_POLLING_MS = 30000;

// Una sola fuente para las pendientes: antes el Header y el Dashboard pedían
// cada uno por su lado (uno con polling, el otro una sola vez al montar), así
// que la campanita y "Solicitudes nuevas" mostraban números distintos.
//
// Va arriba de las rutas y no en DashboardLayout porque cada ruta monta su
// propio layout: ahí el estado se perdería en cada navegación y el toast de
// una solicitud nueva desaparecería al cambiar de página.
export default function VisitasPendientesProvider({ children }) {
  const [pendientes, setPendientes] = useState([]);
  const [nuevas, setNuevas] = useState([]);

  // null hasta la primera carga: lo que ya estaba pendiente al abrir el panel
  // no es "nuevo", así que la primera respuesta solo fija la línea de base.
  const idsVistosRef = useRef(null);

  const refrescar = useCallback(async () => {
    // Sin sesión no hay a quién notificar (y el endpoint respondería 401).
    // Se resetea la línea de base para que, al volver a loguearse, lo que ya
    // estaba pendiente no salte como "nuevo"; la lista se pisa en ese fetch.
    if (!sessionStorage.getItem('accessToken')) {
      idsVistosRef.current = null;
      return;
    }

    try {
      const response = await VisitaService.getPendientes();
      const lista = response.data ?? [];
      setPendientes(lista);

      if (idsVistosRef.current === null) {
        idsVistosRef.current = new Set(lista.map((v) => v.id_solicitud));
        return;
      }

      const recienLlegadas = lista.filter((v) => !idsVistosRef.current.has(v.id_solicitud));
      if (recienLlegadas.length > 0) {
        recienLlegadas.forEach((v) => idsVistosRef.current.add(v.id_solicitud));
        setNuevas((previas) => [...recienLlegadas, ...previas]);
      }
    } catch (err) {
      console.error('No se pudieron obtener las solicitudes de visita pendientes:', err);
    }
  }, []);

  // La primera carga la dispara el Header al montarse (está en todas las
  // rutas del panel); acá solo el polling y el refresco al volver a la pestaña.
  useEffect(() => {
    const intervalId = setInterval(refrescar, INTERVALO_POLLING_MS);

    // Al volver a la pestaña no esperamos al próximo tick.
    const alVolverVisible = () => {
      if (document.visibilityState === 'visible') refrescar();
    };
    document.addEventListener('visibilitychange', alVolverVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', alVolverVisible);
    };
  }, [refrescar]);

  const descartarNuevas = useCallback(() => setNuevas([]), []);

  const valor = useMemo(
    () => ({ pendientes, nuevas, refrescar, descartarNuevas }),
    [pendientes, nuevas, refrescar, descartarNuevas]
  );

  return (
    <VisitasPendientesContext.Provider value={valor}>
      {children}
    </VisitasPendientesContext.Provider>
  );
}
