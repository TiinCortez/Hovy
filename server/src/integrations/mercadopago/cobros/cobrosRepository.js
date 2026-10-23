import { supabaseAdmin } from '../../../config/supabase.js';

// Data access for cobros_mercadopago (+ the seller lookup used by the webhook).
// Each function returns { data } or { dbError } (never forwarded to clients).

const COLUMNAS =
  'id, id_usuario, id_solicitud, id_turno, id_cliente, id_pago, monto, descripcion, external_reference, preference_id, init_point, estado, mp_payment_id, created_at, updated_at';

const resultado = ({ data, error }) => (error ? { dbError: error } : { data });

export const insertarCobro = async (fila) =>
  resultado(await supabaseAdmin.from('cobros_mercadopago').insert(fila).select(COLUMNAS).single());

export const actualizarPreferencia = async (id, { preference_id, init_point }) =>
  resultado(
    await supabaseAdmin
      .from('cobros_mercadopago')
      .update({ preference_id, init_point, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNAS)
      .single()
  );

export const eliminarCobro = async (id) =>
  resultado(await supabaseAdmin.from('cobros_mercadopago').delete().eq('id', id));

export const listarCobros = async (idUsuario, idSolicitud, idTurno = null) => {
  let query = supabaseAdmin
    .from('cobros_mercadopago')
    .select(COLUMNAS)
    .eq('id_usuario', idUsuario)
    .order('created_at', { ascending: false });
  if (idSolicitud) query = query.eq('id_solicitud', idSolicitud);
  if (idTurno) query = query.eq('id_turno', idTurno);
  return resultado(await query);
};

// Most recent cobro of a turno in any state (to answer "did they pay?"), whoever
// created it. Resolves { data: row | null }.
export const buscarUltimoPorTurno = async (idTurno) =>
  resultado(
    await supabaseAdmin
      .from('cobros_mercadopago')
      .select(COLUMNAS)
      .eq('id_turno', idTurno)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );

// Owner-scoped lookup: another seller's cobro looks like a missing one.
export const obtenerCobro = async (id, idUsuario) =>
  resultado(
    await supabaseAdmin
      .from('cobros_mercadopago')
      .select(COLUMNAS)
      .eq('id', id)
      .eq('id_usuario', idUsuario)
      .maybeSingle()
  );

export const buscarActivoPorSolicitud = async (idSolicitud, idUsuario) =>
  resultado(
    await supabaseAdmin
      .from('cobros_mercadopago')
      .select('id, estado')
      .eq('id_solicitud', idSolicitud)
      .eq('id_usuario', idUsuario)
      .in('estado', ['Pendiente', 'Aprobado'])
      .limit(1)
  );

// Live cobros (Pendiente / Aprobado) of a turno, whoever created them: a turno
// cannot be charged twice, so this is not scoped to one seller.
export const buscarActivosPorTurno = async (idTurno) =>
  resultado(
    await supabaseAdmin
      .from('cobros_mercadopago')
      .select(COLUMNAS)
      .eq('id_turno', idTurno)
      .in('estado', ['Pendiente', 'Aprobado'])
  );

// Everything needed to decide how much a turno owes: the turno with its client,
// the movements of its job in the account ledger, the budget and the service name.
// Resolves { data: { turno, movimientos, presupuesto, servicio } } with turno null
// when it does not exist, or { dbError }.
export const leerContextoCobroTurno = async (idTurno) => {
  const { data: turno, error } = await supabaseAdmin
    .from('turnos')
    .select('id_turno, estado, cobrado, id_presupuesto, inmueble:inmuebles(id_cliente)')
    .eq('id_turno', idTurno)
    .maybeSingle();
  if (error) return { dbError: error };
  if (!turno) return { data: { turno: null, movimientos: [], presupuesto: null, servicio: null, idTrabajo: null } };

  const { data: trabajo, error: errTrabajo } = await supabaseAdmin
    .from('trabajos_ejecutados')
    .select('id_trabajo')
    .eq('id_turno', idTurno)
    .maybeSingle();
  if (errTrabajo) return { dbError: errTrabajo };

  let movimientos = [];
  if (trabajo) {
    const lectura = await supabaseAdmin
      .from('movimientos_cuenta')
      .select('tipo, monto')
      .eq('id_trabajo', trabajo.id_trabajo);
    if (lectura.error) return { dbError: lectura.error };
    movimientos = lectura.data ?? [];
  }

  let presupuesto = null;
  let servicio = null;
  if (turno.id_presupuesto) {
    const [pres, detalle] = await Promise.all([
      supabaseAdmin
        .from('presupuestos')
        .select('monto_total, estado')
        .eq('id_presupuesto', turno.id_presupuesto)
        .maybeSingle(),
      supabaseAdmin
        .from('detalle_presupuesto')
        .select('servicio:servicios_catalogo(nombre)')
        .eq('id_presupuesto', turno.id_presupuesto)
        .limit(1),
    ]);
    if (pres.error) return { dbError: pres.error };
    presupuesto = pres.data ?? null;
    servicio = detalle.data?.[0]?.servicio?.nombre ?? null;
  }

  return {
    data: {
      turno: { id_turno: turno.id_turno, estado: turno.estado, cobrado: turno.cobrado, id_cliente: turno.inmueble?.id_cliente ?? null },
      movimientos,
      presupuesto,
      servicio,
      idTrabajo: trabajo?.id_trabajo ?? null,
    },
  };
};

// Payments registered for a job (cash, transfer, Mercado Pago), oldest first.
// The reference is not selected: it can hold bank operation numbers.
export const listarPagosDeTrabajo = async (idTrabajo) =>
  resultado(
    await supabaseAdmin
      .from('pagos')
      .select('id_pago, medio_pago, monto, estado, fecha_pago')
      .eq('id_trabajo', idTrabajo)
      .order('id_pago', { ascending: true })
  );

// Records an approved cobro in the client's account (payment + credit + cobrado
// flag), atomically and idempotently, with the database function of migration 013.
// Resolves { data: { registrado, motivo?, id_pago?, ... } } or { dbError }.
export const registrarPagoCobro = async (idCobro) =>
  resultado(await supabaseAdmin.rpc('fn_registrar_pago_cobro', { p_id_cobro: idCobro }));

export const obtenerPorReferencia = async (externalReference, idUsuario) =>
  resultado(
    await supabaseAdmin
      .from('cobros_mercadopago')
      .select(COLUMNAS)
      .eq('external_reference', externalReference)
      .eq('id_usuario', idUsuario)
      .maybeSingle()
  );

// Conditional transition: only a Pendiente cobro changes, so an Aprobado one
// can never be downgraded even under concurrent notifications.
// Resolves { data: [rows] } (empty when nothing matched).
export const transicionarDesdePendiente = async (id, nuevoEstado, mpPaymentId = null) => {
  const cambios = { estado: nuevoEstado, updated_at: new Date().toISOString() };
  if (mpPaymentId) cambios.mp_payment_id = String(mpPaymentId);
  return resultado(
    await supabaseAdmin
      .from('cobros_mercadopago')
      .update(cambios)
      .eq('id', id)
      .eq('estado', 'Pendiente')
      .select('id')
  );
};

// Webhook: seller user id from the Mercado Pago user_id of the notification.
export const obtenerUsuarioPorMpUserId = async (mpUserId) =>
  resultado(
    await supabaseAdmin
      .from('mercadopago_conexion')
      .select('id_usuario')
      .eq('mp_user_id', mpUserId)
      .maybeSingle()
  );
