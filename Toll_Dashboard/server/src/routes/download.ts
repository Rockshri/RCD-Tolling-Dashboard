import { Router } from 'express';
import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { divisions, plazaFiles, statusOptions, tollPlazas } from '../db/schema.js';
import { STORAGE_DIR } from './files.js';
import { requireAuth } from '../lib/middleware.js';

export const downloadRouter = Router();

async function getPlazaDetails(id: number) {
  const [row] = await db
    .select({
      plaza: tollPlazas,
      divisionName: divisions.name,
    })
    .from(tollPlazas)
    .leftJoin(divisions, eq(tollPlazas.divisionId, divisions.id))
    .where(eq(tollPlazas.id, id))
    .limit(1);
  if (!row) return null;

  const statusIds = [
    row.plaza.civilStatusId,
    row.plaza.layoutStatusId,
    row.plaza.siStatusId,
    row.plaza.notificationStatusId,
    row.plaza.operatorStatusId,
  ].filter((x): x is number => x != null);
  const statuses: Record<number, string> = {};
  if (statusIds.length) {
    const rows = await db.select().from(statusOptions);
    for (const s of rows) statuses[s.id] = s.label;
  }

  const files = await db.select().from(plazaFiles).where(eq(plazaFiles.plazaId, id));
  return { ...row.plaza, divisionName: row.divisionName, statuses, files };
}

function buildPdf(doc: PDFKit.PDFDocument, p: NonNullable<Awaited<ReturnType<typeof getPlazaDetails>>>) {
  const label = (k: string, v: unknown) => {
    doc.font('Helvetica-Bold').fontSize(10).text(`${k}: `, { continued: true });
    doc.font('Helvetica').fontSize(10).text(v == null || v === '' ? '—' : String(v));
  };
  doc.font('Helvetica-Bold').fontSize(18).text(p.plazaName || p.roadName);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('#444').text(`S.No ${p.sNo ?? '—'}  •  ${p.entryKind ?? 'road'}`);
  doc.fillColor('#000').moveDown();

  doc.font('Helvetica-Bold').fontSize(12).text('Location');
  doc.moveDown(0.3);
  label('Road', p.roadName);
  label('SH', p.shName);
  label('Division', p.divisionName);
  label('Village', p.villageName);
  label('Chainage', p.chainageRaw);
  label('Latitude', p.latitude);
  label('Longitude', p.longitude);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(12).text('Road and Plaza');
  doc.moveDown(0.3);
  label('Type of Plaza', p.plazaTypeRaw);
  label('Road 2 Lane (km)', p.roadLen2laneKm);
  label('Road >=4 Lane (km)', p.roadLen4laneKm);
  label('Structure >60m 2 Lane (km)', p.structLen2laneKm);
  label('Structure >60m >=4 Lane (km)', p.structLen4laneKm);
  label('Total Road Length (km)', p.roadLenTotalKm);
  label('Total Structure Length (km)', p.structLenTotalKm);
  label('Total Length (km)', p.totalLenKm);
  label('Equivalent Length (km)', p.equivalentLenKm);
  label('APC', p.apc);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(12).text('Status');
  doc.moveDown(0.3);
  label('Civil Work', p.civilStatusId ? p.statuses[p.civilStatusId] : null);
  label('Layout', p.layoutStatusId ? p.statuses[p.layoutStatusId] : null);
  label('System Integrator', p.siStatusId ? p.statuses[p.siStatusId] : null);
  label('Toll Notification', p.notificationStatusId ? p.statuses[p.notificationStatusId] : null);
  label('Toll Operator', p.operatorStatusId ? p.statuses[p.operatorStatusId] : null);
  doc.moveDown();

  const images = p.files.filter((f) => f.kind === 'geo_image');
  if (images.length) {
    doc.font('Helvetica-Bold').fontSize(12).text('Geolocation images');
    doc.moveDown(0.3);
    for (const img of images) {
      const full = path.join(STORAGE_DIR, img.storageKey);
      if (!fs.existsSync(full)) continue;
      try {
        doc.image(full, { fit: [480, 320] });
        doc.font('Helvetica').fontSize(9).fillColor('#555').text(img.originalName);
        doc.fillColor('#000').moveDown();
      } catch {
        /* skip bad image */
      }
    }
  }
}

downloadRouter.get('/plazas/:id/download', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const p = await getPlazaDetails(id);
    if (!p) { res.status(404).json({ error: 'Not found' }); return; }
    const doc = new PDFDocument({ margin: 48 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="plaza-${id}.pdf"`,
    );
    doc.pipe(res);
    buildPdf(doc, p);
    doc.end();
  } catch (e) {
    next(e);
  }
});

downloadRouter.get('/plazas/:id/download-all', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const p = await getPlazaDetails(id);
    if (!p) { res.status(404).json({ error: 'Not found' }); return; }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="plaza-${id}-bundle.zip"`);
    const archive = archiver('zip');
    archive.on('error', next);
    archive.pipe(res);

    const doc = new PDFDocument({ margin: 48 });
    const pdfChunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => pdfChunks.push(c));
    const pdfDone = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(pdfChunks)));
    });
    buildPdf(doc, p);
    doc.end();
    const pdfBuf = await pdfDone;
    archive.append(pdfBuf, { name: `plaza-${id}-details.pdf` });

    for (const f of p.files) {
      const full = path.join(STORAGE_DIR, f.storageKey);
      if (fs.existsSync(full)) {
        const safe = f.originalName.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_');
        archive.file(full, { name: `${f.kind}/${safe}` });
      }
    }
    await archive.finalize();
  } catch (e) {
    next(e);
  }
});
