import { describe, it, expect } from 'vitest';

function parseChainage(s: string | null | undefined): { raw: string | null; meters: number | null; cancelled: boolean } {
  if (!s) return { raw: null, meters: null, cancelled: false };
  const t = s.trim();
  if (!t) return { raw: null, meters: null, cancelled: false };
  if (/^cancelled$/i.test(t)) return { raw: t, meters: null, cancelled: true };
  const m = t.match(/^(\d+)\+(\d+)$/);
  if (m) return { raw: t, meters: Number(m[1]) * 1000 + Number(m[2]), cancelled: false };
  return { raw: t, meters: null, cancelled: false };
}

describe('chainage parser', () => {
  it('parses "13+800" to 13800 m', () => {
    expect(parseChainage('13+800')).toEqual({ raw: '13+800', meters: 13800, cancelled: false });
  });
  it('keeps "Cancelled" as a flag', () => {
    expect(parseChainage('Cancelled')).toEqual({ raw: 'Cancelled', meters: null, cancelled: true });
  });
  it('returns raw-only for unparseable', () => {
    expect(parseChainage('not a chainage')).toEqual({ raw: 'not a chainage', meters: null, cancelled: false });
  });
  it('null/empty', () => {
    expect(parseChainage(null)).toEqual({ raw: null, meters: null, cancelled: false });
    expect(parseChainage('')).toEqual({ raw: null, meters: null, cancelled: false });
    expect(parseChainage('   ')).toEqual({ raw: null, meters: null, cancelled: false });
  });
});
