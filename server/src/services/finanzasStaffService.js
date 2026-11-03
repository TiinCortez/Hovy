import { supabaseAdmin } from '../config/supabase.js';
import { falla } from '../utils/solicitudesVisita.js';
import { hoyEnArgentina } from '../utils/fechaArgentina.js';

const ERROR_DB = 'No se pudo consultar la información financiera. Intentá de nuevo más tarde.';

const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const numero = (valor) => Number(valor || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const pesos = (valor) => `$${numero(valor)}`;

export const formatearEtiquetaMes = (mesIso) => {
  const [anio, numMes] = (mesIso || '').split('-').map(Number);
  const nombre = MESES_LARGOS[numMes - 1] ?? mesIso;
  return `${nombre} ${anio}`;
};

export const calcularRangoMes = (mesIso) => {
  const [anio, numMes] = mesIso.split('-').map(Number);
  const inicio = `${mesIso}-01`;
  const anioSig = numMes === 12 ? anio + 1 : anio;
  const mesSig = numMes === 12 ? 1 : numMes + 1;
  const finExclusivo = `${anioSig}-${String(mesSig).padStart(2, '0')}-01`;
  return { inicio, finExclusivo };
};

// Plain-text summary for WhatsApp
export const armarMensajeFinanzas = ({ mes, recaudado, porCobrar, totalLiquidado, porcentaje, turnosCobrados, turnosPendientes }) => {
  const etiqueta = formatearEtiquetaMes(mes);
  const totalTurnos = turnosCobrados + turnosPendientes;

  if (totalTurnos === 0) {
    return `📊 *Resumen Financiero - ${etiqueta}*\nNo se registraron turnos realizados en este período.`;
  }

  return [
    `📊 *Resumen Financiero - ${etiqueta}*`,
    `• Total liquidado: ${pesos(totalLiquidado)} (${totalTurnos} ${totalTurnos === 1 ? 'turno' : 'turnos'})`,
    `• Total cobrado: ${pesos(recaudado)} (${turnosCobrados} ${turnosCobrados === 1 ? 'turno' : 'turnos'} · ${porcentaje}%)`,
    `• Saldo por cobrar: ${pesos(porCobrar)} (${turnosPendientes} ${turnosPendientes === 1 ? 'turno pendiente' : 'turnos pendientes'})`,
  ].join('\n');
};

// Plain-text summary for debtors in WhatsApp
export const armarMensajeDeudores = (deudores, totalDeuda) => {
  if (!Array.isArray(deudores) || deudores.length === 0) {
    return '🎉 *Cuentas al día:* No hay clientes con saldo deudor pendiente en la cuenta corriente.';
  }

  const lineas = [
    `📋 *Clientes con saldo pendiente (${deudores.length}):*`,
  ];

  deudores.forEach((d, i) => {
    const tel = d.telefono ? ` · tel: ${d.telefono}` : '';
    lineas.push(`${i + 1}. ${d.cliente}: ${pesos(d.saldo)}${tel}`);
  });

  lineas.push('');
  lineas.push(`💵 *Total adeudado acumulado:* ${pesos(totalDeuda)}`);

  return lineas.join('\n');
};

// GET /api/bot/staff/:telefono/finanzas/resumen?mes=YYYY-MM
export const obtenerResumenFinanciero = async (
  { mes: mesRaw, clienteSupabase = supabaseAdmin } = {}
) => {
  const mes = mesRaw ? String(mesRaw).trim() : hoyEnArgentina().slice(0, 7);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    return falla(400, 'El mes tiene que tener el formato YYYY-MM (ej: 2026-11).');
  }

  const { inicio, finExclusivo } = calcularRangoMes(mes);

  try {
    const { data, error } = await clienteSupabase
      .from('turnos')
      .select('id_turno, fecha_programada, estado, cobrado, presupuesto:presupuestos(monto_total)')
      .eq('estado', 'Realizado')
      .gte('fecha_programada', inicio)
      .lt('fecha_programada', finExclusivo);

    if (error) {
      console.error('[finanzas] error al consultar turnos realizados del mes:', error);
      return falla(500, ERROR_DB);
    }

    let recaudado = 0;
    let porCobrar = 0;
    let turnosCobrados = 0;
    let turnosPendientes = 0;

    for (const t of data ?? []) {
      const monto = Number(t.presupuesto?.monto_total ?? 0);
      if (t.cobrado) {
        recaudado += monto;
        turnosCobrados += 1;
      } else {
        porCobrar += monto;
        turnosPendientes += 1;
      }
    }

    const totalLiquidado = recaudado + porCobrar;
    const porcentaje = totalLiquidado > 0 ? Math.round((recaudado / totalLiquidado) * 100) : 0;

    const resultadoData = {
      mes,
      recaudado,
      porCobrar,
      totalLiquidado,
      porcentaje,
      turnosCobrados,
      turnosPendientes,
    };

    return {
      data: resultadoData,
      mensaje: armarMensajeFinanzas(resultadoData),
    };
  } catch (err) {
    console.error('[finanzas] error inesperado en obtenerResumenFinanciero:', err);
    return falla(500, ERROR_DB);
  }
};

// GET /api/bot/staff/:telefono/finanzas/deudores
export const obtenerDeudores = async (
  { limite = 20, clienteSupabase = supabaseAdmin } = {}
) => {
  const limiteNum = Math.min(Math.max(Number(limite) || 20, 1), 100);

  try {
    const { data, error } = await clienteSupabase
      .from('v_deudores')
      .select('*')
      .order('saldo', { ascending: false })
      .limit(limiteNum);

    if (error) {
      console.error('[finanzas] error al consultar v_deudores:', error);
      return falla(500, ERROR_DB);
    }

    const deudores = (data ?? []).map((d) => ({
      id_cliente: d.id_cliente,
      cliente: d.cliente,
      telefono: d.telefono,
      tipo_cliente: d.tipo_cliente,
      saldo: Number(d.saldo ?? 0),
      ultimo_pago: d.ultimo_pago,
      primer_debito: d.primer_debito,
    }));

    const totalDeuda = deudores.reduce((acc, d) => acc + d.saldo, 0);

    const resultadoData = {
      totalDeudores: deudores.length,
      totalDeuda,
      deudores,
    };

    return {
      data: resultadoData,
      mensaje: armarMensajeDeudores(deudores, totalDeuda),
    };
  } catch (err) {
    console.error('[finanzas] error inesperado en obtenerDeudores:', err);
    return falla(500, ERROR_DB);
  }
};
