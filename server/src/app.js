import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import clientesRoutes from './routes/clientes.routes.js';
import inmueblesRoutes from './routes/inmuebles.routes.js';
import turnosRoutes from './routes/turnos.routes.js';
import authRoutes from './routes/auth.routes.js';
import { authMiddleware, requireRole } from './middleware/authMiddleware.js';
import botRoutes from './routes/bot.routes.js';
import visitasRoutes from './routes/visitas.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:4000',
      'https://hovyapp.com.ar',
      'https://www.hovyapp.com.ar',
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

// Endpoint de sondeo y verificación de salud
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'hovy-api'
  });
});

app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

// Canal del bot de WhatsApp (n8n): autenticación propia por API key
// (verificarApiKeyBot), sin pasar por el JWT de usuarios.
app.use('/api/bot', botRoutes);

// Rutas protegidas con JWT
app.use('/api/clientes', authMiddleware, requireRole(['admin']), clientesRoutes);
app.use('/api/inmuebles', authMiddleware, requireRole(['admin']), inmueblesRoutes);
app.use('/api/visitas', authMiddleware, requireRole(['admin']), visitasRoutes);
app.use('/api/turnos', authMiddleware, requireRole(['admin']), turnosRoutes);

// Servir frontend compilado de React (en server/public o client/dist)
const publicDir = path.resolve(__dirname, '../public');
const clientDistDir = path.resolve(__dirname, '../../client/dist');
const staticDir = fs.existsSync(publicDir) ? publicDir : (fs.existsSync(clientDistDir) ? clientDistDir : null);

if (staticDir) {
  app.use(express.static(staticDir));

  // Fallback SPA compatible con Express 5: cualquier ruta que no sea API/Auth carga index.html
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api') || req.path.startsWith('/auth')) {
      return next();
    }
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

export default app;
