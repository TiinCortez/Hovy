import { Router } from 'express';
import { getClientes, createCliente, updateCliente } from '../controllers/clientesController.js';

const router = Router();

// GET /api/clientes
router.get('/', getClientes);

// POST /api/clientes
router.post('/', createCliente);

// PUT /api/clientes/:telefono
// Puse el telefono para actualizar los datos ya que es el campo unico e irrepetible
// que en teoria vamos a tomar parseando y normalizando el dato desde el chatbox
router.put('/:telefono', updateCliente);

export default router;