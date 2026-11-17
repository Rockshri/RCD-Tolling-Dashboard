import { describe, it, expect } from 'vitest';
import {
  STATUS_FIELD_LABELS, NOT_FEASIBLE, NOT_UPDATED, NOT_ASSIGNED, IN_PROCESS,
} from '../lib/labels.js';

describe('shared labels', () => {
  it('every status field has one full name', () => {
    expect(Object.keys(STATUS_FIELD_LABELS)).toEqual([
      'civil', 'layout', 'system_integrator', 'toll_notification', 'toll_operator',
    ]);
    for (const v of Object.values(STATUS_FIELD_LABELS)) {
      expect(v.length).toBeGreaterThanOrEqual(14);
    }
  });
  it('full names match the brief', () => {
    expect(STATUS_FIELD_LABELS.civil).toBe('Status of Civil Work');
    expect(STATUS_FIELD_LABELS.layout).toBe('Status of Layout');
    expect(STATUS_FIELD_LABELS.system_integrator).toBe('Status of System Integrator');
    expect(STATUS_FIELD_LABELS.toll_notification).toBe('Status of Toll Notification');
    expect(STATUS_FIELD_LABELS.toll_operator).toBe('Name of Toll Operator');
  });
  it('no label equals a banned short form', () => {
    const banned = /^(Civil Work|Layout|System Integrator|Toll Notif\.?|Toll Operator)$/;
    for (const v of Object.values(STATUS_FIELD_LABELS)) {
      expect(v).not.toMatch(banned);
    }
  });
  it('exact spelling of key tokens', () => {
    expect(NOT_FEASIBLE).toBe('Not Feasible');
    expect(NOT_UPDATED).toBe('Not updated');
    expect(NOT_ASSIGNED).toBe('Not assigned');
    expect(IN_PROCESS).toBe('In Process');
  });
});
