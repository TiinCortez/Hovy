import crypto from 'crypto';
import { falla, parsearIdSolicitud } from '../../../utils/solicitudesVisita.js';
import { buscarSolicitud } from '../../../services/presupuestoService.js';
import { supabaseAdmin } from '../../../config/supabase.js';
import { componerQrEnPlantilla } from '../../qr/qrPlantillaService.js';
import { obtenerAccessTokenVigente } from '../mercadopagoOAuthService.js';
import * as repo from './cobrosRepository.js';
import { crearPreferencia, buscarPagosPorReferencia, obtenerPago } from './mpPagosClient.js';
import { construirPreferencia, esUrlPublicaHttps } from './preferenciaPayload.js';
import { validarMonto, elegirPagoDeBusqueda } from './estadoPago.js';
import { planificarCobroTurno, armarMensajeCobro } from './cobroTurno.js';
import { aplicarPagoACobro } from './aplicarPago.js';

const MAX_DESCRIPCION = 120;
const ERROR_DB = 'No se pudo completar la operación. Intentá de nuevo más tarde.';
const ERROR_NO_ENCONTRADO = 'No existe un cobro con ese id.';

export const parsearIdCobro = (valor) => parsearIdSolicitud(valor);

// Maps the typed errors of obtenerAccessTokenVigente to API errors.
const errorDeToken = (error) => {
  if (error.code === 'NO_CONECTADA') {
    return falla(409, 'Vinculá tu cuenta de Mercado Pago en Configuración para poder cobrar.');
  }
  if (error.code === 'REAUTORIZAR') {
    return falla(409, 'Tu vinculación con Mercado Pago venció. Volvé a vincularla en Configuración.');
  }
  return falla(error.status || 500, error.message || ERROR_DB);
};

// Amount + description from the visit's accepted presupuesto (trusted server state).
const resolverDatosDeSolicitud = async (idSolicitud, idUsuario) => {
  const { solicitud, error } = await buscarSolicitud(idSolicitud, 'al crear el cobro');
  if (error) return { error };

  if (!solicitud.id_presupuesto) {
    return falla(409, 'La visita no tiene un presupuesto cargado. Aceptá el presupuesto antes de cobrar.');
  }
  const { data: presupuesto, error: errPres } = await supabaseAdmin
    .from('presupuestos')
    .select('monto_total, estado')
    .eq('id_presupuesto', solicitud.id_presupuesto)
    .maybeSingle();
  if (errPres || !presupuesto) return falla(500, ERROR_DB);
  if (presupuesto.estado !== 'Aceptado') {
    return falla(409, `El presupuesto tiene que estar Aceptado para cobrar (estado actual: ${presupuesto.estado}).`);
  }
  const monto = validarMonto(Number(presupuesto.monto_total));
  if (monto === null) return falla(409, 'El presupuesto no tiene un monto válido para cobrar.');

  const { data: activos, dbError } = await repo.buscarActivoPorSolicitud(idSolicitud, idUsuario);
  if (dbError) return falla(500, ERROR_DB);
  if (activos?.length) {
    return falla(
      409,
      activos[0].estado === 'Aprobado'
        ? 'Esta visita ya fue cobrada.'
        : 'Ya hay un cobro pendiente para esta visita. Cancelalo para generar uno nuevo.'
    );
  }
  return { monto, descripcion: `Visita #${idSolicitud}` };
};

const resolverDatosManuales = ({ monto, descripcion }) => {
  const montoValido = validarMonto(monto);
  if (montoValido === null) {
    return falla(400, 'El monto tiene que ser un número mayor a 0 con hasta 2 decimales.');
  }
  if (typeof descripcion !== 'string' || descripcion.trim() === '' || descripcion.trim().length > MAX_DESCRIPCION) {
    return falla(400, `La descripción es obligatoria y puede tener hasta ${MAX_DESCRIPCION} caracteres.`);
  }
  return { monto: montoValido, descripcion: descripcion.trim() };
};

const vistaCobro = (c) => ({
  id: c.id,
  id_solicitud: c.id_solicitud,
  id_turno: c.id_turno ?? null,
  // impactado: the payment is already recorded in the client's account.
  id_pago: c.id_pago ?? null,
  impactado: Boolean(c.id_pago),
  estado: c.estado,
  monto: c.monto,
  descripcion: c.descripcion,
  init_point: c.init_point,
  external_reference: c.external_reference,
  created_at: c.created_at,
  updated_at: c.updated_at,
});

export const crearCobro = async (idUsuario, body = {}) => {
  const publicBaseUrl = process.env.MERCADOPAGO_PUBLIC_BASE_URL;
  if (!publicBaseUrl || !esUrlPublicaHttps(publicBaseUrl)) {
    return falla(503, 'El cobro con Mercado Pago no está configurado en el servidor.');
  }

  // A turno is charged from what the client owes in the account ledger.
  if (body.id_turno !== undefined && body.id_turno !== null && body.id_turno !== '') {
    return crearCobroDeTurno(idUsuario, body.id_turno);
  }

  let datos;
  if (body.id_solicitud !== undefined && body.id_solicitud !== null && body.id_solicitud !== '') {
    const idSolicitud = parsearIdSolicitud(body.id_solicitud);
    if (!idSolicitud) return falla(400, 'El id de la solicitud tiene que ser un número entero positivo.');
    datos = await resolverDatosDeSolicitud(idSolicitud, idUsuario);
    if (!datos.error) datos.idSolicitud = idSolicitud;
  } else {
    datos = resolverDatosManuales(body);
  }
  if (datos.error) return { error: datos.error };
  return emitirCobro(idUsuario, datos, publicBaseUrl);
};

// Creates the payment link of an already validated charge: { monto, descripcion,
// idSolicitud?, idTurno?, idCliente? }. Shared by every way of creating a cobro.
const emitirCobro = async (idUsuario, datos, publicBaseUrl) => {
  // Seller token first: fail fast before touching the DB.
  const token = await obtenerAccessTokenVigente(idUsuario);
  if (token.error) return { error: errorDeToken(token.error).error };

  const externalReference = crypto.randomUUID();
  const { data: cobro, dbError } = await repo.insertarCobro({
    id_usuario: idUsuario,
    id_solicitud: datos.idSolicitud ?? null,
    id_turno: datos.idTurno ?? null,
    id_cliente: datos.idCliente ?? null,
    monto: datos.monto,
    descripcion: datos.descripcion,
    external_reference: externalReference,
  });
  if (dbError) {
    // Unique index of migration 013: two requests for the same turno at once.
    if (dbError.code === '23505') {
      return falla(409, 'Este turno ya tiene un cobro en curso. Actualizá e intentá de nuevo.');
    }
    console.error('[cobros] no se pudo insertar el cobro');
    return falla(500, ERROR_DB);
  }

  const preferencia = await crearPreferencia(
    token.data.accessToken,
    construirPreferencia({
      titulo: datos.descripcion,
      monto: datos.monto,
      externalReference,
      publicBaseUrl,
      returnUrl: process.env.MERCADOPAGO_PAYMENT_RETURN_URL || null,
    }),
    externalReference
  );

  if (!preferencia?.id || typeof preferencia.init_point !== 'string') {
    await repo.eliminarCobro(cobro.id);
    return falla(502, 'Mercado Pago no pudo generar el link de pago. Intentá de nuevo.');
  }

  // Only init_point is used: sandbox_init_point is never exposed.
  const { data: actualizado, dbError: errUpd } = await repo.actualizarPreferencia(cobro.id, {
    preference_id: String(preferencia.id),
    init_point: preferencia.init_point,
  });
  if (errUpd) {
    console.error('[cobros] no se pudo guardar la preferencia');
    return falla(500, ERROR_DB);
  }
  return { data: vistaCobro(actualizado) };
};

// Payment link of a turno, for the web panel and the WhatsApp bot. "Get or create":
// if there is already a pending link for exactly what the client still owes, the
// same one is returned (`reutilizado`); if the amount changed (an adjustment or a
// partial payment), the stale pending link is cancelled locally and a new one is
// created. An approved cobro, or a turno that is not Realizado or has no balance,
// is a 409 with a message ready to show.
export const crearCobroDeTurno = async (idUsuario, idTurnoRaw) => {
  const publicBaseUrl = process.env.MERCADOPAGO_PUBLIC_BASE_URL;
  if (!publicBaseUrl || !esUrlPublicaHttps(publicBaseUrl)) {
    return falla(503, 'El cobro con Mercado Pago no está configurado en el servidor.');
  }

  const idTurno = parsearIdSolicitud(idTurnoRaw);
  if (!idTurno) return falla(400, 'El id del turno tiene que ser un número entero positivo.');

  const { data: contexto, dbError } = await repo.leerContextoCobroTurno(idTurno);
  if (dbError) {
    console.error('[cobros] no se pudo leer el turno a cobrar');
    return falla(500, ERROR_DB);
  }

  const { data: activos, dbError: errActivos } = await repo.buscarActivosPorTurno(idTurno);
  if (errActivos) {
    console.error('[cobros] no se pudieron leer los cobros del turno');
    return falla(500, ERROR_DB);
  }

  const plan = planificarCobroTurno({
    turno: contexto.turno,
    movimientos: contexto.movimientos,
    presupuesto: contexto.presupuesto,
    cobrosActivos: activos,
    servicio: contexto.servicio,
  });
  if (plan.error) return { error: plan.error };

  // The turno is shared by the whole crew, but each cobro is paid into one seller's
  // Mercado Pago account: another seller's link is never reused or cancelled here.
  if (activos.some((cobro) => cobro.id_usuario !== idUsuario)) {
    return falla(409, 'Este turno ya tiene un cobro generado desde otra cuenta de Mercado Pago.');
  }

  if (plan.accion === 'reutilizar') return { data: vistaCobro(plan.cobro), reutilizado: true };

  for (const idCobro of plan.cancelar) {
    const { dbError: errCancelar } = await repo.transicionarDesdePendiente(idCobro, 'Cancelado');
    if (errCancelar) return falla(500, ERROR_DB);
  }

  const resultado = await emitirCobro(
    idUsuario,
    { monto: plan.monto, descripcion: plan.descripcion, idTurno, idCliente: contexto.turno.id_cliente },
    publicBaseUrl
  );
  return resultado.error ? resultado : { ...resultado, reutilizado: false };
};

export const listarCobros = async (idUsuario, idSolicitudRaw, idTurnoRaw) => {
  let idSolicitud = null;
  if (idSolicitudRaw !== undefined && idSolicitudRaw !== '') {
    idSolicitud = parsearIdSolicitud(idSolicitudRaw);
    if (!idSolicitud) return falla(400, 'El id de la solicitud tiene que ser un número entero positivo.');
  }
  let idTurno = null;
  if (idTurnoRaw !== undefined && idTurnoRaw !== '') {
    idTurno = parsearIdSolicitud(idTurnoRaw);
    if (!idTurno) return falla(400, 'El id del turno tiene que ser un número entero positivo.');
  }
  const { data, dbError } = await repo.listarCobros(idUsuario, idSolicitud, idTurno);
  if (dbError) return falla(500, ERROR_DB);
  return { data: data.map(vistaCobro) };
};

const cargarPropio = async (idCobro, idUsuario) => {
  const id = parsearIdCobro(idCobro);
  if (!id) return falla(400, 'El id del cobro tiene que ser un número entero positivo.');
  const { data, dbError } = await repo.obtenerCobro(id, idUsuario);
  if (dbError) return falla(500, ERROR_DB);
  if (!data) return falla(404, ERROR_NO_ENCONTRADO);
  return { cobro: data };
};

export const obtenerCobro = async (idCobro, idUsuario) => {
  const { cobro, error } = await cargarPropio(idCobro, idUsuario);
  return error ? { error } : { data: vistaCobro(cobro) };
};

// ---- Active check: ask Mercado Pago instead of waiting for the webhook ---------
//
// The webhook is the normal way to learn about a payment, but a notification can be
// lost (the server was down, the public URL was wrong) and it never reaches a
// development machine. This asks Mercado Pago directly and applies the result
// exactly like the webhook does (aplicarPagoACobro).

// A cobro is worth checking while it waits for its payment, or when it was approved
// but its registration in the client's account is missing.
const necesitaVerificar = (cobro) =>
  cobro.estado === 'Pendiente' || (cobro.estado === 'Aprobado' && Boolean(cobro.id_turno) && !cobro.id_pago);

// The panel polls this every few seconds: Mercado Pago is asked at most once per
// interval for each cobro, the rest of the calls just return what is stored.
const INTERVALO_VERIFICACION_MS = 15_000;
const MAX_VERIFICACIONES_RECORDADAS = 500;
const ultimaVerificacion = new Map();

export const reiniciarVerificaciones = () => ultimaVerificacion.clear();

// Resolves { data: view, verificado } or { error }. `verificado` is true only when
// Mercado Pago was asked and answered. A provider failure is not an error here: the
// stored state is returned and the next poll tries again.
export const verificarCobro = async (idCobro, idUsuario, deps = {}) => {
  const d = {
    repo,
    obtenerToken: obtenerAccessTokenVigente,
    buscarPagos: buscarPagosPorReferencia,
    obtenerPago,
    ahora: Date.now(),
    ...deps,
  };

  const id = parsearIdCobro(idCobro);
  if (!id) return falla(400, 'El id del cobro tiene que ser un número entero positivo.');

  const { data: cobro, dbError } = await d.repo.obtenerCobro(id, idUsuario);
  if (dbError) return falla(500, ERROR_DB);
  if (!cobro) return falla(404, ERROR_NO_ENCONTRADO);

  const sinCambios = { data: vistaCobro(cobro), verificado: false };
  if (!necesitaVerificar(cobro)) return sinCambios;

  const ultima = ultimaVerificacion.get(cobro.id);
  if (ultima !== undefined && d.ahora - ultima < INTERVALO_VERIFICACION_MS) return sinCambios;
  if (ultimaVerificacion.size >= MAX_VERIFICACIONES_RECORDADAS) {
    ultimaVerificacion.delete(ultimaVerificacion.keys().next().value);
  }
  ultimaVerificacion.set(cobro.id, d.ahora);

  const token = await d.obtenerToken(idUsuario);
  if (token.error) return sinCambios;

  let pago = null;
  if (cobro.estado === 'Pendiente') {
    const busqueda = await d.buscarPagos(token.data.accessToken, cobro.external_reference);
    pago = elegirPagoDeBusqueda(busqueda?.results);
  } else if (cobro.mp_payment_id) {
    pago = await d.obtenerPago(token.data.accessToken, cobro.mp_payment_id);
  }
  if (!pago) return sinCambios;

  const aplicado = await aplicarPagoACobro(cobro, pago, d.repo);
  if (aplicado.dbError) return falla(500, ERROR_DB);

  const { data: fresco } = await d.repo.obtenerCobro(id, idUsuario);
  return { data: vistaCobro(fresco ?? aplicado.cobro), verificado: true };
};

// "Did they pay?" for a turno (bot and panel): checks the latest cobro of the turno
// against Mercado Pago if it is still open, and summarizes it in plain Spanish.
// Resolves { data: { estado, impactado, monto, mensaje } } or { error }.
export const consultarCobroDeTurno = async (idUsuario, idTurnoRaw, deps = {}) => {
  const d = { repo, ...deps };

  const idTurno = parsearIdSolicitud(idTurnoRaw);
  if (!idTurno) return falla(400, 'El id del turno tiene que ser un número entero positivo.');

  const { data: ultimo, dbError } = await d.repo.buscarUltimoPorTurno(idTurno);
  if (dbError) return falla(500, ERROR_DB);

  if (!ultimo) {
    return { data: { estado: 'Sin cobro', impactado: false, monto: null, mensaje: armarMensajeCobro(null) } };
  }
  if (ultimo.id_usuario !== idUsuario) {
    return falla(409, 'Este turno tiene un cobro generado desde otra cuenta de Mercado Pago.');
  }

  const verificacion = await verificarCobro(ultimo.id, idUsuario, d);
  if (verificacion.error) return verificacion;

  const cobro = verificacion.data;
  return {
    data: { estado: cobro.estado, impactado: cobro.impactado, monto: cobro.monto, mensaje: armarMensajeCobro(cobro) },
  };
};

export const obtenerQrPng = async (idCobro, idUsuario) => {
  const { cobro, error } = await cargarPropio(idCobro, idUsuario);
  if (error) return { error };
  if (cobro.estado !== 'Pendiente' || !cobro.init_point) {
    return falla(409, `El cobro no está pendiente (estado actual: ${cobro.estado}).`);
  }
  const png = await componerQrEnPlantilla(cobro.init_point);
  if (!Buffer.isBuffer(png)) return { error: png.error };
  return { data: png };
};

// Local cancellation only: the payment link at Mercado Pago is not invalidated here.
export const cancelarCobro = async (idCobro, idUsuario) => {
  const { cobro, error } = await cargarPropio(idCobro, idUsuario);
  if (error) return { error };
  if (cobro.estado !== 'Pendiente') {
    return falla(409, `Solo se puede cancelar un cobro Pendiente (estado actual: ${cobro.estado}).`);
  }
  const { data, dbError } = await repo.transicionarDesdePendiente(cobro.id, 'Cancelado');
  if (dbError) return falla(500, ERROR_DB);
  if (!data.length) return falla(409, 'El cobro cambió de estado. Actualizá e intentá de nuevo.');
  return { data: vistaCobro({ ...cobro, estado: 'Cancelado' }) };
};
