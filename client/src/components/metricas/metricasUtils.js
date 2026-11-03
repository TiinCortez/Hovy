// Helpers puros de la vista de Métricas. Todo se calcula en el front a partir de
// GET /api/turnos con el mismo criterio que la vista de Cobros: turnos Realizados,
// monto final del presupuesto y flag `cobrado`.
import { cambiarMesTurnos, formatearMontoARS } from '../turnos/agendaTurnos';
import { montoFinal, cobroAtrasado, etiquetaMes, normalizar } from '../cobros/cobrosUtils';

export const MESES_POR_PAGINA = 6;

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const redondear2 = (numero) => Math.round((numero + Number.EPSILON) * 100) / 100;
const redondear1 = (numero) => Math.round((numero + Number.EPSILON) * 10) / 10;

// "2026-10" + 1 -> "2026-11" (sin saltos raros entre meses de distinta duración)
export const sumarMeses = (mes, cantidad) => cambiarMesTurnos(`${mes}-01`, cantidad).slice(0, 7);

// Meses entre dos YYYY-MM (inclusive). Si vienen invertidos se ordenan.
export const listarMeses = (desde, hasta) => {
  const [inicio, fin] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  const meses = [];
  for (let mes = inicio; mes <= fin; mes = sumarMeses(mes, 1)) meses.push(mes);
  return meses;
};

// "2026-10" -> "Octubre"
export const nombreMes = (mes) => etiquetaMes(mes).split(' ')[0];

// "2026-10" -> "Oct 2026"
export const etiquetaMesCorta = (mes) => `${MESES_CORTOS[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

const etiquetaMeses = (meses) => (meses.length === 1
  ? etiquetaMes(meses[0])
  : `${etiquetaMesCorta(meses[0])} – ${etiquetaMesCorta(meses[meses.length - 1])}`);

// Por defecto: los últimos 12 meses (modo rango).
export const periodoPorDefecto = (mesActual) => ({
  modo: 'rango',
  mes: mesActual,
  anio: mesActual.slice(0, 4),
  desde: sumarMeses(mesActual, -11),
  hasta: mesActual,
});

// Traduce el período elegido a meses concretos:
//  - meses: lo que suman las tarjetas
//  - mesesDetalle: lo que muestran el gráfico y la tabla
//  - mesesAnteriores: el período anterior de la misma longitud
export const resolverPeriodo = ({ modo, mes, anio, desde, hasta }) => {
  if (modo === 'mes') {
    const anioDelMes = mes.slice(0, 4);
    const anterior = sumarMeses(mes, -1);
    return {
      meses: [mes],
      mesesDetalle: listarMeses(`${anioDelMes}-01`, `${anioDelMes}-12`),
      mesesAnteriores: [anterior],
      etiqueta: etiquetaMes(mes),
      etiquetaAnterior: etiquetaMes(anterior),
      mesDestacado: mes,
    };
  }

  if (modo === 'anio') {
    const anioAnterior = Number(anio) - 1;
    const meses = listarMeses(`${anio}-01`, `${anio}-12`);
    return {
      meses,
      mesesDetalle: meses,
      mesesAnteriores: listarMeses(`${anioAnterior}-01`, `${anioAnterior}-12`),
      etiqueta: `Año ${anio}`,
      etiquetaAnterior: `Año ${anioAnterior}`,
      mesDestacado: null,
    };
  }

  const meses = listarMeses(desde, hasta);
  const anteriores = listarMeses(sumarMeses(meses[0], -meses.length), sumarMeses(meses[0], -1));
  return {
    meses,
    mesesDetalle: meses,
    mesesAnteriores: anteriores,
    etiqueta: etiquetaMeses(meses),
    etiquetaAnterior: etiquetaMeses(anteriores),
    mesDestacado: null,
  };
};

// Años para el selector: desde el turno más viejo hasta el más nuevo (y el actual).
export const aniosDisponibles = (turnos, ...extras) => {
  const anios = new Set(extras.map(Number).filter(Boolean));
  turnos.forEach((turno) => {
    const anio = Number((turno.fechaAsignada || '').slice(0, 4));
    if (anio) anios.add(anio);
  });
  const minimo = Math.min(...anios);
  const maximo = Math.max(...anios);
  return Array.from({ length: maximo - minimo + 1 }, (_, i) => String(maximo - i));
};

// Nombres de servicio del catálogo del usuario más los que aparecen en turnos
// (así un servicio dado de baja sigue apareciendo en su historial).
export const opcionesDeServicio = (catalogo, turnos) => {
  const porClave = new Map();
  const agregar = (nombre) => {
    const clave = normalizar(nombre).trim();
    if (clave && !porClave.has(clave)) porClave.set(clave, String(nombre).trim());
  };
  catalogo.forEach((item) => agregar(item.servicio?.nombre ?? ''));
  turnos.forEach((turno) => (turno.servicio?.nombres ?? []).forEach(agregar));
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es'));
};

// Turnos realizados, opcionalmente de un servicio.
export const filtrarRealizados = (turnos, servicio) => {
  const clave = normalizar(servicio).trim();
  return turnos.filter((turno) => turno.estado === 'REALIZADO'
    && (!clave || (turno.servicio?.nombres ?? []).some((nombre) => normalizar(nombre).trim() === clave)));
};

const mesDeTurno = (turno) => (turno.fechaAsignada || '').slice(0, 7);

// Traslado (combustible hasta el inmueble) guardado en el presupuesto del turno.
// Sin traslado calculado suma 0.
const montoTraslado = (turno) => Number(turno.presupuesto?.monto_traslado ?? 0);
const kmTraslado = (turno) => Number(turno.presupuesto?.traslado_km ?? 0);

const totalizar = (turnos) => {
  let cobrado = 0;
  let porCobrar = 0;
  let cantidadCobrados = 0;
  let traslado = 0;
  let trasladoKm = 0;
  turnos.forEach((turno) => {
    const monto = montoFinal(turno);
    if (turno.cobrado) {
      cobrado += monto;
      cantidadCobrados += 1;
    } else {
      porCobrar += monto;
    }
    traslado += montoTraslado(turno);
    trasladoKm += kmTraslado(turno);
  });
  return {
    cobrado: redondear2(cobrado),
    porCobrar: redondear2(porCobrar),
    facturado: redondear2(cobrado + porCobrar),
    traslado: redondear2(traslado),
    trasladoKm: redondear2(trasladoKm),
    cantidadTurnos: turnos.length,
    cantidadCobrados,
    cantidadPendientes: turnos.length - cantidadCobrados,
  };
};

export const calcularVariacion = (actual, anterior) => ({
  diferencia: redondear2(actual - anterior),
  porcentaje: anterior > 0 ? redondear1(((actual - anterior) / anterior) * 100) : null,
});

export const porcentaje = (parte, total) => (total > 0 ? redondear1((parte / total) * 100) : 0);

// Totales de un conjunto de meses, más clientes al día / con deuda y atrasados.
export const resumirPeriodo = (realizados, meses, hoy) => {
  const incluidos = new Set(meses);
  const turnos = realizados.filter((turno) => incluidos.has(mesDeTurno(turno)));

  // clave del cliente -> true si tiene algún turno pendiente en el período
  const clientes = new Map();
  let cantidadAtrasados = 0;
  turnos.forEach((turno) => {
    const clave = turno.cliente?.id_cliente ?? turno.cliente?.telefono ?? `turno-${turno.idTurno}`;
    clientes.set(clave, Boolean(clientes.get(clave)) || !turno.cobrado);
    if (cobroAtrasado(turno, hoy)) cantidadAtrasados += 1;
  });
  const clientesConDeuda = [...clientes.values()].filter(Boolean).length;

  return {
    ...totalizar(turnos),
    clientesAlDia: clientes.size - clientesConDeuda,
    clientesConDeuda,
    cantidadAtrasados,
  };
};

// Una fila por mes (en orden cronológico) con su variación del cobrado contra el
// mes anterior, aunque ese mes anterior quede fuera del período.
export const armarDetalleMensual = (realizados, meses) => {
  const porMes = new Map();
  realizados.forEach((turno) => {
    const mes = mesDeTurno(turno);
    if (!mes) return;
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push(turno);
  });

  return meses.map((mes) => {
    const actual = totalizar(porMes.get(mes) ?? []);
    const anterior = totalizar(porMes.get(sumarMeses(mes, -1)) ?? []);
    return { mes, ...actual, variacion: calcularVariacion(actual.cobrado, anterior.cobrado) };
  });
};

// Eje Y con 4 divisiones y valores "redondos" (1, 2, 2.5, 5 x 10^n).
export const calcularEscala = (maximo, divisiones = 4) => {
  if (!(maximo > 0)) {
    const paso = 1000;
    return { tope: paso * divisiones, marcas: Array.from({ length: divisiones + 1 }, (_, i) => paso * i) };
  }
  const bruto = maximo / divisiones;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitud).find((valor) => valor >= bruto);
  return { tope: paso * divisiones, marcas: Array.from({ length: divisiones + 1 }, (_, i) => paso * i) };
};

export const formatearPorcentaje = (valor, { conSigno = false } = {}) => {
  const signo = valor < 0 ? '-' : (conSigno && valor > 0 ? '+' : '');
  return `${signo}${Math.abs(valor).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
};

// 1234.56 -> "1.234,6 km"
export const formatearKm = (km) => `${Number(km).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`;

export const formatearDiferencia = (monto) => {
  const signo = monto < 0 ? '-' : (monto > 0 ? '+' : '');
  return `${signo}${formatearMontoARS(Math.abs(monto))}`;
};

// CSV con ";" como separador y coma decimal, que es lo que espera Excel en es-AR.
const numeroCsv = (numero) => Number(numero).toLocaleString('es-AR', { useGrouping: false, maximumFractionDigits: 2 });
const celdaCsv = (valor) => {
  const texto = String(valor ?? '');
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

export const armarCsv = (detalle) => {
  const encabezado = [
    'Mes', 'Dinero cobrado', 'Por cobrar', 'Total facturado', 'Turnos realizados', 'Turnos cobrados',
    'Variación vs mes anterior (%)', 'Variación vs mes anterior ($)',
  ];
  const filas = detalle.map((fila) => [
    etiquetaMes(fila.mes),
    numeroCsv(fila.cobrado),
    numeroCsv(fila.porCobrar),
    numeroCsv(fila.facturado),
    fila.cantidadTurnos,
    fila.cantidadCobrados,
    fila.variacion.porcentaje === null ? '' : numeroCsv(fila.variacion.porcentaje),
    numeroCsv(fila.variacion.diferencia),
  ]);
  return [encabezado, ...filas].map((fila) => fila.map(celdaCsv).join(';')).join('\r\n');
};