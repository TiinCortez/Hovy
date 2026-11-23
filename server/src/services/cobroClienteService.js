import { supabaseAdmin } from '../config/supabase.js';
import { falla, parsearIdSolicitud } from '../utils/solicitudesVisita.js';
import { obtenerTurnosPendientesCobro } from './turnosPendientesCobroService.js';
import { obtenerSaldoTurno } from './saldoTurnoService.js';
import { crearCobroDeTurno, consultarCobroDeTurno } from '../integrations/mercadopago/cobros/cobrosService.js';

// El cliente registrado ve sus deudas por WhatsApp y paga con un link de Mercado Pago.
//
// Reglas de seguridad:
//  - El cliente sale del teléfono del que escribe (nunca del body) y va en la misma consulta:
//    un turno ajeno se ve igual que uno inexistente (404).
//  - Solo se devuelve lo que el cliente necesita ver: nada de teléfonos, referencias internas
//    ni la cuenta de Mercado Pago que cobra.
//  - El monto se valida contra el saldo real en el servidor.
//
// La plata entra a la cuenta de Mercado Pago vinculada al administrador (ver resolverVendedorDeCobros).
// Los servicios devuelven { data } o { error: { status, message } }; nunca tocan req/res.

const ERROR_DB = 'No se pudo completar la operación. Intentá de nuevo más tarde.';
const MENSAJE_SIN_CUENTA = 'El negocio todavía no tiene una cuenta de Mercado Pago vinculada para cobrar. El equipo se va a comunicar con vos.';

const pesos = (monto) =>
  `$${Number(monto ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const aCentavos = (valor) => Math.round(Number(valor) * 100);
const hhmm = (hora) => (hora ? String(hora).slice(0, 5) : null);
const fechaCorta = (fecha) => {
  const partes = String(fecha ?? '').slice(0, 10).split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}` : '';
};

// ---- Cuenta de Mercado Pago que cobra --------------------------------------------------------
//
// Cada cobro se paga en la cuenta de un usuario. Cuando cobra el cliente solo (sin que nadie del
// equipo genere el link) hace falta fijar cuál: la del administrador. Hoy hay una sola; si algún día
// hubiera más de una, MERCADOPAGO_COBRO_CLIENTES_ID_USUARIO indica cuál (no se adivina).
export const resolverVendedorDeCobros = async ({ cliente = supabaseAdmin, env = process.env } = {}) => {
  const configurado = env.MERCADOPAGO_COBRO_CLIENTES_ID_USUARIO;

  try {
    if (configurado !== undefined && String(configurado).trim() !== '') {
      const id = Number(configurado);
      if (!Number.isInteger(id) || id <= 0) {
        console.error('[cobroCliente] MERCADOPAGO_COBRO_CLIENTES_ID_USUARIO no es un id válido');
        return falla(503, 'El cobro a clientes no está bien configurado en el servidor.');
      }
      const { data, error } = await cliente
        .from('mercadopago_conexion')
        .select('id_usuario')
        .eq('id_usuario', id)
        .eq('estado', 'Conectada')
        .maybeSingle();
      if (error) return falla(500, ERROR_DB);
      if (!data) return falla(503, MENSAJE_SIN_CUENTA);
      return { data: { idUsuario: id } };
    }

    const { data: conexiones, error: errConexiones } = await cliente
      .from('mercadopago_conexion')
      .select('id_usuario')
      .eq('estado', 'Conectada');
    if (errConexiones) {
      console.error('[cobroCliente] no se pudieron leer las conexiones de Mercado Pago');
      return falla(500, ERROR_DB);
    }

    const ids = (conexiones ?? []).map((c) => c.id_usuario);
    if (ids.length === 0) return falla(503, MENSAJE_SIN_CUENTA);

    const { data: admins, error: errAdmins } = await cliente
      .from('usuarios')
      .select('id')
      .eq('rol', 'admin')
      .in('id', ids);
    if (errAdmins) {
      console.error('[cobroCliente] no se pudieron leer los administradores');
      return falla(500, ERROR_DB);
    }

    if ((admins ?? []).length === 0) return falla(503, MENSAJE_SIN_CUENTA);
    if (admins.length > 1) {
      console.error('[cobroCliente] hay más de un administrador con Mercado Pago vinculado y no se fijó cuál cobra');
      return falla(503, 'Hay más de una cuenta de administrador con Mercado Pago vinculada: hay que indicar cuál cobra a los clientes.');
    }
    return { data: { idUsuario: admins[0].id } };
  } catch {
    return falla(500, ERROR_DB);
  }
};

// ---- Deudas ------------------------------------------------------------------------------------

export const armarMensajeDeudasCliente = (deudas) => {
  if (!deudas || deudas.length === 0) return 'No tenés deudas pendientes. ¡Gracias!';
  const encabezado = deudas.length === 1
    ? 'Tenés 1 turno con saldo pendiente:'
    : `Tenés ${deudas.length} turnos con saldo pendiente:`;
  const lineas = deudas.map((d, i) => {
    const lugar = [d.direccion, d.barrio].filter(Boolean).join(', ');
    return `${i + 1}. ${fechaCorta(d.fecha)}${lugar ? ` - ${lugar}` : ''} - Saldo: ${pesos(d.saldo_pendiente)}`;
  });
  return [encabezado, '', ...lineas].join('\n');
};

export const obtenerDeudasDelCliente = async ({ idCliente, limite, deps = {} } = {}) => {
  if (!Number.isInteger(Number(idCliente)) || Number(idCliente) <= 0) return falla(400, 'No pude identificar al cliente.');

  const obtenerPendientes = deps.obtenerPendientes ?? obtenerTurnosPendientesCobro;
  const resultado = await obtenerPendientes({ limite, idCliente: Number(idCliente) });
  if (resultado.error) return resultado;

  const data = (resultado.data ?? []).map((t) => ({
    id_turno: t.id_turno,
    fecha: t.fecha,
    hora_inicio: hhmm(t.hora_inicio),
    hora_fin: hhmm(t.hora_fin),
    direccion: t.direccion ?? null,
    barrio: t.barrio ?? null,
    total_presupuestado: t.total_presupuestado,
    saldo_pendiente: t.saldo_pendiente,
  }));
  return { data, mensaje: armarMensajeDeudasCliente(data) };
};

// ---- Pago --------------------------------------------------------------------------------------

export const armarMensajeCobroCliente = (cobro) => {
  const monto = pesos(cobro?.monto);
  switch (cobro?.estado) {
    case 'Aprobado':
      return cobro.impactado
        ? `¡Recibimos tu pago de ${monto}! ✅ Ya quedó registrado.`
        : `Mercado Pago aprobó tu pago de ${monto}. En unos minutos queda registrado.`;
    case 'Pendiente':
      return `Todavía no recibimos tu pago de ${monto}.`;
    case 'Rechazado':
      return 'Mercado Pago rechazó el pago. Podés intentar de nuevo cuando quieras.';
    case 'Expirado':
    case 'Cancelado':
      return 'El link de pago venció. Pedí uno nuevo cuando quieras.';
    case 'Sin cobro':
      return 'Todavía no generaste un pago para este turno.';
    default:
      return `Estado del pago: ${cobro?.estado ?? 'desconocido'}.`;
  }
};

// El turno tiene que ser del cliente: el filtro va en la misma consulta.
const cargarTurnoPropio = async (cliente, idCliente, idTurno) => {
  const { data, error } = await cliente
    .from('turnos')
    .select('id_turno, estado, inmueble:inmuebles!inner(id_cliente)')
    .eq('id_turno', idTurno)
    .eq('inmueble.id_cliente', idCliente)
    .maybeSingle();

  if (error) {
    console.error('[cobroCliente] error al leer el turno del cliente:', error?.code || 'error');
    return falla(500, ERROR_DB);
  }
  if (!data) return falla(404, 'No encontré ese turno.');
  return { turno: data };
};

const parsearMonto = (monto) => {
  if (monto === undefined || monto === null || String(monto).trim() === '') return { vacio: true };
  const numero = Number(String(monto).replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) return { error: 'El monto tiene que ser un número mayor a 0.' };
  if (Math.abs(numero * 100 - Math.round(numero * 100)) > 1e-6) return { error: 'El monto puede tener hasta 2 decimales.' };
  return { numero };
};

export const crearCobroDelCliente = async ({ idCliente, idTurno, monto, cliente = supabaseAdmin, deps = {} } = {}) => {
  const id = parsearIdSolicitud(idTurno);
  if (!id) return falla(400, 'El id del turno tiene que ser un número entero positivo.');

  const propio = await cargarTurnoPropio(cliente, idCliente, id);
  if (propio.error) return propio;

  const vendedor = await (deps.resolverVendedor ?? (() => resolverVendedorDeCobros({ cliente })))();
  if (vendedor.error) return vendedor;

  const saldo = await (deps.obtenerSaldo ?? obtenerSaldoTurno)(id);
  if (saldo.error) return saldo;
  const pendiente = Number(saldo.data?.pendiente);
  if (!Number.isFinite(pendiente) || !(pendiente > 0)) return falla(409, 'Este turno no tiene saldo pendiente de pago.');

  const pedido = parsearMonto(monto);
  if (pedido.error) return falla(400, pedido.error);
  if (!pedido.vacio && aCentavos(pedido.numero) > aCentavos(pendiente)) {
    return falla(400, `El monto no puede superar tu saldo pendiente (${pesos(pendiente)}).`);
  }

  const crearCobro = deps.crearCobro ?? crearCobroDeTurno;
  const cobro = await crearCobro(vendedor.data.idUsuario, id, { montoDeseado: pedido.vacio ? null : pedido.numero });
  if (cobro.error) {
    // Otro miembro del equipo ya generó el link desde su propia cuenta: no se puede pagar a otra.
    if (/otra cuenta/i.test(cobro.error.message ?? '')) {
      return falla(409, 'Ya hay un pago en curso para este turno. El equipo se va a comunicar con vos.');
    }
    return { error: cobro.error };
  }

  return {
    data: {
      id_cobro: cobro.data.id,
      id_turno: id,
      monto: Number(cobro.data.monto),
      saldo_pendiente: pendiente,
      init_point: cobro.data.init_point,
      reutilizado: cobro.reutilizado === true,
    },
  };
};

// "¿Ya pagué?": le pregunta a Mercado Pago en el momento si el cobro sigue abierto.
export const consultarCobroDelCliente = async ({ idCliente, idTurno, cliente = supabaseAdmin, deps = {} } = {}) => {
  const id = parsearIdSolicitud(idTurno);
  if (!id) return falla(400, 'El id del turno tiene que ser un número entero positivo.');

  const propio = await cargarTurnoPropio(cliente, idCliente, id);
  if (propio.error) return propio;

  const vendedor = await (deps.resolverVendedor ?? (() => resolverVendedorDeCobros({ cliente })))();
  if (vendedor.error) return vendedor;

  const resultado = await (deps.consultarCobro ?? consultarCobroDeTurno)(vendedor.data.idUsuario, id);
  if (resultado.error) return resultado;

  const { estado, impactado, monto } = resultado.data;
  const resumen = { estado, impactado: impactado === true, monto: monto ?? null };
  return { data: { ...resumen, mensaje: armarMensajeCobroCliente(resumen) } };
};
