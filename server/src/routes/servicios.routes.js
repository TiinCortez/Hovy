import { Router } from 'express';
import {
  getCatalogo,
  getMisServicios,
  createMiServicio,
  updateMiServicio,
  deleteMiServicio
} from '../controllers/serviciosController.js';

const router = Router();

// GET /api/servicios (global catalog of service types)
router.get('/', getCatalogo);

// GET /api/servicios/mios
router.get('/mios', getMisServicios);

// POST /api/servicios/mios
router.post('/mios', createMiServicio);

// PUT /api/servicios/mios/:id
router.put('/mios/:id', updateMiServicio);

// DELETE /api/servicios/mios/:id (soft delete: activo = false)
router.delete('/mios/:id', deleteMiServicio);

export default router;
