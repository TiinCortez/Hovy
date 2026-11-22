import { supabaseAdmin } from '../config/supabase.js';

// Aviso al cliente por WhatsApp cuando se asigna un turno con su precio final.
//
// El envío lo hace el workflow "Hovy WA - Aviso de turno" de n8n (el backend no
// habla con Meta). Es SIEMPRE texto libre, nunca una plantilla:
//   - dentro de las 24 h del último mensaje del cliente, WhatsApp lo entrega gratis;
//   - fuera de esa ventana, Meta lo rechaza y no cobra nada (motivo "fuera_de_ventana").
// Por eso acá nunca se reintenta: reintentar no cambia el resultado y no hay forma
// de que este aviso termine en un mensaje pago.
//
// Un aviso que falla nunca frena el turno: estas funciones no lanzan excepciones y
// devuelven { enviado, motivo } para que el panel pueda avisarle al admin.

const TIMEOUT_MS = 6_000;
const SERVICIO_GENERICO = 'Servicio de mantenimiento';

const hhmm = (hora) => (hora ? String(hora).slice(0, 5) : null);

// Datos del turno -> cuerpo del POST al workflow. Devuelve { ok: true, body } o
// { ok: false, motivo } cuando no corresponde avisar.
export const armarDatosAviso = ({ turno, inmueble, cliente, servicios, total } = {}) => {
  if (turno?.estado === 'Cancelado') return { ok: false, motivo: 'turno_cancelado' };

  const telefono = String(cliente?.telefono ?? '').replace(/\D/g, '');
  if (!telefono) return { ok: false, motivo: 'sin_telefono' };

  const fecha = String(turno?.fecha_programada ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, motivo: 'sin_fecha' };

  // Solo se avisa con precio final.
  const monto = typeof total === 'string' && total.trim() === '' ? NaN : Number(total);
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, motivo: 'sin_precio' };

  const nombres = (servicios ?? []).filter(Boolean);

  return {
    ok: true,
    body: {
      // id y estado: el workflow agrega los botones Confirmar / Cancelar solo si el turno está Coordinado.
      id_turno: turno.id_turno ?? null,
      estado: turno.estado ?? null,
      telefono,
      nombre: cliente?.nombre ?? '',
      servicio: nombres.length > 0 ? nombres.join(', ') : SERVICIO_GENERICO,
      fecha,
      hora_desde: hhmm(turno.inicio_desde),
      hora_hasta: hhmm(turno.hasta),
      direccion: [inmueble?.direccion, inmueble?.provincia].filter(Boolean).join(', '),
      total: monto,
    },
  };
};

// POST al webhook de n8n. Sin URL o sin clave configuradas no hace nada (así tampoco
// pasa nada en desarrollo ni en los tests). Una sola llamada, con tiempo máximo.
export const enviarAviso = async (body, deps = {}) => {
  const url = Object.hasOwn(deps, 'url') ? deps.url : process.env.N8N_AVISO_TURNO_URL;
  const apiKey = Object.hasOwn(deps, 'apiKey') ? deps.apiKey : process.env.BOT_API_KEY;
  const llamar = deps.fetch ?? fetch;

  if (!url) return { enviado: false, motivo: 'no_configurado' };
  if (!apiKey) return { enviado: false, motivo: 'sin_clave' };

  try {
    const respuesta = await llamar(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(deps.timeoutMs ?? TIMEOUT_MS),
    });

    let cuerpo = null;
    try { cuerpo = await respuesta.json(); } catch { cuerpo = null; }

    if (respuesta.ok && cuerpo?.enviado === true) return { enviado: true, motivo: null };
    return { enviado: false, motivo: cuerpo?.motivo ?? `error_webhook_${respuesta.status}` };
  } catch (error) {
    return { enviado: false, motivo: error?.name === 'TimeoutError' ? 'timeout' : 'sin_conexion' };
  }
};

// Arma y envía el aviso. Nunca lanza. No se registra el teléfono ni el contenido.
export const avisarTurnoAsignado = async (datos, deps = {}) => {
  try {
    const armado = armarDatosAviso(datos);
    if (!armado.ok) return { enviado: false, motivo: armado.motivo };

    const resultado = await enviarAviso(armado.body, deps);
    if (!resultado.enviado && resultado.motivo !== 'no_configurado') {
      console.warn(`[aviso-turno] no se envió el aviso del turno ${datos?.turno?.id_turno ?? '?'}: ${resultado.motivo}`);
    }
    return resultado;
  } catch (error) {
    console.error('[aviso-turno] error inesperado al avisar el turno:', error?.name || 'error');
    return { enviado: false, motivo: 'error_inesperado' };
  }
};

// Para los flujos que solo tienen el id del turno (agendar desde una solicitud de
// visita): trae turno, inmueble, cliente, presupuesto y servicios y avisa.
export const avisarTurnoPorId = async (idTurno, deps = {}) => {
  try {
    const { data: turno, error } = await supabaseAdmin
      .from('turnos')
      .select('id_turno, id_presupuesto, fecha_programada, inicio_desde, hasta, estado, inmueble:inmuebles(direccion, provincia, cliente:clientes(nombre, telefono))')
      .eq('id_turno', idTurno)
      .maybeSingle();

    if (error || !turno) return { enviado: false, motivo: 'turno_no_encontrado' };

    const [presupuesto, detalle] = await Promise.all([
      supabaseAdmin.from('presupuestos').select('monto_total').eq('id_presupuesto', turno.id_presupuesto).maybeSingle(),
      supabaseAdmin.from('detalle_presupuesto').select('servicio:servicios_catalogo(nombre)').eq('id_presupuesto', turno.id_presupuesto),
    ]);

    return await avisarTurnoAsignado({
      turno,
      inmueble: turno.inmueble,
      cliente: turno.inmueble?.cliente,
      servicios: [...new Set((detalle.data ?? []).map((fila) => fila.servicio?.nombre).filter(Boolean))],
      total: presupuesto.data?.monto_total,
    }, deps);
  } catch (error) {
    console.error('[aviso-turno] error inesperado al cargar el turno:', error?.name || 'error');
    return { enviado: false, motivo: 'error_inesperado' };
  }
};
