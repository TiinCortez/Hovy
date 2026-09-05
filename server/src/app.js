import express from 'express';
import cors from 'cors';
import clientesRoutes from './routes/clientes.routes.js';
import inmueblesRoutes from './routes/inmuebles.routes.js';
import authRoutes from './routes/auth.routes.js';
import { authMiddleware, requireRole } from './middleware/authMiddleware.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);

app.use(authMiddleware);

app.use('/api/clientes', requireRole(['admin']), clientesRoutes);
app.use('/api/inmuebles', requireRole(['admin']), inmueblesRoutes);

export default app;