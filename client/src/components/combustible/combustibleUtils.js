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

// Same rule as the backend: a number greater than 0 and up to 100.
export const consumoValido = (valor) => {
  if (valor === '' || valor === null || valor === undefined) return false;
  const numero = Number(String(valor).replace(',', '.'));
  return Number.isFinite(numero) && numero > 0 && numero <= 100;
};
