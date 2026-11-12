import { Router } from 'express';
import {
  getNotificacionesActivas,
  getHistorialNotificaciones,
  cancelarNotificacion,
  restaurarNotificacion,
} from '../controllers/notificacionesController.js';

// JWT + admin se aplican en app.js, montado en /api/notificaciones.
const router = Router();

router.get('/', getNotificacionesActivas);
router.get('/historial', getHistorialNotificaciones);
router.patch('/:id/cancelar', cancelarNotificacion);
router.patch('/:id/restaurar', restaurarNotificacion);

export default router;
