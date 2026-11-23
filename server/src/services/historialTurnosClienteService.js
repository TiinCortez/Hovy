import { supabaseAdmin } from '../config/supabase.js';

const TAMANO_LOTE_IDS = 150;
const ERROR_CONSULTA = 'No se pudo consultar el historial de turnos del cliente.';

const parsearIdCliente = (valor) => {
  if (typeof valor === 'boolean' || String(valor ?? '').trim() === '') return null;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};

const enLotes = (lista, tamano) => {
  const lotes = [];
  for (let i = 0; i < lista.length; i += tamano) {
    lotes.push(lista.slice(i, i + tamano));
  }
  return lotes;
};

const normalizarEstado = (estado) => {
  if (!estado) return 'COORDINADO';
  const limpio = String(estado).trim().toLowerCase();
  if (limpio === 'en ejecución' || limpio === 'en ejecucion' || limpio === 'en_ejecucion') {
    return 'EN_EJECUCION';
  }
  return limpio.toUpperCase();
};

const normalizarPrioridad = (prioridad) =>
  (prioridad ? String(prioridad).trim().toUpperCase() : 'P3_CASUAL');

const aNumeroO = (valor, respaldo = null) =>
  (valor !== null && valor !== undefined ? Number(valor) : respaldo);

const obtenerServiciosYPresupuestos = async (idsPresupuesto, cliente) => {
  const ids = [...new Set(idsPresupuesto.filter((id) => id !== null && id !== undefined))];
  const porPresupuesto = new Map();
  if (ids.length === 0) return porPresupuesto;

  const asegurarEntrada = (idPresupuesto) => {
    if (!porPresupuesto.has(idPresupuesto)) {
      porPresupuesto.set(idPresupuesto, { nombres: [], presupuesto: null });
    }
    return porPresupuesto.get(idPresupuesto);
  };

  const ejecutarSeguro = (consulta) => Promise.resolve(consulta).catch((error) => ({ error }));

  for (const lote of enLotes(ids, TAMANO_LOTE_IDS)) {
    const [resDetalles, resPresupuestos] = await Promise.all([
      ejecutarSeguro(
        cliente
          .from('detalle_presupuesto')
          .select('id_presupuesto, id_servicio, servicio:servicios_catalogo(nombre)')
          .in('id_presupuesto', lote)
      ),
      ejecutarSeguro(
        cliente
          .from('presupuestos')
          .select('id_presupuesto, monto_estimado, monto_subtotal, monto_total, estado, monto_traslado, traslado_km')
          .in('id_presupuesto', lote)
      ),
    ]);

    if (resPresupuestos.error) {
      console.error('[historialTurnos] Error al consultar presupuestos:', resPresupuestos.error);
    } else {
      for (const p of resPresupuestos.data ?? []) {
        const entrada = asegurarEntrada(p.id_presupuesto);
        entrada.presupuesto = {
          id_presupuesto: p.id_presupuesto,
          monto_estimado: Number(p.monto_estimado ?? 0),
          monto_subtotal: Number(p.monto_subtotal ?? 0),
          monto_total: Number(p.monto_total ?? 0),
          estado: p.estado ?? null,
          monto_traslado: aNumeroO(p.monto_traslado, null),
          traslado_km: aNumeroO(p.traslado_km, null),
        };
      }
    }

    if (resDetalles.error) {
      console.error('[historialTurnos] Error al consultar servicios de presupuestos:', resDetalles.error);
    } else {
      for (const fila of resDetalles.data ?? []) {
        const entrada = asegurarEntrada(fila.id_presupuesto);
        const nombre = fila.servicio?.nombre;
        if (nombre && !entrada.nombres.includes(nombre)) {
          entrada.nombres.push(nombre);
        }
      }
    }
  }

  return porPresupuesto;
};

const obtenerPagosPorTurno = async (idsTurno, cliente) => {
  const porTurno = new Map();
  const ids = [...new Set(idsTurno.filter((id) => id !== null && id !== undefined))];
  if (ids.length === 0) return porTurno;

  try {
    const turnoPorTrabajo = new Map();
    for (const lote of enLotes(ids, TAMANO_LOTE_IDS)) {
      const { data, error } = await cliente
        .from('trabajos_ejecutados')
        .select('id_trabajo, id_turno')
        .in('id_turno', lote);
      if (error) throw error;
      for (const trabajo of data ?? []) {
        turnoPorTrabajo.set(trabajo.id_trabajo, trabajo.id_turno);
      }
    }

    const idsTrabajo = [...turnoPorTrabajo.keys()];
    if (idsTrabajo.length === 0) return porTurno;

    const acumuladoPorTurno = new Map();
    for (const lote of enLotes(idsTrabajo, TAMANO_LOTE_IDS)) {
      const { data, error } = await cliente
        .from('pagos')
        .select('id_pago, id_trabajo, medio_pago, monto, estado, fecha_pago')
        .eq('estado', 'Aprobado')
        .in('id_trabajo', lote)
        .order('id_pago', { ascending: true });
      if (error) throw error;

      for (const pago of data ?? []) {
        const idTurno = turnoPorTrabajo.get(pago.id_trabajo);
        if (idTurno === undefined) continue;
        const actual = acumuladoPorTurno.get(idTurno) ?? { centavos: 0, pagos: [] };
        const monto = Number(pago.monto ?? 0);
        actual.centavos += Math.round(monto * 100);
        actual.pagos.push({
          id_pago: pago.id_pago,
          medio_pago: pago.medio_pago ?? null,
          monto,
          fecha_pago: pago.fecha_pago ?? null,
        });
        acumuladoPorTurno.set(idTurno, actual);
      }
    }

    for (const [idTurno, info] of acumuladoPorTurno) {
      porTurno.set(idTurno, {
        totalPagado: info.centavos / 100,
        pagos: info.pagos,
      });
    }
  } catch (error) {
    console.error('[historialTurnos] Error al consultar pagos de los turnos:', error);
  }

  return porTurno;
};

const formatearTurnoHistorial = (turno, infoPresupuesto, infoPagos) => {
  const nombresServicios = infoPresupuesto?.nombres ?? [];
  const cobrado = turno.cobrado === true;

  return {
    id_turno: turno.id_turno,
    id_presupuesto: turno.id_presupuesto ?? null,
    fecha_programada: turno.fecha_programada,
    inicio_desde: turno.inicio_desde ?? null,
    hasta: turno.hasta ?? null,
    prioridad: normalizarPrioridad(turno.prioridad),
    estado: normalizarEstado(turno.estado),
    motivo_cancelacion: turno.motivo_cancelacion ?? null,
    cobrado,
    inmueble: turno.inmueble ?? null,
    servicios: nombresServicios,
    servicio_descripcion: nombresServicios.length > 0 ? nombresServicios.join(', ') : null,
    presupuesto: infoPresupuesto?.presupuesto ?? null,
    cobro: {
      cobrado,
      total_pagado: infoPagos?.totalPagado ?? 0,
      pagos: infoPagos?.pagos ?? [],
    },
  };
};

/**
 * Consulta el historial completo de turnos de un cliente (todos los estados),
 * ordenado del más reciente al más antiguo y enriquecido con inmueble, servicios,
 * presupuesto y pagos aprobados.
 */
export const obtenerHistorialTurnosCliente = async ({ idCliente, cliente = supabaseAdmin } = {}) => {
  const idClienteNum = parsearIdCliente(idCliente);
  if (!idClienteNum) {
    return {
      error: { status: 400, message: 'El id del cliente tiene que ser un número entero positivo.' },
    };
  }

  try {
    const { data: turnos, error } = await cliente
      .from('turnos')
      .select(`
        id_turno,
        id_presupuesto,
        id_inmueble,
        fecha_programada,
        inicio_desde,
        hasta,
        prioridad,
        estado,
        motivo_cancelacion,
        cobrado,
        inmueble:inmuebles!inner (
          id_inmueble,
          id_cliente,
          direccion,
          barrio,
          provincia,
          manzana,
          lote,
          tipo_inmueble,
          superficie_mantenible,
          superficie_total
        )
      `)
      .eq('inmueble.id_cliente', idClienteNum)
      .order('fecha_programada', { ascending: false })
      .order('inicio_desde', { ascending: false })
      .order('id_turno', { ascending: false });

    if (error) {
      console.error('[historialTurnos] Error al consultar turnos del cliente:', error);
      return { error: { status: 500, message: ERROR_CONSULTA } };
    }

    if (!turnos || turnos.length === 0) {
      return { data: [] };
    }

    const idsRealizados = turnos
      .filter((t) => normalizarEstado(t.estado) === 'REALIZADO')
      .map((t) => t.id_turno);

    const [porPresupuesto, porTurnoPagos] = await Promise.all([
      obtenerServiciosYPresupuestos(turnos.map((t) => t.id_presupuesto), cliente),
      obtenerPagosPorTurno(idsRealizados, cliente),
    ]);

    const data = turnos.map((turno) =>
      formatearTurnoHistorial(
        turno,
        porPresupuesto.get(turno.id_presupuesto),
        porTurnoPagos.get(turno.id_turno)
      )
    );

    return { data };
  } catch (error) {
    console.error('[historialTurnos] Error inesperado al consultar historial:', error);
    return { error: { status: 500, message: ERROR_CONSULTA } };
  }
};
