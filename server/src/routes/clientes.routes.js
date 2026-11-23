import { Router } from 'express';
import { getClientes, createCliente, updateCliente } from '../controllers/clientesController.js';
import { getHistorialTurnosCliente } from '../controllers/historialTurnosClienteController.js';

const router = Router();

// GET /api/clientes
router.get('/', getClientes);

// GET /api/clientes/:idCliente/turnos
router.get('/:idCliente/turnos', getHistorialTurnosCliente);

// POST /api/clientes
router.post('/', createCliente);

// PUT /api/clientes/:telefono
// Puse el telefono para actualizar los datos ya que es el campo unico e irrepetible
// que en teoria vamos a tomar parseando y normalizando el dato desde el chatbox
router.put('/:telefono', updateCliente);

export default router;