// Ways of getting a departure point from the browser. Both reject with an Error
// whose `mensajeUsuario` is ready to show (Spanish) for each failure case.
//
// obtenerUbicacion: position of the device, through the permission prompt.
// buscarDireccion: coordinates of a written address, through Nominatim.

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

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const TIMEOUT_BUSQUEDA_MS = 8000;
const SIN_RESULTADOS = 'No encontramos esa dirección. Probá agregando la altura y la localidad.';
const ERROR_BUSQUEDA = 'No se pudo buscar la dirección. Revisá tu conexión e intentá de nuevo.';

// ~1 m of precision, the same the server keeps.
const redondear5 = (numero) => Math.round(numero * 1e5) / 1e5;

// Resolves the shape of a suggestion: { latitud, longitud, direccion }. The address
// stays as the user wrote it. Nominatim's policy forbids autocomplete: call this
// only when the user asks for the search, never on each keystroke.
export const buscarDireccion = async (direccion) => {
  const url = new URL(NOMINATIM_SEARCH);
  url.search = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'ar',
    q: direccion,
  }).toString();

  let resultados;
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_BUSQUEDA_MS) });
    if (!respuesta.ok) throw new Error(`Nominatim status ${respuesta.status}`);
    resultados = await respuesta.json();
  } catch {
    throw falla(ERROR_BUSQUEDA);
  }

  const latitud = Number(resultados?.[0]?.lat);
  const longitud = Number(resultados?.[0]?.lon);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) throw falla(SIN_RESULTADOS);

  return { latitud: redondear5(latitud), longitud: redondear5(longitud), direccion };
};
