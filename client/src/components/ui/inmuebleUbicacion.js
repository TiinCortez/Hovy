export function obtenerCoordenadas(latitud, longitud) {
  if (latitud == null || longitud == null || String(latitud).trim() === '' || String(longitud).trim() === '') return null;

  const lat = Number(latitud);
  const lng = Number(longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return [lat, lng];
}

export function obtenerEnlaceUbicacionWhatsApp(inmueble) {
  const coordenadas = obtenerCoordenadas(inmueble?.latitud, inmueble?.longitud);
  if (!coordenadas) return null;

  // Sin origin: Maps usa la ubicación de quien abre el enlace, si está disponible.
  const parametros = new URLSearchParams({
    api: '1',
    destination: coordenadas.join(','),
    dir_action: 'navigate',
  });
  const enlaceMaps = `https://www.google.com/maps/dir/?${parametros}`;
  const direccion = [inmueble.direccion, inmueble.barrio, inmueble.provincia]
    .map(valor => String(valor ?? '').trim())
    .filter(Boolean)
    .join(', ');
  const mensaje = [
    '📍 Ubicación del inmueble',
    direccion ? `Dirección: ${direccion}` : null,
    `Cómo llegar: ${enlaceMaps}`,
  ].filter(Boolean).join('\n');

  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}
