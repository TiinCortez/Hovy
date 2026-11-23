import { obtenerHistorialTurnosCliente } from '../services/historialTurnosClienteService.js';

/**
 * GET /api/clientes/:idCliente/turnos
 * Devuelve el historial completo de turnos de un cliente (solo lectura).
 */
export const getHistorialTurnosCliente = async (req, res) => {
  const resultado = await obtenerHistorialTurnosCliente({
    idCliente: req.params.idCliente,
  });

  if (resultado.error) {
    return res.status(resultado.error.status).json({
      ok: false,
      error: resultado.error.message,
    });
  }

  return res.status(200).json({ ok: true, data: resultado.data });
};
