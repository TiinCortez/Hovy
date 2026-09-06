import express from 'express';
import cors from 'cors';
import clientesRoutes from './routes/clientes.routes.js';
import inmueblesRoutes from './routes/inmuebles.routes.js';
import authRoutes from './routes/auth.routes.js';
import { authMiddleware, requireRole } from './middleware/authMiddleware.js';
import botRoutes from './routes/bot.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);

app.use(authMiddleware);

app.use('/api/clientes', requireRole(['admin']), clientesRoutes);
app.use('/api/inmuebles', requireRole(['admin']), inmueblesRoutes);

// Canal del bot de WhatsApp (n8n): mismo dominio de negocio, pero con su propia
// autenticación por API key. Va en un prefijo aparte para que /api/clientes
// quede libre de sumarle el JWT de usuarios sin pisarse con esto.
app.use('/api/bot', botRoutes);

export default app;