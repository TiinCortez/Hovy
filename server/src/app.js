import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import clientesRoutes from './routes/clientes.routes.js';
import inmueblesRoutes from './routes/inmuebles.routes.js';
import turnosRoutes from './routes/turnos.routes.js';
import authRoutes from './routes/auth.routes.js';
import { authMiddleware, requireRole } from './middleware/authMiddleware.js';
import botRoutes from './routes/bot.routes.js';
import visitasRoutes from './routes/visitas.routes.js';
import serviciosRoutes from './routes/servicios.routes.js';
import { mercadopagoPublicRouter, mercadopagoAdminRouter } from './integrations/mercadopago/mercadopago.routes.js';
import qrRoutes from './integrations/qr/qr.routes.js';
import { cobrosRouter, webhookRouter } from './integrations/mercadopago/cobros/cobros.routes.js';
import { supabaseAdmin } from './config/supabase.js';
import requestTracer from './middleware/requestTracer.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

// Hardening de cabeceras HTTP de seguridad con Helmet
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Observabilidad: Trazabilidad distribuida con Request ID y métricas de latencia
app.use(requestTracer);

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  'https://hovyapp.com.ar',
  'https://www.hovyapp.com.ar',
  'https://app.hovyapp.com.ar',
  'https://dev.hovyapp.com.ar'
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir peticiones sin 'origin' (servidor a servidor, bot n8n, tools) o en lista blanca
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
};

app.use(cors(corsOptions));
app.use(express.json());

// Endpoint de sondeo y verificación de salud con telemetría y deep check opcional
app.get('/api/health', async (req, res) => {
  const isDeep = req.query.deep === 'true' || req.query.db === 'true';
  const packageVersion = process.env.npm_package_version || '1.0.0';
  const commitSha = process.env.GIT_SHA || process.env.COMMIT_SHA || 'local-dev';
  const environment = process.env.NODE_ENV || 'development';

  const healthData = {
    status: 'ok',
    version: packageVersion,
    commitSha,
    environment,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'hovy-api'
  };

  if (!isDeep) {
    return res.status(200).json(healthData);
  }

  // Verificación profunda (deep check) de conectividad a la base de datos
  const startTime = Date.now();
  try {
    const { error } = await supabaseAdmin.from('clientes').select('id_cliente').limit(1);
    const latencyMs = Date.now() - startTime;

    if (error) {
      healthData.status = 'degraded';
      healthData.checks = {
        database: {
          status: 'error',
          latencyMs,
          message: error.message
        }
      };
      return res.status(503).json(healthData);
    }

    healthData.checks = {
      database: {
        status: 'ok',
        latencyMs
      }
    };
    return res.status(200).json(healthData);
  } catch (err) {
    healthData.status = 'degraded';
    healthData.checks = {
      database: {
        status: 'unreachable',
        latencyMs: Date.now() - startTime,
        message: err.message
      }
    };
    return res.status(503).json(healthData);
  }
});

app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

// Canal del bot de WhatsApp (n8n): autenticación propia por API key
// (verificarApiKeyBot), sin pasar por el JWT de usuarios.
app.use('/api/bot', botRoutes);

// Mercado Pago OAuth: el callback lo abre el navegador volviendo de Mercado Pago
// (sin JWT), por eso se monta ANTES y fuera de las rutas protegidas. El usuario
// se resuelve solo desde el state persistido.
app.use('/api/mercadopago', mercadopagoPublicRouter);
// Webhook de pagos de Mercado Pago: público, autenticado solo por x-signature.
app.use('/api/mercadopago', webhookRouter);

// Rutas protegidas con JWT
app.use('/api/mercadopago', authMiddleware, requireRole(['admin']), mercadopagoAdminRouter);
app.use('/api/cobros', authMiddleware, requireRole(['admin']), cobrosRouter);
app.use('/api/qr', authMiddleware, requireRole(['admin']), qrRoutes);
app.use('/api/clientes', authMiddleware, requireRole(['admin']), clientesRoutes);
app.use('/api/inmuebles', authMiddleware, requireRole(['admin']), inmueblesRoutes);
app.use('/api/visitas', authMiddleware, requireRole(['admin']), visitasRoutes);
app.use('/api/turnos', authMiddleware, requireRole(['admin']), turnosRoutes);
app.use('/api/servicios', authMiddleware, requireRole(['admin']), serviciosRoutes);

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

// Manejo centralizado y observabilidad de errores no controlados
app.use(errorHandler);

export default app;
