import { describe, it, expect } from 'vitest';
import { parseFilters } from '../lib/parseFilters.js';

describe('parseFilters', () => {
  it('rejects unknown params', () => {
    expect(() => parseFilters({ nope: '1' })).toThrow();
  });
  it('coerces numeric filter ids', () => {
    expect(parseFilters({ zone: '2', division: '5' })).toEqual({ zone: 2, division: 5 });
  });
  it('accepts "none" for status filters', () => {
    expect(parseFilters({ civil: 'none' })).toEqual({ civil: 'none' });
  });
  it('rejects negative/zero ids', () => {
    expect(() => parseFilters({ zone: '-1' })).toThrow();
    expect(() => parseFilters({ zone: '0' })).toThrow();
  });
  it('allows an empty filter set', () => {
    expect(parseFilters({})).toEqual({});
  });
  it('passes q through', () => {
    expect(parseFilters({ q: 'SH-85' })).toEqual({ q: 'SH-85' });
  });
});
