import { Router } from "express";
import { createTurno } from "../controllers/turnosController.js";

const router = Router();

router.post("/nuevo", createTurno);

export default router;