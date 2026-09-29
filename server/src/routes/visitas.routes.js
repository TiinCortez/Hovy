import { Router } from 'express';
import {
  getSolicitudesVisita,
  getSolicitudVisita,
  contactarSolicitudVisita,
} from '../controllers/visitasController.js';

const router = Router();

// GET /api/visitas?estado=Pendiente
// Las Pendiente son las notificaciones del panel.
router.get('/', getSolicitudesVisita);

// GET /api/visitas/:id
// Detalle completo: la página "Ver detalles" de una notificación.
router.get('/:id', getSolicitudVisita);

// PATCH /api/visitas/:id/contactar
// Botón "Contactarse": Pendiente -> Contactada.
router.patch('/:id/contactar', contactarSolicitudVisita);

export default router;
