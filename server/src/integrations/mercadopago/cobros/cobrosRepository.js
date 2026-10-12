import { supabaseAdmin } from '../../../config/supabase.js';

// Data access for cobros_mercadopago (+ the seller lookup used by the webhook).
// Each function returns { data } or { dbError } (never forwarded to clients).

const COLUMNAS =
  'id, id_usuario, id_solicitud, monto, descripcion, external_reference, preference_id, init_point, estado, mp_payment_id, created_at, updated_at';

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

export const listarCobros = async (idUsuario, idSolicitud) => {
  let query = supabaseAdmin
    .from('cobros_mercadopago')
    .select(COLUMNAS)
    .eq('id_usuario', idUsuario)
    .order('created_at', { ascending: false });
  if (idSolicitud) query = query.eq('id_solicitud', idSolicitud);
  return resultado(await query);
};

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
