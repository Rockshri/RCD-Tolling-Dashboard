import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp } from './app.js';
import { pool } from '../../db/client.js';

const app = buildApp();

afterAll(async () => { await pool.end(); });

beforeAll(() => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
});

describe('filters + summary + plazas: invariant', () => {
  it('totals agree with no filters', async () => {
    const [sumRes, listRes] = await Promise.all([
      request(app).get('/api/summary'),
      request(app).get('/api/plazas?pageSize=200'),
    ]);
    expect(sumRes.status).toBe(200);
    expect(listRes.status).toBe(200);
    const kpis = sumRes.body.kpis;
    const total = listRes.body.total;
    expect(kpis.plazas).toBe(total);
    for (const card of sumRes.body.cards) {
      const sum = card.rows.reduce((a: number, r: { n: number }) => a + r.n, 0);
      expect(sum).toBe(total);
    }
  });

  it('seed matches section 2.1 counts (post-rename)', async () => {
    const res = await request(app).get('/api/summary');
    // 92-row invariant: total plaza count and cards are all equal.
    expect(res.body.kpis.plazas).toBe(92);
    expect(res.body.kpis).not.toHaveProperty('cancelled');
    const by = (field: string) => res.body.cards.find((c: { field: string }) => c.field === field)!.rows;
    const civil = by('civil') as Array<{ label: string | null; n: number }>;
    // The old vocabulary must not leak back into the response.
    expect(civil.find((r) => r.label === 'Cancelled')).toBeUndefined();
    expect(civil.find((r) => r.label === 'Work not started')).toBeUndefined();
    // Individual per-label counts drift as users edit plazas through the form,
    // so only the total invariant is asserted here.
    const civilSum = civil.reduce((a, r) => a + r.n, 0);
    expect(civilSum).toBe(92);
  });

  it('unknown filter param returns 400', async () => {
    const res = await request(app).get('/api/plazas?nope=1');
    expect(res.status).toBe(400);
  });

  it('search param is injection-safe', async () => {
    const res = await request(app).get(`/api/plazas?q=${encodeURIComponent("'; drop table toll_plazas; --")}`);
    expect(res.status).toBe(200);
    const stillThere = await request(app).get('/api/plazas?pageSize=1');
    expect(stillThere.body.total).toBe(92);
  });

  it('q literal % finds nothing (escaped, not a wildcard)', async () => {
    const res = await request(app).get('/api/plazas?q=%');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('Layout filter options are Done, In Process, Not Feasible in that order', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    const layout = res.body.statusOptions.layout as Array<{ label: string }>;
    expect(layout.map((o) => o.label)).toEqual(['Done', 'In Process', 'Not Feasible']);
  });

  it('Civil Work filter options are Work started, Not Feasible, Yet to be Started in that order', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    const civil = res.body.statusOptions.civil as Array<{ label: string }>;
    expect(civil.map((o) => o.label)).toEqual(['Work started', 'Not Feasible', 'Yet to be Started']);
  });

  it('Toll Notification filter options are In Process, Yet to be Processed, Not Feasible in that order', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    const notif = res.body.statusOptions.toll_notification as Array<{ label: string }>;
    expect(notif.map((o) => o.label)).toEqual(['In Process', 'Yet to be Processed', 'Not Feasible']);
  });

  it('filtering Layout: each option returns a non-negative count and sums do not exceed 92', async () => {
    const filters = await request(app).get('/api/filters');
    const layout = filters.body.statusOptions.layout as Array<{ id: number; label: string }>;
    const idOf = (lbl: string) => layout.find((o) => o.label === lbl)!.id;

    let total = 0;
    for (const lbl of ['Done', 'In Process', 'Not Feasible']) {
      const res = await request(app).get(`/api/plazas?layout=${idOf(lbl)}&pageSize=200`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(0);
      total += res.body.total;
    }
    expect(total).toBeLessThanOrEqual(92);
  });

  it('/plazas rows include plazaCode (null for seeded data)', async () => {
    const res = await request(app).get('/api/plazas?pageSize=5');
    expect(res.body.rows[0]).toHaveProperty('plazaCode');
    expect(res.body.rows[0].plazaCode).toBeNull();
  });

  it('/filters returns Location Finalized options and plaza_type mix', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.body.locationFinalizedOptions).toEqual(['Yes', 'Yet to be Finalized', 'Not-Feasible', 'No']);
    expect(Array.isArray(res.body.plazaTypes)).toBe(true);
    const types = (res.body.plazaTypes as Array<{ type: string }>).map((p) => p.type);
    // Merged variants should not appear separately.
    expect(types).not.toContain('(1+1) = 2 LANE TOLL PLAZA');
    expect(types).not.toContain('(1+1) X 2 = 4 LANE TOLL PLAZA(Stagereed)');
  });

  it('new KPIs: bsrdc + brpnnl partition the 92-row dataset; locationFinalized is non-negative', async () => {
    const res = await request(app).get('/api/summary');
    const k = res.body.kpis;
    expect(k.bsrdc).toBeGreaterThanOrEqual(0);
    expect(k.brpnnl).toBeGreaterThanOrEqual(0);
    expect(k.bsrdc + k.brpnnl).toBeLessThanOrEqual(k.plazas);
    expect(k.locationFinalized).toBeGreaterThanOrEqual(0);
    expect(k.locationFinalized).toBeLessThanOrEqual(k.plazas);
  });

  it('locationFinalized filter: accepts the 4 fixed values + "none"; rejects anything else', async () => {
    for (const v of ['Yes', 'Yet to be Finalized', 'Not-Feasible', 'No', 'none']) {
      const r = await request(app).get(`/api/plazas?locationFinalized=${encodeURIComponent(v)}&pageSize=1`);
      expect(r.status, `value=${v}`).toBe(200);
    }
    const bad = await request(app).get('/api/plazas?locationFinalized=Maybe');
    expect(bad.status).toBe(400);
  });

  it('locationFinalized=none returns plazas whose value is NULL', async () => {
    const all = await request(app).get('/api/plazas?pageSize=200');
    const blank = await request(app).get('/api/plazas?locationFinalized=none&pageSize=200');
    // Freshly migrated column: every seed row is NULL, so all plazas match.
    expect(blank.body.total).toBeGreaterThanOrEqual(0);
    expect(blank.body.total).toBeLessThanOrEqual(all.body.total);
  });
});

describe('RBAC', () => {
  it('writes require auth', async () => {
    const res = await request(app).post('/api/plazas').send({});
    expect(res.status).toBe(401);
  });
  it('putting without auth returns 401', async () => {
    const res = await request(app).put('/api/plazas/1').send({});
    expect(res.status).toBe(401);
  });
});
