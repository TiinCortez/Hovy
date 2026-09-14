import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { emailRateLimit } from '../middleware/emailRateLimit.js';

const router = Router();

router.post('/register', emailRateLimit, authController.register);
router.post('/login', authController.login);
router.get('/health', authController.health);
router.get('/me', authController.me);
router.put('/usuarios/:id', authMiddleware, requireRole(['admin']), authController.actualizarUsuario);
router.post('/verificar-email', authController.verificarEmail);
router.post('/olvide-password', emailRateLimit, authController.olvidePassword);
router.post('/restablecer-password', authController.restablecerPassword);
router.post('/reenviar-codigo', emailRateLimit, authController.reenviarCodigo);

export default router;
