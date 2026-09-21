import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { emailRateLimit } from '../middleware/emailRateLimit.js';

const router = Router();

// Solo un admin crea staff: el body elige el rol, así que abierto sería una
// forma de auto-asignarse 'admin'.
router.post('/register', authMiddleware, requireRole(['admin']), emailRateLimit, authController.register);
router.post('/login', authController.login);
router.get('/health', authController.health);
router.get('/me', authController.me);
router.put('/usuarios/:id', authMiddleware, requireRole(['admin']), authController.actualizarUsuario);
// Reenvía una contraseña temporal (vencida, no llegó, o usuario viejo sin activar).
router.post('/usuarios/:id/password-temporal', authMiddleware, requireRole(['admin']), emailRateLimit, authController.regenerarPasswordTemporal);
// Primer ingreso: cambia la contraseña temporal por una elegida por el usuario.
router.post('/cambiar-password-inicial', authController.cambiarPasswordInicial);
router.post('/olvide-password', emailRateLimit, authController.olvidePassword);
router.post('/restablecer-password', authController.restablecerPassword);
router.post('/reenviar-codigo', emailRateLimit, authController.reenviarCodigo);

export default router;
