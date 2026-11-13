import { responderErrorServicio } from '../utils/solicitudesVisita.js';
import { crearSolicitudCliente } from '../services/solicitudClienteService.js';

// POST /api/bot/clientes/:telefono/solicitudes
// body: { id_inmueble, id_servicio, fecha_preferida?, franja_preferida?, nota_horario? }
//
// An existing client asks for a turno on one of their properties. The request
// lands in "Solicitudes -> Clientes" ready for the admin to assign the budget.
// See crearSolicitudCliente. The third argument only exists for tests (express
// passes `next` there, which has no `crear`).
export const crearSolicitudClienteBot = async (req, res, deps) => {
  const crear = typeof deps?.crear === 'function' ? deps.crear : crearSolicitudCliente;

  try {
    const resultado = await crear({ cliente: req.cliente, body: req.body ?? {} });
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    const { solicitud, servicio, servicioCargado } = resultado;

    return res.status(201).json({
      ok: true,
      mensaje: `Recibimos tu pedido de ${servicio.nombre} para ${solicitud.direccion}. Te vamos a enviar el presupuesto.`,
      data: solicitud,
      servicio_cargado: servicioCargado,
    });
  } catch (err) {
    console.error('Error inesperado al registrar el pedido del cliente:', err);
    return res.status(500).json({
      ok: false,
      error: 'Ocurrió un error inesperado al registrar el pedido.',
    });
  }
};
