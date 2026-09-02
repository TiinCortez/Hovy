import express from 'express';
import cors from 'cors';
import clientesRoutes from './routes/clientes.routes.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Endpoint de prueba / Health check
app.use('/api/clientes', clientesRoutes);

export default app;