import { describe, it, expect } from 'vitest';
import { authorize } from '../lib/middleware.js';

describe('authorize', () => {
  it('viewer reads only', () => {
    expect(authorize('read', 'viewer')).toBe(true);
    expect(authorize('write', 'viewer')).toBe(false);
    expect(authorize('admin', 'viewer')).toBe(false);
  });
  it('editor reads and writes but is not admin', () => {
    expect(authorize('read', 'editor')).toBe(true);
    expect(authorize('write', 'editor')).toBe(true);
    expect(authorize('admin', 'editor')).toBe(false);
  });
  it('admin does everything', () => {
    expect(authorize('read', 'admin')).toBe(true);
    expect(authorize('write', 'admin')).toBe(true);
    expect(authorize('admin', 'admin')).toBe(true);
  });
});
