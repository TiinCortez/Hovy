import express from 'express';
import cors from 'cors';
import clientesRoutes from './routes/clientes.routes.js';
import inmueblesRoutes from './routes/inmuebles.routes.js';
import turnosRoutes from './routes/turnos.routes.js';
import authRoutes from './routes/auth.routes.js';
import { authMiddleware, requireRole } from './middleware/authMiddleware.js';
import botRoutes from './routes/bot.routes.js';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:4000',
      'https://hovyapp.com.ar',
      'https://app.hovyapp.com.ar'
    ];

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir peticiones sin 'origin' (servidor a servidor, bot n8n, tools) o en lista blanca
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
};

app.use(cors(corsOptions));
app.use(express.json());

// Endpoint de sondeo y verificación de salud para Azure App Service
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'hovy-api'
  });
});

app.use('/auth', authRoutes);

// Canal del bot de WhatsApp (n8n): autenticación propia por API key
// (verificarApiKeyBot), sin pasar por el JWT de usuarios.
app.use('/api/bot', botRoutes);


// Cambie el orden de la peticion del token especifico por rutas, eliminando el global
// ya que tambien las pediria en el bot, cuando este solamente necesito el header con el api-key.
// tener en cuenta para nuevas rutas.
app.use('/api/clientes', authMiddleware, requireRole(['admin']), clientesRoutes);
app.use('/api/inmuebles', authMiddleware, requireRole(['admin']), inmueblesRoutes);
app.use('/api/turnos', turnosRoutes);


export default app;