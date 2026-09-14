import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/supabase.js';
import { generarCodigo, calcularExpiracion } from '../utils/codigoVerificacion.js';
import { enviarEmail } from './emailService.js';

const MAX_INTENTOS_CODIGO = 5;

// Genera un código, lo guarda hasheado en codigos_verificacion y manda el
// mail correspondiente. `entidadColumna` es 'usuario_id' o 'cliente_id' —la
// tabla tiene las dos, nullable, con un CHECK que exige exactamente una— y
// `plantilla` es la función de emailTemplates.js que arma el {subject, html}
// a partir del código. Así este servicio no sabe nada de qué tabla lo llama
// ni de contenido de mail, solo de generar/guardar/enviar.
export const crearYEnviarCodigo = async ({ entidadColumna, entidadId, tipo, email, plantilla }) => {
  const codigo = generarCodigo();
  const codigoHash = await bcrypt.hash(codigo, 10);

  const { error } = await supabaseAdmin.from('codigos_verificacion').insert({
    [entidadColumna]: entidadId,
    tipo,
    codigo_hash: codigoHash,
    expira_en: calcularExpiracion(),
  });

  if (error) throw new Error(error.message);

  const { subject, html } = plantilla(codigo);

  await enviarEmail({ to: email, subject, html });
};

// Busca el código vigente más reciente para esa entidad/tipo, lo compara
// contra el ingresado y lo marca usado si coincide. La comparten todos los
// flujos de verificación (email de usuario, password de usuario, email de
// cliente, teléfono de cliente): mismo mecanismo, distinta entidad/tipo.
export const validarCodigo = async ({ entidadColumna, entidadId, tipo, codigoIngresado }) => {
  const { data: registro, error } = await supabaseAdmin
    .from('codigos_verificacion')
    .select('*')
    .eq(entidadColumna, entidadId)
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

  const coincide = await bcrypt.compare(codigoIngresado, registro.codigo_hash);

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

  return { ok: true };
};
