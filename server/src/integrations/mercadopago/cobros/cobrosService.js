import crypto from 'crypto';
import { falla, parsearIdSolicitud } from '../../../utils/solicitudesVisita.js';
import { buscarSolicitud } from '../../../services/presupuestoService.js';
import { supabaseAdmin } from '../../../config/supabase.js';
import { componerQrEnPlantilla } from '../../qr/qrPlantillaService.js';
import { obtenerAccessTokenVigente } from '../mercadopagoOAuthService.js';
import * as repo from './cobrosRepository.js';
import { crearPreferencia } from './mpPagosClient.js';
import { construirPreferencia, esUrlPublicaHttps } from './preferenciaPayload.js';
import { validarMonto } from './estadoPago.js';

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

  // Seller token first: fail fast before touching the DB.
  const token = await obtenerAccessTokenVigente(idUsuario);
  if (token.error) return { error: errorDeToken(token.error).error };

  const externalReference = crypto.randomUUID();
  const { data: cobro, dbError } = await repo.insertarCobro({
    id_usuario: idUsuario,
    id_solicitud: datos.idSolicitud ?? null,
    monto: datos.monto,
    descripcion: datos.descripcion,
    external_reference: externalReference,
  });
  if (dbError) {
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

export const listarCobros = async (idUsuario, idSolicitudRaw) => {
  let idSolicitud = null;
  if (idSolicitudRaw !== undefined && idSolicitudRaw !== '') {
    idSolicitud = parsearIdSolicitud(idSolicitudRaw);
    if (!idSolicitud) return falla(400, 'El id de la solicitud tiene que ser un número entero positivo.');
  }
  const { data, dbError } = await repo.listarCobros(idUsuario, idSolicitud);
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
