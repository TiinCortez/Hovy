import { Router } from 'express';
import { getInmuebles, createInmueble} from '../controllers/inmueblesController.js';

const router = Router();

// GET /api/inmuebles
router.get('/', getInmuebles);

// POST /api/inmuebles
router.post('/', createInmueble);

export default router;