import { Router } from 'express';
import { getInmuebles, createInmueble, darDeBajaInmueble, updateInmueble} from '../controllers/inmueblesController.js';

const router = Router();

// GET /api/inmuebles
router.get('/', getInmuebles);

// POST /api/inmuebles
router.post('/', createInmueble);

// DELETE /api/inmuebles/:id
router.delete('/:id/baja', darDeBajaInmueble);

// PUT /api/inmuebles/:id
router.put('/:id', updateInmueble);


export default router;