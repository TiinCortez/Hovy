import { normalizarCoordenadas } from './coordenadas.js';

// Pure helpers for the day's logistics (route, clients, text for the bot).
// No I/O: the turnos come already loaded.

const hayValor = (valor) => valor !== null && valor !== undefined;

// Turnos of one day -> what the route needs:
//  - turnos / clientes: not cancelled turnos and distinct clients among them.
//  - puntos: property locations in chronological order (turnos without a time go
//    last). A property repeated back to back is one stop; one that comes back
//    later in the day is a new stop.
//  - sin_ubicacion: turnos whose property has no valid location (left out).
//  - sin_horario: turnos without a start time (sorted last, the order is a guess).
export const armarRutaDelDia = (turnos) => {
  const vigentes = Array.isArray(turnos) ? turnos.filter((t) => t && t.estado !== 'Cancelado') : [];

  const clientes = new Set(vigentes.map((t) => t.inmueble?.id_cliente).filter(hayValor));

  const ordenados = [...vigentes].sort((a, b) => {
    const horaA = a.inicio_desde ?? null;
    const horaB = b.inicio_desde ?? null;
    if (horaA === horaB) return 0;
    if (horaA === null) return 1;
    if (horaB === null) return -1;
    return String(horaA).localeCompare(String(horaB));
  });

  const puntos = [];
  let sinUbicacion = 0;
  for (const turno of ordenados) {
    const punto = normalizarCoordenadas(turno.inmueble?.latitud, turno.inmueble?.longitud);
    if (!punto) {
      sinUbicacion += 1;
      continue;
    }
    const ultimo = puntos[puntos.length - 1];
    if (ultimo && ultimo.latitud === punto.latitud && ultimo.longitud === punto.longitud) continue;
    puntos.push(punto);
  }

  return {
    turnos: vigentes.length,
    clientes: clientes.size,
    puntos,
    sin_ubicacion: sinUbicacion,
    sin_horario: vigentes.filter((t) => !t.inicio_desde).length,
  };
};

const numero = (valor) => Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const pesos = (valor) => `$${numero(valor)}`;
const plural = (cantidad, singular, pluralTexto) => `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
const UNIDAD_TEXTO = { l: 'L', m3: 'm³' };

// Plain-text summary of obtenerLogisticaDia's answer, ready for the WhatsApp bot.
export const armarMensajeLogistica = (datos) => {
  if (!datos || datos.turnos === 0) {
    return `No hay turnos para el ${datos?.fecha ?? 'día consultado'}.`;
  }

  const lineas = [
    `Para el ${datos.fecha} hay ${plural(datos.turnos, 'turno', 'turnos')} con ${plural(datos.clientes_a_visitar, 'cliente', 'clientes')}.`,
  ];

  const { ruta, combustible } = datos;
  if (ruta?.incluido) {
    lineas.push(
      `Ruta estimada: ${numero(ruta.km)} km${ruta.km_aproximados ? ' (aproximado: línea recta con un margen por calles, no una ruta real)' : ''}.`
    );
    if (combustible?.incluido) {
      lineas.push(
        `Consumo estimado: ${numero(combustible.cantidad)} ${UNIDAD_TEXTO[combustible.unidad] ?? ''} de ${combustible.combustible}, unos ${pesos(combustible.costo)}.`
      );
      if (combustible.desactualizado) lineas.push('El precio del combustible podría estar desactualizado.');
    } else if (combustible?.mensaje) {
      lineas.push(`Combustible: ${combustible.mensaje}`);
    }
  } else if (ruta?.mensaje) {
    lineas.push(`No se pudo calcular la ruta: ${ruta.mensaje}`);
  }

  if (datos.sin_ubicacion > 0) {
    lineas.push(`${plural(datos.sin_ubicacion, 'turno sin ubicación quedó', 'turnos sin ubicación quedaron')} fuera de la ruta.`);
  }
  if (datos.sin_horario > 0) {
    lineas.push(`${plural(datos.sin_horario, 'turno sin horario se ubica', 'turnos sin horario se ubican')} al final de la ruta.`);
  }

  return lineas.join(' ');
};
