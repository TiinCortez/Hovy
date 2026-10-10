import { Router } from 'express';
import {
  getCatalogo,
  getServicios,
  createServicio,
  updateServicio,
  deleteServicio
} from '../controllers/serviciosController.js';

const router = Router();

// GET /api/servicios (global catalog of service types)
router.get('/', getCatalogo);

// GET /api/servicios/catalogo
router.get('/catalogo', getServicios);

// POST /api/servicios/catalogo
router.post('/catalogo', createServicio);

// PUT /api/servicios/catalogo/:id
router.put('/catalogo/:id', updateServicio);

// DELETE /api/servicios/catalogo/:id (soft delete: activo = false)
router.delete('/catalogo/:id', deleteServicio);

export default router;
