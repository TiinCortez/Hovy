import { Router } from 'express';
import { getClientes } from '../controllers/clientesController.js';

const router = Router();

// GET /api/clientes
router.get('/', getClientes);

export default router;