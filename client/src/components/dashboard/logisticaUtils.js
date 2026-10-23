const numero = (valor, decimales) =>
  Number(valor).toLocaleString('es-AR', { maximumFractionDigits: decimales });

export const SIN_DATO = '—';

// "48,3 km" or the placeholder when the route could not be computed.
export const formatearKm = (ruta) => (ruta?.incluido ? `${numero(ruta.km, 1)} km` : SIN_DATO);

// Gas is measured in m3, liquid fuel in liters: the label follows the unit.
export const etiquetaConsumo = (combustible) => (combustible?.unidad === 'm3' ? 'Gas est.' : 'Combustible est.');

export const formatearConsumo = (combustible) =>
  combustible?.incluido ? `${numero(combustible.cantidad, 2)} ${combustible.unidad === 'm3' ? 'm³' : 'L'}` : SIN_DATO;

export const formatearCosto = (combustible) =>
  combustible?.incluido
    ? `$${Number(combustible.costo).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

// Notices under the cards: why a number is missing or approximate.
export const avisosLogistica = (logistica) => {
  if (!logistica) return [];
  const avisos = [];
  const { ruta, combustible } = logistica;

  // Without turnos there is nothing to explain: the counters already say 0.
  if (logistica.turnos > 0) {
    if (ruta && !ruta.incluido) avisos.push(ruta.mensaje);
    else if (combustible && !combustible.incluido) avisos.push(combustible.mensaje);
  }
  if (ruta?.incluido && ruta.km_aproximados) {
    avisos.push('Los km son una estimación en línea recta con un margen por calles, no una ruta real.');
  }
  if (logistica.sin_ubicacion > 0) {
    avisos.push(`${logistica.sin_ubicacion} turno(s) sin ubicación del inmueble quedaron fuera de la ruta.`);
  }
  if (logistica.sin_horario > 0) {
    avisos.push(`${logistica.sin_horario} turno(s) sin horario se ubican al final de la ruta.`);
  }
  if (combustible?.incluido && combustible.desactualizado) {
    avisos.push('El precio del combustible podría estar desactualizado.');
  }
  return avisos.filter(Boolean);
};
