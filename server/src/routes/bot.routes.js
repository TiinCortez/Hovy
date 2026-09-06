import { Router } from 'express';
import { botRateLimit } from '../middlewares/botRateLimit.js';
import { verificarApiKeyBot } from '../middlewares/botAuth.js';
import { getClienteByTelefono } from '../controllers/botClientesController.js';
import { createCliente, updateCliente } from '../controllers/clientesController.js';

const router = Router();
// Los middlewares usan el "router.use" para que protejan todo lo que salga de /api/bot sin tener que agregarlos a cada ruta.
// El rate limit lo agregamos para evitar que alguien nos mate a peticiones con distintas key.
router.use(botRateLimit);
router.use(verificarApiKeyBot);

// GET /api/bot/clientes/:telefono
router.get('/clientes/:telefono', getClienteByTelefono);


// Los endpoints de creacion y modificacion reusan los controllres del cliente normal
// POST /api/bot/clientes
router.post('/clientes', createCliente);
// PUT  /api/bot/clientes/:telefono
router.put('/clientes/:telefono', updateCliente);

export default router;
