import { Router } from "express";
import {
  getTurnos,
  getTurnoById,
  createTurno,
  updateTurno,
  cancelarTurno
} from "../controllers/turnosController.js";
import { registrarPago } from "../controllers/pagosController.js";

const router = Router();

// Consulta general
router.get("/", getTurnos);

// Consulta individual
router.get("/:id", getTurnoById);

// Alta
router.post("/nuevo", createTurno);

// Modificación
router.put("/:id", updateTurno);

// Baja lógica
router.patch("/:id/cancelar", cancelarTurno);

// Pago recibido a mano (efectivo o transferencia) de un turno realizado
router.post("/:id/pagos", registrarPago);

export default router;