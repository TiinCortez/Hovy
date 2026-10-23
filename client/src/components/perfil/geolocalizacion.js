// Position of the device through the browser's permission prompt.
// Resolves { latitud, longitud }; rejects with an Error whose `mensajeUsuario`
// is ready to show (Spanish) for each failure case.

const MENSAJES = {
  1: 'Bloqueaste el permiso de ubicación. Habilitalo en tu navegador y volvé a intentar.',
  2: 'No se pudo determinar tu ubicación. Revisá que el GPS o la red estén activos.',
  3: 'Tardó demasiado en obtener tu ubicación. Intentá de nuevo.',
};

const MENSAJE_NO_SOPORTADO =
  'Tu navegador no permite obtener la ubicación. Hace falta una conexión segura (https) y un navegador compatible.';

const falla = (mensajeUsuario) => Object.assign(new Error(mensajeUsuario), { mensajeUsuario });

export const obtenerUbicacion = () =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || window.isSecureContext === false) {
      reject(falla(MENSAJE_NO_SOPORTADO));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => resolve({ latitud: posicion.coords.latitude, longitud: posicion.coords.longitude }),
      (error) => reject(falla(MENSAJES[error.code] || MENSAJES[2])),
      // Approximate position is enough: no high accuracy (faster, no GPS wake-up).
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
