import { Router } from 'express';
import {
  getSolicitudesVisita,
  getSolicitudVisita,
  contactarSolicitudVisita,
} from '../controllers/visitasController.js';
import { usarAdminDelJwt } from '../controllers/visitasFlujoController.js';
import {
  confirmarSolicitudVisita,
  consultarDisponibilidadStaff,
  crearTurnoDesdeSolicitud,
} from '../controllers/botStaffController.js';
import {
  cargarPresupuestoStaff,
  cargarServiciosVisitaStaff,
  obtenerEstimadoVisitaStaff,
  cancelarSolicitudVisita,
} from '../controllers/botPresupuestoStaffController.js';

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

// Flujo de la visita desde la web (alternativa al bot de WhatsApp). Comparten
// la lógica con el bot (services/visitaFlujoService.js y presupuestoService.js);
// usarAdminDelJwt deja el admin del JWT donde esos handlers lo esperan. El
// estimado es INTERNO: estas rutas son solo para admin.
// POST /api/visitas/:id/confirmar   (Contactada -> Confirmada, crea cliente/inmueble)
router.post('/:id/confirmar', usarAdminDelJwt, confirmarSolicitudVisita);
// PUT  /api/visitas/:id/servicios   (reemplaza servicios + m2)
router.put('/:id/servicios', usarAdminDelJwt, cargarServiciosVisitaStaff);
// GET  /api/visitas/:id/estimado    (presupuesto propuesto, interno)
router.get('/:id/estimado', usarAdminDelJwt, obtenerEstimadoVisitaStaff);
// POST /api/visitas/:id/presupuesto (precio final: monto_total, nota)
router.post('/:id/presupuesto', usarAdminDelJwt, cargarPresupuestoStaff);
// POST /api/visitas/:id/cancelar    (Confirmada -> Cancelada)
router.post('/:id/cancelar', usarAdminDelJwt, cancelarSolicitudVisita);
// GET  /api/visitas/:id/disponibilidad?fecha=&desde=&hasta=&dias=&limite=
// (:id solo ubica la visita en la pantalla; la disponibilidad es de la agenda)
router.get('/:id/disponibilidad', usarAdminDelJwt, consultarDisponibilidadStaff);
// POST /api/visitas/:id/turno       (fecha_programada, prioridad, inicio_desde/hasta)
router.post('/:id/turno', usarAdminDelJwt, crearTurnoDesdeSolicitud);

export default router;
