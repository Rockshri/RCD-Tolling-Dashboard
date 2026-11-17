import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { ZodError } from 'zod';
import { authRouter } from './routes/auth.js';
import { filtersRouter } from './routes/filters.js';
import { summaryRouter } from './routes/summary.js';
import { plazasRouter } from './routes/plazas.js';
import { filesRouter } from './routes/files.js';
import { downloadRouter } from './routes/download.js';
import { uploadRouter } from './routes/upload.js';
import { adminRouter } from './routes/admin.js';
import { attachUser, requestId } from './lib/middleware.js';
import { logger } from './lib/log.js';

const app = express();
app.set('trust proxy', 1);

const allowed = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',');
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowed.includes(origin)) cb(null, true);
    else cb(new Error('CORS blocked'));
  },
  credentials: true,
}));

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' },
}));

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(requestId);
app.use(pinoHttp({
  logger,
  genReqId: (req) => (req as express.Request).requestId ?? 'unknown',
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
}));

const apiLimit = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api', apiLimit);

// Dashboard data is mutable (vocabulary changes, audit edits, uploads). Disable
// browser/HTTP-cache storage so clients always see current state.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  next();
});
// Disable Express's conditional-GET ETag so /api never returns 304 Not Modified.
app.set('etag', false);

app.use(attachUser);

app.get('/api/healthz', (_req, res) => res.json({ ok: true }));

app.use('/api', authRouter);
app.use('/api', filtersRouter);
app.use('/api', summaryRouter);
app.use('/api', plazasRouter);
app.use('/api', filesRouter);
app.use('/api', downloadRouter);
app.use('/api', uploadRouter);
app.use('/api', adminRouter);

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const rid = req.requestId;
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', requestId: rid, issues: err.issues });
    return;
  }
  if (err instanceof Error && err.message === 'CORS blocked') {
    res.status(403).json({ error: 'CORS blocked', requestId: rid });
    return;
  }
  logger.error({ err, rid }, 'request failed');
  res.status(500).json({ error: 'Internal error', requestId: rid });
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => logger.info({ port }, 'API listening'));
