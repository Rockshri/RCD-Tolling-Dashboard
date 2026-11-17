import { describe, it, expect } from 'vitest';

function totals(r2: number, r4: number, s2: number, s4: number) {
  const roadTotal = r2 + r4;
  const structTotal = s2 + s4;
  const total = roadTotal + structTotal;
  const equivalent = Math.min(r2 + r4 + 10 * (s2 + s4), 5 * total);
  return { roadTotal, structTotal, total, equivalent };
}

describe('length formulas (same as DB generated columns)', () => {
  it('S.No 1: r4=16.6, s4=4.4 → total=21, equivalent=60.6', () => {
    const t = totals(0, 16.6, 0, 4.4);
    expect(t.roadTotal).toBeCloseTo(16.6, 3);
    expect(t.structTotal).toBeCloseTo(4.4, 3);
    expect(t.total).toBeCloseTo(21, 3);
    expect(t.equivalent).toBeCloseTo(60.6, 3);
  });
  it('S.No 91: r2=31.025, s2=0.297 → total=31.322, equivalent=33.995', () => {
    const t = totals(31.025, 0, 0.297, 0);
    expect(t.total).toBeCloseTo(31.322, 3);
    expect(t.equivalent).toBeCloseTo(33.995, 3);
  });
  it('MIN clamp activates for very long roads', () => {
    const t = totals(100, 0, 0.01, 0);
    expect(t.equivalent).toBeLessThanOrEqual(5 * t.total + 0.001);
  });
});
