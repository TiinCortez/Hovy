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

// Canal del bot de WhatsApp (n8n): autenticación propia por API key
// (verificarApiKeyBot), sin pasar por el JWT de usuarios.
app.use('/api/bot', botRoutes);


// Cambie el orden de la peticion del token especifico por rutas, eliminando el global
// ya que tambien las pediria en el bot, cuando este solamente necesito el header con el api-key.
// tener en cuenta para nuevas rutas.
app.use('/api/clientes', authMiddleware, requireRole(['admin']), clientesRoutes);
app.use('/api/inmuebles', authMiddleware, requireRole(['admin']), inmueblesRoutes);
app.use('/api/inmuebles', authMiddleware, requireRole(['admin']), inmueblesRoutes);


export default app;