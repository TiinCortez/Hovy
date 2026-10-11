import { supabaseAdmin } from '../../config/supabase.js';

// Data access for mercadopago_oauth_state and mercadopago_conexion.
// Every function returns { data } or { dbError } (message is never sent to clients).

export const insertState = async ({ stateHash, idUsuario, expiraEn }) => {
  const { error } = await supabaseAdmin.from('mercadopago_oauth_state').insert({
    state_hash: stateHash,
    id_usuario: idUsuario,
    expira_en: expiraEn,
  });
  return error ? { dbError: error } : { data: true };
};

export const deleteExpiredStates = async () => {
  await supabaseAdmin
    .from('mercadopago_oauth_state')
    .delete()
    .lt('expira_en', new Date().toISOString());
};

// Atomic one-time consumption: the conditional UPDATE only matches an unused,
// unexpired row, so concurrent callbacks cannot both succeed.
export const consumeState = async (stateHash) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('mercadopago_oauth_state')
    .update({ usado_en: nowIso })
    .eq('state_hash', stateHash)
    .is('usado_en', null)
    .gt('expira_en', nowIso)
    .select('id_usuario');
  if (error) return { dbError: error };
  return { data: data && data.length === 1 ? data[0].id_usuario : null };
};

export const upsertConexion = async (fila) => {
  const { error } = await supabaseAdmin
    .from('mercadopago_conexion')
    .upsert(
      { ...fila, updated_at: new Date().toISOString() },
      { onConflict: 'id_usuario' }
    );
  return error ? { dbError: error } : { data: true };
};

export const getConexion = async (idUsuario) => {
  const { data, error } = await supabaseAdmin
    .from('mercadopago_conexion')
    .select('id, id_usuario, mp_user_id, access_token_enc, refresh_token_enc, scope, expira_en, estado')
    .eq('id_usuario', idUsuario)
    .maybeSingle();
  return error ? { dbError: error } : { data };
};

export const updateConexion = async (idUsuario, campos) => {
  const { error } = await supabaseAdmin
    .from('mercadopago_conexion')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id_usuario', idUsuario);
  return error ? { dbError: error } : { data: true };
};

export const deleteConexion = async (idUsuario) => {
  const { error } = await supabaseAdmin
    .from('mercadopago_conexion')
    .delete()
    .eq('id_usuario', idUsuario);
  return error ? { dbError: error } : { data: true };
};
