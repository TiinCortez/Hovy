import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/supabase.js';
import { generarCodigo, calcularExpiracion } from '../utils/codigoVerificacion.js';
import { enviarEmail } from './emailService.js';

const MAX_INTENTOS_CODIGO = 5;

// Tipos de código que corresponden a un alta todavía no confirmada: la cuenta
// no existe, así que no llevan usuario_id/cliente_id y los datos del alta
// viajan en la columna `datos` hasta que se valide el código. Hoy solo el alta
// de clientes por WhatsApp (el staff se crea con contraseña temporal).
const TIPOS_ALTA = ['alta_cliente'];

// Antes de crear un código de alta se barre lo que ya no sirve: las altas
// vencidas de cualquiera y las no usadas de este mismo teléfono/email (la
// nueva las reemplaza). Así cada teléfono/email tiene como mucho un alta en
// curso y la tabla no junta basura de registros abandonados, sin un cron.
const limpiarAltasPrevias = async ({ tipo, email, telefono }) => {
  const { error: errorVencidas } = await supabaseAdmin
    .from('codigos_verificacion')
    .delete()
    .in('tipo', TIPOS_ALTA)
    .is('usado_en', null)
    .lt('expira_en', new Date().toISOString());

  if (errorVencidas) throw new Error(errorVencidas.message);

  // Valores entre comillas: PostgREST corta el `or` en comas y paréntesis, y
  // el email lo escribe el usuario.
  const filtros = [
    email && `email.eq."${email.replaceAll('"', '')}"`,
    telefono && `telefono.eq.${telefono}`,
  ].filter(Boolean);
  if (filtros.length === 0) return;

  const { error } = await supabaseAdmin
    .from('codigos_verificacion')
    .delete()
    .eq('tipo', tipo)
    .is('usado_en', null)
    .or(filtros.join(','));

  if (error) throw new Error(error.message);
};

// Genera un código, lo guarda hasheado en codigos_verificacion y manda el
// mail correspondiente. `entidadColumna` es 'usuario_id' o 'cliente_id' cuando
// el código es sobre una cuenta que ya existe; en las altas va vacío y los
// datos a insertar viajan en `datos`. `plantilla` es la función de
// emailTemplates.js que arma el {subject, html} a partir del código. Así este
// servicio no sabe nada de qué tabla lo llama ni de contenido de mail.
export const crearYEnviarCodigo = async ({
  entidadColumna,
  entidadId,
  tipo,
  email,
  telefono = null,
  datos = null,
  plantilla,
}) => {
  if (TIPOS_ALTA.includes(tipo)) {
    await limpiarAltasPrevias({ tipo, email, telefono });
  }

  const codigo = generarCodigo();
  const codigoHash = await bcrypt.hash(codigo, 10);

  const { data: registro, error } = await supabaseAdmin
    .from('codigos_verificacion')
    .insert({
      ...(entidadColumna ? { [entidadColumna]: entidadId } : {}),
      tipo,
      email,
      telefono,
      datos,
      codigo_hash: codigoHash,
      expira_en: calcularExpiracion(),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  const { subject, html } = plantilla(codigo);

  // Si el mail no sale, el código no le sirve a nadie: se borra para no dejar
  // un alta a medias y el caller responde error; reintentar arranca limpio.
  try {
    await enviarEmail({ to: email, subject, html });
  } catch (err) {
    await supabaseAdmin.from('codigos_verificacion').delete().eq('id', registro.id);
    throw err;
  }
};

// Busca el código vigente más reciente para ese tipo y `filtro` (un objeto de
// columnas: { cliente_id }, { usuario_id }, { email } o { telefono }), lo
// compara contra el ingresado y lo marca usado si coincide. Devuelve el
// registro para que el caller use `datos` (altas) o `email` (cambio de email).
// La comparten todos los flujos: mismo mecanismo, distinta entidad/tipo.
export const validarCodigo = async ({ tipo, filtro, codigoIngresado }) => {
  const { data: registro, error } = await supabaseAdmin
    .from('codigos_verificacion')
    .select('*')
    .match(filtro)
    .eq('tipo', tipo)
    .is('usado_en', null)
    .gt('expira_en', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!registro || registro.intentos >= MAX_INTENTOS_CODIGO) {
    return { ok: false, error: 'Código inválido o vencido' };
  }

  const coincide = await bcrypt.compare(String(codigoIngresado), registro.codigo_hash);

  if (!coincide) {
    await supabaseAdmin
      .from('codigos_verificacion')
      .update({ intentos: registro.intentos + 1 })
      .eq('id', registro.id);
    return { ok: false, error: 'Código inválido o vencido' };
  }

  await supabaseAdmin
    .from('codigos_verificacion')
    .update({ usado_en: new Date().toISOString() })
    .eq('id', registro.id);

  return { ok: true, registro };
};

// Borra un código ya consumido. Lo usa el alta de clientes: una vez que el
// cliente existe, la fila no sirve y `datos` es una copia de sus datos
// personales que no tiene por qué quedar.
export const eliminarCodigo = async (id) => {
  const { error } = await supabaseAdmin.from('codigos_verificacion').delete().eq('id', id);
  if (error) console.error('No se pudo borrar el código consumido:', error);
};
