import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { authRouter } from '../../routes/auth.js';
import { filtersRouter } from '../../routes/filters.js';
import { summaryRouter } from '../../routes/summary.js';
import { plazasRouter } from '../../routes/plazas.js';
import { attachUser, requestId } from '../../lib/middleware.js';

export function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(attachUser);
  app.use('/api', authRouter);
  app.use('/api', filtersRouter);
  app.use('/api', summaryRouter);
  app.use('/api', plazasRouter);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) { res.status(400).json({ error: 'Validation failed', issues: err.issues }); return; }
    res.status(500).json({ error: 'Internal error' });
  });
  return app;
}
