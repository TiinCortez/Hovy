import { supabaseAdmin } from '../config/supabase.js';
import { calcularPendienteTrabajo } from '../integrations/mercadopago/cobros/cobroTurno.js';
import { armarLinkMaps } from '../utils/turnosBot.js';
import { falla } from '../utils/solicitudesVisita.js';

const ERROR_DB = 'No se pudieron consultar los turnos pendientes de cobro.';

const formatearMoneda = (monto) =>
  `$${Number(monto ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatearFecha = (f) => {
  if (!f) return '';
  const partes = String(f).split('-');
  if (partes.length !== 3) return f;
  const [y, m, d] = partes;
  return `${d}/${m}`;
};

export const armarMensajePendientesCobro = (turnos) => {
  if (!turnos || turnos.length === 0) {
    return 'No hay turnos realizados con saldo pendiente de cobro.';
  }
  const plural = turnos.length === 1 ? '1 turno pendiente de cobro' : `${turnos.length} turnos pendientes de cobro`;
  const lineas = [`Hay ${plural}:`, ''];
  turnos.forEach((t, i) => {
    const lugar = [t.direccion, t.barrio].filter(Boolean).join(', ');
    const fecha = t.fecha ? ` (${formatearFecha(t.fecha)})` : '';
    lineas.push(`${i + 1}. *${t.cliente || 'Sin nombre'}* - ${lugar || 'Sin dirección'}${fecha} - *Saldo: ${formatearMoneda(t.saldo_pendiente)}*`);
  });
  return lineas.join('\n');
};

export const obtenerTurnosPendientesCobro = async ({ limite = 20, cliente = supabaseAdmin } = {}) => {
  const limiteNum = Math.max(1, Math.min(100, Number(limite) || 20));

  try {
    const { data: turnos, error: errTurnos } = await cliente
      .from('turnos')
      .select(`
        id_turno,
        fecha_programada,
        inicio_desde,
        hasta,
        prioridad,
        estado,
        cobrado,
        id_presupuesto,
        inmueble:inmuebles (
          id_inmueble,
          direccion,
          barrio,
          latitud,
          longitud,
          cliente:clientes (
            id_cliente,
            nombre,
            apellido,
            telefono
          )
        ),
        presupuesto:presupuestos (
          id_presupuesto,
          monto_total,
          estado
        )
      `)
      .eq('estado', 'Realizado')
      .eq('cobrado', false)
      .order('fecha_programada', { ascending: true })
      .order('inicio_desde', { ascending: true })
      .limit(limiteNum);

    if (errTurnos) {
      console.error('[turnosPendientesCobro] error al leer turnos:', errTurnos);
      return falla(500, ERROR_DB);
    }

    if (!turnos || turnos.length === 0) {
      return { data: [], mensaje: armarMensajePendientesCobro([]) };
    }

    const idsTurnos = turnos.map((t) => t.id_turno);

    const { data: trabajos, error: errTrabajos } = await cliente
      .from('trabajos_ejecutados')
      .select('id_trabajo, id_turno')
      .in('id_turno', idsTurnos);

    if (errTrabajos) {
      console.error('[turnosPendientesCobro] error al leer trabajos:', errTrabajos);
      return falla(500, ERROR_DB);
    }

    const idsTrabajo = (trabajos ?? []).map((tr) => tr.id_trabajo);
    const turnoPorTrabajo = new Map((trabajos ?? []).map((tr) => [tr.id_trabajo, tr.id_turno]));

    let movimientosPorTurno = new Map();
    if (idsTrabajo.length > 0) {
      const { data: movimientos, error: errMovs } = await cliente
        .from('movimientos_cuenta')
        .select('id_trabajo, tipo, monto')
        .in('id_trabajo', idsTrabajo);

      if (errMovs) {
        console.error('[turnosPendientesCobro] error al leer movimientos:', errMovs);
        return falla(500, ERROR_DB);
      }

      for (const m of movimientos ?? []) {
        const idTurno = turnoPorTrabajo.get(m.id_trabajo);
        if (idTurno) {
          if (!movimientosPorTurno.has(idTurno)) {
            movimientosPorTurno.set(idTurno, []);
          }
          movimientosPorTurno.get(idTurno).push(m);
        }
      }
    }

    const pendientes = [];
    for (const t of turnos) {
      const movs = movimientosPorTurno.get(t.id_turno) ?? [];
      const totalPresupuesto = Number(t.presupuesto?.monto_total ?? 0);
      const saldoCalculado = calcularPendienteTrabajo(movs) ?? (t.presupuesto?.estado === 'Aceptado' ? totalPresupuesto : null);

      if (!(saldoCalculado > 0)) continue;

      const inmueble = t.inmueble ?? {};
      const clienteData = inmueble.cliente ?? {};

      pendientes.push({
        id_turno: t.id_turno,
        fecha: t.fecha_programada,
        hora_inicio: t.inicio_desde,
        hora_fin: t.hasta,
        estado: t.estado,
        prioridad: t.prioridad,
        direccion: inmueble.direccion ?? null,
        barrio: inmueble.barrio ?? null,
        cliente: [clienteData.nombre, clienteData.apellido].filter(Boolean).join(' ') || null,
        telefono_cliente: clienteData.telefono ?? null,
        total_presupuestado: totalPresupuesto,
        saldo_pendiente: saldoCalculado,
        link_maps: armarLinkMaps(inmueble),
      });
    }

    return {
      data: pendientes,
      mensaje: armarMensajePendientesCobro(pendientes),
    };
  } catch (err) {
    console.error('[turnosPendientesCobro] error inesperado:', err);
    return falla(500, ERROR_DB);
  }
};
