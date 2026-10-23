export const TIPOS_COMBUSTIBLE = [
  { valor: 'nafta', etiqueta: 'Nafta' },
  { valor: 'gasoil', etiqueta: 'Gasoil' },
  { valor: 'gnc', etiqueta: 'GNC' },
];

// Units per fuel type: gas is sold and consumed in m3, the rest in liters.
export const UNIDADES = {
  nafta: { consumo: 'L/100 km', precio: '/l' },
  gasoil: { consumo: 'L/100 km', precio: '/l' },
  gnc: { consumo: 'm³/100 km', precio: '/m³' },
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// "Actualizado hace 9 días", like the source site. `ahora` is passed in to keep it pure.
export const antiguedadPrecio = (fecha, ahora) => {
  if (!fecha) return 'Fecha de actualización desconocida';
  const dias = Math.floor((ahora - new Date(fecha).getTime()) / MS_POR_DIA);
  if (!Number.isFinite(dias)) return 'Fecha de actualización desconocida';
  if (dias < 1) return 'Actualizado hoy';
  if (dias === 1) return 'Actualizado hace 1 día';
  if (dias > 365) return 'Actualizado hace más de 1 año';
  return `Actualizado hace ${dias} días`;
};

export const MAX_SUGERENCIAS = 5;

const UNIDADES_TRASLADO = {
  l: { consumo: 'L', precio: '/l' },
  m3: { consumo: 'm³', precio: '/m³' },
};

const numeroAR = (valor) => Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 2 });

// "12 km aprox. (solo ida) × (10 L/100 km ÷ 100) × $2.109/l · YPF SUPER": the
// formula behind a trip cost, for the forms that show a budget.
export const formulaTraslado = (traslado, formatMonto) => {
  const unidad = UNIDADES_TRASLADO[traslado.unidad] ?? UNIDADES_TRASLADO.l;
  return `${numeroAR(traslado.km)} km${traslado.km_aproximados ? ' aprox.' : ''} (solo ida) × `
    + `(${numeroAR(traslado.consumo_100km)} ${unidad.consumo}/100 km ÷ 100) × `
    + `${formatMonto(traslado.precio_unidad)}${unidad.precio} · ${traslado.combustible}`;
};

const sinTildes = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Cities matching what the user typed (ignoring case and accents). Those that
// start with the text come first. Returns the first `limite` plus the total count.
export const filtrarCiudades = (opciones, texto, limite = MAX_SUGERENCIAS) => {
  const buscado = sinTildes(texto);
  if (!buscado) return { items: [], total: 0 };

  const coinciden = opciones
    .filter((opcion) => sinTildes(opcion).includes(buscado))
    .sort((a, b) => {
      const prioridadA = sinTildes(a).startsWith(buscado) ? 0 : 1;
      const prioridadB = sinTildes(b).startsWith(buscado) ? 0 : 1;
      return prioridadA - prioridadB || a.localeCompare(b, 'es');
    });

  return { items: coinciden.slice(0, limite), total: coinciden.length };
};

// Splits `texto` around the first match of `buscado` (ignoring case and accents)
// so the match can be highlighted. Falls back to no highlight when accents make
// the indexes of the normalized and the original text differ.
export const partirCoincidencia = (texto, buscado) => {
  const normalizado = sinTildes(texto);
  const indice = normalizado.indexOf(sinTildes(buscado));
  if (indice < 0 || normalizado.length !== texto.length || !buscado.trim()) return [texto, '', ''];
  const fin = indice + sinTildes(buscado).length;
  return [texto.slice(0, indice), texto.slice(indice, fin), texto.slice(fin)];
};

// Example shown to the user: cost of a trip of `km` with the chosen settings.
// Same formula as the backend (km x consumo/100 x price per unit, one way).
export const costoEjemplo = (km, consumo100km, precioUnidad) =>
  Math.round((km * (Number(consumo100km) / 100) * precioUnidad + Number.EPSILON) * 100) / 100;

export const formatearPesos = (monto) =>
  `$${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Same rule as the backend: a number greater than 0 and up to 100.
export const consumoValido = (valor) => {
  if (valor === '' || valor === null || valor === undefined) return false;
  const numero = Number(String(valor).replace(',', '.'));
  return Number.isFinite(numero) && numero > 0 && numero <= 100;
};
