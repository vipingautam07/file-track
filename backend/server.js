require('dotenv').config();
require('express-async-errors');

// ── Sentry must be initialised before everything else ────────────
const Sentry = require('@sentry/node');
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 0,
  enabled: !!process.env.SENTRY_DSN,
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const promMiddleware = require('express-prometheus-middleware');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');

const logger = require('./src/config/logger');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { requestId } = require('./src/middleware/requestId');
const { blacklistJwt, isJwtBlacklisted } = require('./src/middleware/jwtBlacklist');
const { pubClient, subClient, available: redisAvailable } = require('./src/config/redis');
const { csrfProtection } = require('./src/middleware/csrf');
const { antiReplay } = require('./src/middleware/antiReplay');
const supabase = require('./src/config/supabase');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const signupRoutes = require('./src/routes/signupRoutes');
const userRoutes = require('./src/routes/userRoutes');
const fileRoutes = require('./src/routes/fileRoutes');
const commentRoutes = require('./src/routes/commentRoutes');
const publicRoutes = require('./src/routes/publicRoutes');

const app = express();
const server = http.createServer(app);

// ── Socket.IO setup ───────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173' || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach Redis adapter for horizontal scaling (graceful fallback to in-memory)
// Check pubClient directly — redisAvailable() is async and would be false at startup
if (pubClient) {
  io.adapter(createAdapter(pubClient, subClient));
  logger.info({ message: 'Socket.IO using Redis adapter', url: process.env.REDIS_URL });
} else {
  logger.info({ message: 'Socket.IO using in-memory adapter (REDIS_URL not set)' });
}

// Auth middleware for Socket.IO
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (payload.jti && isJwtBlacklisted(payload.jti)) return next(new Error('Token revoked'));
    socket.user = payload;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  logger.info({ message: 'Socket connected', userId: socket.user?.sub });

  socket.on('join_file', async (fileId) => {
    if (!fileId || typeof fileId !== 'string') return;

    if (socket.user.role === 'customer') {
      // ── DB ownership check — customers can only join their own file room ──
      try {
        const { data: file, error } = await supabase
          .from('loan_files')
          .select('id, customer_id')
          .eq('id', fileId)
          .is('deleted_at', null)
          .single();

        if (error || !file || file.customer_id !== socket.user.sub) {
          logger.warn({
            message: 'Customer denied file room join — not owner',
            fileId,
            userId: socket.user.sub,
          });
          socket.emit('error', { code: 'FORBIDDEN', message: 'Access denied to this file room' });
          return;
        }

        socket.join(`file:${fileId}`);
        logger.info({ message: 'Customer joined own file room', fileId, userId: socket.user.sub });
      } catch (err) {
        logger.error({ message: 'Socket join_file DB check failed', error: err.message });
      }
    } else {
      // Admins and bank_members can join any file room
      socket.join(`file:${fileId}`);
      logger.info({ message: 'Socket joined file room', fileId, role: socket.user.role, userId: socket.user.sub });
    }
  });

  socket.on('leave_file', (fileId) => {
    socket.leave(`file:${fileId}`);
  });

  socket.on('disconnect', () => {
    logger.info({ message: 'Socket disconnected', userId: socket.user?.sub });
  });
});

// Store io on app for routes to use
app.set('io', io);

// ── Global Middlewares ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://yiqyfyyxdnyqjbckiria.supabase.co'],
      connectSrc: ["'self'", 'https://yiqyfyyxdnyqjbckiria.supabase.co', 'wss:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173' || 'http://localhost',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Parse cookies — required for httpOnly refresh token
app.use(cookieParser());

app.use(requestId);

// ── CSRF + Anti-Replay (after body parsing, before routes) ───────
app.use(csrfProtection);
app.use(antiReplay);

// ── Prometheus metrics (before rate limiter so we capture 429s too) ─
app.use(promMiddleware({
  metricsPath: '/metrics',
  collectDefaultMetrics: true,
  requestDurationBuckets: [0.1, 0.5, 1, 2, 5],
  requestLengthBuckets: [512, 1024, 5120, 10240, 51200],
  responseLengthBuckets: [512, 1024, 5120, 10240, 51200],
  // Protect metrics endpoint in production (use env var to set a bearer token)
  authenticate: process.env.METRICS_TOKEN
    ? (req) => req.headers.authorization === `Bearer ${process.env.METRICS_TOKEN}`
    : undefined,
}));

// HTTP request logging
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Monitoring hook — log all API requests with context
app.use((req, res, next) => {
  logger.info({
    message: 'API Request',
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    requestId: req.requestId,
  });
  next();
});

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '200'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests', code: 'RATE_LIMITED' } },
});
app.use(globalLimiter);

// ── Routes ────────────────────────────────────────────────────────
// Public (no auth) — must be before authenticated routes
app.use('/api/public', publicRoutes);

// Authenticated routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/signup', signupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/comments', commentRoutes);

// ── Health check ──────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    // Lightweight DB ping — just checks connectivity
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) dbStatus = 'error';
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    service: 'Kripanidhi Legal API',
    timestamp: new Date().toLocaleString(),
    version: '1.0.0',
    db: dbStatus,
  });
});

// ── Error handling ────────────────────────────────────────────────
// Sentry error handler must be before other error handlers
Sentry.setupExpressErrorHandler(app);
app.use(notFound);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info({
    message: `Kripanidhi Legal API running`,
    port: PORT,
    env: process.env.NODE_ENV,
  });
});

module.exports = { app, server };
