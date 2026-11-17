import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { eq, and, count } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';
import exifr from 'exifr';
import { db } from '../db/client.js';
import { auditLog, plazaFiles, tollPlazas } from '../db/schema.js';
import { requireAuth, requireRole } from '../lib/middleware.js';

export const filesRouter = Router();

const STORAGE_DIR = path.resolve(process.cwd(), process.env.STORAGE_DIR ?? './storage');
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const PDF_MIME = 'application/pdf';
const IMG_MIMES = new Set(['image/jpeg', 'image/png']);

filesRouter.post('/plazas/:id/files', requireRole('editor', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    const plazaId = Number(req.params.id);
    const kind = req.body.kind as 'pdf' | 'geo_image';
    if (!['pdf', 'geo_image'].includes(kind)) {
      res.status(400).json({ error: 'kind must be pdf or geo_image' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'file required' });
      return;
    }
    const [plaza] = await db.select({ id: tollPlazas.id }).from(tollPlazas).where(eq(tollPlazas.id, plazaId)).limit(1);
    if (!plaza) { res.status(404).json({ error: 'Plaza not found' }); return; }

    const [countRow] = await db
      .select({ n: count() })
      .from(plazaFiles)
      .where(and(eq(plazaFiles.plazaId, plazaId), eq(plazaFiles.kind, kind)));
    if ((countRow?.n ?? 0) >= 10) {
      res.status(400).json({ error: 'File limit (10 per kind) reached' });
      return;
    }

    const detected = await fileTypeFromBuffer(req.file.buffer);
    const mime = detected?.mime ?? req.file.mimetype;
    if (kind === 'pdf' && mime !== PDF_MIME) {
      res.status(400).json({ error: 'PDF content required' });
      return;
    }
    if (kind === 'geo_image' && !IMG_MIMES.has(mime)) {
      res.status(400).json({ error: 'JPG or PNG required' });
      return;
    }

    let exifLat: string | null = null;
    let exifLong: string | null = null;
    if (kind === 'geo_image') {
      try {
        const gps = await exifr.gps(req.file.buffer);
        if (gps?.latitude != null) exifLat = String(gps.latitude);
        if (gps?.longitude != null) exifLong = String(gps.longitude);
      } catch { /* no EXIF or parse error, ignore */ }
    }

    const ext = kind === 'pdf' ? '.pdf' : detected?.ext ? `.${detected.ext}` : '.bin';
    const storageKey = `${plazaId}/${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(STORAGE_DIR, storageKey);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, req.file.buffer);

    const safeName = req.file.originalname.replace(/[\x00-\x1f\\/]/g, '_').slice(0, 255);
    const [row] = await db
      .insert(plazaFiles)
      .values({
        plazaId,
        kind,
        originalName: safeName,
        storageKey,
        mimeType: mime,
        sizeBytes: req.file.size,
        exifLat,
        exifLong,
        uploadedBy: req.user?.id ?? null,
      })
      .returning();
    await db.insert(auditLog).values({
      plazaId, field: 'file_upload', oldValue: null, newValue: safeName, changedBy: req.user?.id ?? null,
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

filesRouter.get('/plazas/:id/files/:fileId', requireAuth, async (req, res, next) => {
  try {
    const plazaId = Number(req.params.id);
    const fileId = Number(req.params.fileId);
    const [row] = await db
      .select()
      .from(plazaFiles)
      .where(and(eq(plazaFiles.id, fileId), eq(plazaFiles.plazaId, plazaId)))
      .limit(1);
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }
    const full = path.join(STORAGE_DIR, row.storageKey);
    if (!fs.existsSync(full)) { res.status(404).json({ error: 'File missing on disk' }); return; }
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.originalName)}"`);
    await db.insert(auditLog).values({
      plazaId, field: 'file_download', oldValue: null, newValue: String(fileId), changedBy: req.user?.id ?? null,
    });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    next(e);
  }
});

filesRouter.delete('/plazas/:id/files/:fileId', requireRole('editor', 'admin'), async (req, res, next) => {
  try {
    const plazaId = Number(req.params.id);
    const fileId = Number(req.params.fileId);
    const [row] = await db
      .select()
      .from(plazaFiles)
      .where(and(eq(plazaFiles.id, fileId), eq(plazaFiles.plazaId, plazaId)))
      .limit(1);
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }
    const full = path.join(STORAGE_DIR, row.storageKey);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    await db.delete(plazaFiles).where(eq(plazaFiles.id, fileId));
    await db.insert(auditLog).values({
      plazaId, field: 'file_delete', oldValue: row.originalName, newValue: null, changedBy: req.user?.id ?? null,
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export { STORAGE_DIR };
