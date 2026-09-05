import express from 'express';
import cors from 'cors';
import clientesRoutes from './routes/clientes.routes.js';
import inmueblesRoutes from './routes/inmuebles.routes.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Endpoint de prueba / Health check
app.use('/api/clientes', clientesRoutes);
app.use('/api/inmuebles', inmueblesRoutes);

export default app;