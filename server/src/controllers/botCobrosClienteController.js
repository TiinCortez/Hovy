import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import {
  obtenerDeudasDelCliente,
  crearCobroDelCliente,
  consultarCobroDelCliente,
} from '../services/cobroClienteService.js';

// Deudas y pago por Mercado Pago del cliente registrado, por WhatsApp.
// El cliente sale del teléfono de la URL (resolverClientePorTelefono): nunca se acepta un id_cliente del body.

// GET /api/bot/clientes/:telefono/deudas?limite=10
//
// Turnos realizados con saldo pendiente del cliente, y solo suyos.
export const getDeudasDelCliente = async (req, res) => {
  try {
    const resultado = await obtenerDeudasDelCliente({
      idCliente: req.cliente?.id_cliente,
      limite: req.query?.limite,
    });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    return res.status(200).json({
      ok: true,
      total: resultado.data.length,
      data: resultado.data,
      mensaje: resultado.mensaje,
    });
  } catch (err) {
    console.error('Error inesperado al consultar las deudas del cliente:', err);
    return res.status(500).json({ ok: false, error: 'Ocurrió un error inesperado al consultar tus deudas.' });
  }
};

// POST /api/bot/clientes/:telefono/turnos/:id/cobro   body: { monto? }
//
// Genera (o reutiliza) el link de pago de Mercado Pago de un turno del cliente, por el saldo total o por
// el monto pedido. El pago entra a la cuenta de Mercado Pago del administrador.
export const crearCobroCliente = async (req, res) => {
  try {
    const resultado = await crearCobroDelCliente({
      idCliente: req.cliente?.id_cliente,
      idTurno: req.params.id,
      monto: req.body?.monto,
    });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    return res.status(resultado.data.reutilizado ? 200 : 201).json({
      ok: true,
      data: resultado.data,
      mensaje: 'Link de pago generado.',
    });
  } catch (err) {
    console.error('Error inesperado al generar el cobro del cliente:', err);
    return res.status(500).json({ ok: false, error: 'No se pudo generar el link de pago.' });
  }
};

// GET /api/bot/clientes/:telefono/turnos/:id/cobro
//
// "¿Ya pagué?": estado del último cobro del turno. Solo lectura.
export const consultarCobroCliente = async (req, res) => {
  try {
    const resultado = await consultarCobroDelCliente({
      idCliente: req.cliente?.id_cliente,
      idTurno: req.params.id,
    });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    return res.status(200).json({ ok: true, data: resultado.data, mensaje: resultado.data.mensaje });
  } catch (err) {
    console.error('Error inesperado al consultar el cobro del cliente:', err);
    return res.status(500).json({ ok: false, error: 'No se pudo consultar el pago.' });
  }
};
